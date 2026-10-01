import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { truncateAll } from '../src/db/clean.js';
import { hashSecret, authorizeApproval } from '../src/services/auth.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';
import { createFloorArea, createTable } from '../src/services/floor.js';
import { createOrder, sendKOT } from '../src/services/orders.js';
import { finalizeBill, createCreditNote } from '../src/services/billing.js';
import { processPayment } from '../src/services/payments.js';
import { openShift, recordCashMovement, closeShift } from '../src/services/shifts.js';
import { closeBusinessDay } from '../src/services/day-close.js';
import { corePool } from '../src/services/core-pool.js';

describe('Block 4: Billing, Consecutive Invoices, Split Payments, Shifts & Day Close', () => {
  let outletId: string;
  let terminalId: string;
  let managerUserId: string;
  let cashierUserId: string;
  let tableId: string;
  let dishItemId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // Base organization hierarchy
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Heritage Dine') RETURNING id`);
    const brandRes = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'Royal Feast') RETURNING id`, [orgRes.rows[0].id]);
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code, current_business_date)
       VALUES ($1, 'Connaught Place', 'DEL-CP01', '07AAAAA0000A1Z5', 'B-12 CP New Delhi', '07', '2026-10-01')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // Terminal
    const termRes = await query(
      `INSERT INTO terminals (outlet_id, name, terminal_code, invoice_series_code)
       VALUES ($1, 'Terminal 1', 'T1', 'T1') RETURNING id`,
      [outletId]
    );
    terminalId = termRes.rows[0].id;

    // Roles and Users
    const mgrRole = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Outlet Manager', 50.0) RETURNING id`);
    const cshRole = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Cashier', 10.0) RETURNING id`);

    const mgrPin = await hashSecret('1234');
    const cshPin = await hashSecret('5678');

    const mgrRes = await query(`INSERT INTO users (full_name, pin_hash, email) VALUES ('Amitabh Varma', $1, 'amitabh@heritage.in') RETURNING id`, [mgrPin]);
    const cshRes = await query(`INSERT INTO users (full_name, pin_hash, email) VALUES ('Pooja Nair', $1, 'pooja@heritage.in') RETURNING id`, [cshPin]);

    managerUserId = mgrRes.rows[0].id;
    cashierUserId = cshRes.rows[0].id;

    await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [managerUserId, outletId, mgrRole.rows[0].id]);
    await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [cashierUserId, outletId, cshRole.rows[0].id]);

    // Menu and Floor
    const cat = await createCategory(outletId, 'North Indian Mains', 1);
    const dish = await createMenuItem({
      outlet_id: outletId,
      category_id: cat.id,
      name: 'Paneer Makhani',
      base_price_paise: 40000, // Rs 400
    });
    dishItemId = dish.id;

    const area = await createFloorArea(outletId, 'Main Hall', 1);
    const table = await createTable({ outlet_id: outletId, area_id: area.id, table_number: 'T10', capacity: 4 });
    tableId = table.id;
  });

  afterAll(async () => {
    corePool.shutdown();
    await pool.end();
  });

  it('allocates strictly consecutive invoice numbers under row lock', async () => {
    // Create 2 separate orders
    const o1 = await createOrder({
      outlet_id: outletId,
      order_type: 'dine_in',
      table_id: tableId,
      business_date: '2026-10-01',
      user_id: cashierUserId,
      items: [{ menu_item_id: dishItemId, item_name: 'Paneer Makhani', quantity: 2, unit_price_paise: 40000 }],
    });

    const o2 = await createOrder({
      outlet_id: outletId,
      order_type: 'takeaway',
      business_date: '2026-10-01',
      user_id: cashierUserId,
      items: [{ menu_item_id: dishItemId, item_name: 'Paneer Makhani', quantity: 1, unit_price_paise: 40000 }],
    });

    // Finalize bill 1
    const inv1 = await finalizeBill({
      order_id: o1.id,
      terminal_id: terminalId,
      user_id: cashierUserId,
    });

    // Finalize bill 2
    const inv2 = await finalizeBill({
      order_id: o2.id,
      terminal_id: terminalId,
      user_id: cashierUserId,
    });

    expect(inv1.invoice_number).toMatch(/T1\/\d\d-\d\d\/00001/);
    expect(inv2.invoice_number).toMatch(/T1\/\d\d-\d\d\/00002/);
    expect(inv1.total_paise).toBeGreaterThan(0);
    expect(inv2.total_paise).toBeGreaterThan(0);
  });

  it('enforces idempotency on payments to prevent duplicate charges', async () => {
    const invRes = await query(`SELECT * FROM invoices WHERE status = 'issued' LIMIT 1`);
    const invoice = invRes.rows[0];

    const idemKey = `IDEM-PAY-TEST-${Date.now()}`;
    const pmt1 = await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: invoice.order_id,
      payment_method: 'cash',
      amount_paise: Number(invoice.total_paise),
      idempotency_key: idemKey,
      user_id: cashierUserId,
    });

    expect(pmt1.is_fully_paid).toBe(true);
    expect(pmt1.is_idempotent_replay).toBeUndefined();

    // Replay with identical idempotency key
    const pmt2 = await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: invoice.order_id,
      payment_method: 'cash',
      amount_paise: Number(invoice.total_paise),
      idempotency_key: idemKey,
      user_id: cashierUserId,
    });

    expect(pmt2.is_idempotent_replay).toBe(true);
    expect(pmt2.payment.id).toBe(pmt1.payment.id);
  });

  it('handles split tender payment: partial payment then final settlement', async () => {
    // Settle the second invoice using split tender (50% cash + 50% UPI)
    const invRes = await query(`SELECT * FROM invoices WHERE status = 'issued' AND id NOT IN (SELECT invoice_id FROM payments) LIMIT 1`);
    const invoice = invRes.rows[0];
    const total = Number(invoice.total_paise);
    const half = Math.floor(total / 2);
    const rem = total - half;

    // Tender 1: Cash
    const p1 = await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: invoice.order_id,
      payment_method: 'cash',
      amount_paise: half,
      idempotency_key: `IDEM-SPLIT-1-${Date.now()}`,
      user_id: cashierUserId,
    });

    expect(p1.is_fully_paid).toBe(false);
    expect(p1.balance_remaining_paise).toBe(rem);

    // Tender 2: UPI
    const p2 = await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: invoice.order_id,
      payment_method: 'upi',
      amount_paise: rem,
      idempotency_key: `IDEM-SPLIT-2-${Date.now()}`,
      user_id: cashierUserId,
    });

    expect(p2.is_fully_paid).toBe(true);
    expect(p2.balance_remaining_paise).toBe(0);
  });

  it('generates consecutive credit note for invoice cancellation', async () => {
    const invRes = await query(`SELECT * FROM invoices WHERE status = 'issued' LIMIT 1`);
    const invoice = invRes.rows[0];

    const cn = await createCreditNote(invoice.id, 'Customer returned dish due to food intolerance', managerUserId);
    expect(cn.invoice_type).toBe('credit_note');
    expect(cn.invoice_number).toMatch(/CN\/\d\d-\d\d\/00001/);
    expect(Number(cn.total_paise)).toBe(-Number(invoice.total_paise));
  });

  it('opens shift, logs cash movements, and reconciles closing float with denomination tally', async () => {
    const shift = await openShift(outletId, terminalId, cashierUserId, 500000, '2026-10-01'); // Rs 5,000 float
    expect(shift.status).toBe('open');

    // Paid-out for pantry supplies: Rs 500
    await recordCashMovement(shift.id, 'paid_out', 50000, 'Purchased lemons and ice for bar', managerUserId, cashierUserId);

    // Safe cash drop: Rs 2,000
    await recordCashMovement(shift.id, 'drop', 200000, 'Mid-day safe deposit drop', managerUserId, cashierUserId);

    // Close shift with physical cash count
    const closed = await closeShift(
      shift.id,
      0, // Will be computed from denomination breakdown
      {
        '500': 10, // Rs 5,000
        '100': 5,  // Rs 500
      },
      false,
      'Smooth lunch shift',
      cashierUserId
    );

    expect(closed.status).toBe('closed');
    expect(closed.closing_cash_actual_paise).toBe('550000'); // 5500 Rs
    expect(closed.over_short_paise).toBeDefined();
  });

  it('prevents day close if open orders, unbilled tables, or open shifts exist', async () => {
    // Create an unbilled order
    const openOrder = await createOrder({
      outlet_id: outletId,
      order_type: 'dine_in',
      business_date: '2026-10-01',
      user_id: cashierUserId,
      items: [{ menu_item_id: dishItemId, item_name: 'Paneer Makhani', quantity: 1, unit_price_paise: 40000 }],
    });

    // Attempting day close must be rejected
    await expect(closeBusinessDay(outletId, '2026-10-01', managerUserId)).rejects.toThrow('Cannot close day');

    // Cancel order to clear precondition
    await query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [openOrder.id]);
  });

  it('executes Z-report day close and locks business date idempotently', async () => {
    const result = await closeBusinessDay(outletId, '2026-10-01', managerUserId);
    expect(result.day_close).toBeDefined();
    expect(result.is_already_closed).toBe(false);
    expect(result.z_report.gross_sales_paise).toBeGreaterThan(0);
    expect(result.z_report.sales_by_category.length).toBeGreaterThan(0);

    // Verify outlet business date advanced to 2026-10-02
    const outletRes = await query(`SELECT current_business_date::text as next_date FROM outlets WHERE id = $1`, [outletId]);
    expect(outletRes.rows[0].next_date).toBe('2026-10-02');

    // Verify idempotent re-call
    const recall = await closeBusinessDay(outletId, '2026-10-01', managerUserId);
    expect(recall.is_already_closed).toBe(true);
  });
});
