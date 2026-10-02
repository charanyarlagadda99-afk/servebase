import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  initStandardChartOfAccounts,
  createJournalEntry,
  postDayCloseSalesJournal,
  postInventoryConsumptionJournal,
  postPayrollJournal,
  getTrialBalance,
  getFlashPL,
} from '../src/services/accounting.js';
import {
  createAlert,
  getAlerts,
  markAlertRead,
  checkInventoryShortages,
  checkCashOverShort,
} from '../src/services/alerts.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';
import { createFloorArea, createTable } from '../src/services/floor.js';
import { createOrder } from '../src/services/orders.js';
import { finalizeBill } from '../src/services/billing.js';
import { processPayment } from '../src/services/payments.js';
import { closeBusinessDay } from '../src/services/day-close.js';
import { createUOM, createRawMaterial, recordStockMovement } from '../src/services/inventory.js';
import { createEmployee, runPayroll } from '../src/services/staff.js';

describe('Block 8: Double-Entry Accounting, Trial Balance, Flash P&L & Alerts', () => {
  let orgId: string;
  let outletId: string;
  let managerUserId: string;
  let dayCloseId: string;
  let rawMaterialId: string;
  let payrollRunId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Organization & Outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Oberoi Culinary Group') RETURNING id`);
    orgId = orgRes.rows[0].id;

    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Oberoi Grand') RETURNING id`,
      [orgId]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code, current_business_date)
       VALUES ($1, 'Oberoi New Delhi', 'DEL-OB01', '07AAAAA0000A1Z5', 'Dr Zakir Hussain Marg', '07', '2026-10-01')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // 2. Manager
    const mgrRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Biki Oberoi', 'hash', 'biki@oberoi.in') RETURNING id`
    );
    managerUserId = mgrRes.rows[0].id;

    // 3. Initialize Chart of Accounts
    await initStandardChartOfAccounts(orgId);

    // 4. Create Menu, Table, Order & Bill for Day Close testing
    const cat = await createCategory(outletId, 'Mains', 1);
    const dish = await createMenuItem({
      outlet_id: outletId,
      category_id: cat.id,
      name: 'Raan-e-Sikandari',
      base_price_paise: 200000, // Rs 2,000
    });

    const area = await createFloorArea(outletId, 'Terrace', 1);
    const table = await createTable({ outlet_id: outletId, area_id: area.id, table_number: 'TR-1', capacity: 2 });

    const order = await createOrder({
      outlet_id: outletId,
      table_id: table.id,
      order_type: 'dine_in',
      business_date: '2026-10-01',
      user_id: managerUserId,
      items: [{ menu_item_id: dish.id, item_name: 'Raan-e-Sikandari', quantity: 2, unit_price_paise: 200000 }],
    });

    const invoice = await finalizeBill({
      order_id: order.id,
      user_id: managerUserId,
      service_charge_percent: 10.0, // 10% service charge
      tip_paise: 50000,             // Rs 500 tip
    });

    // Pay full amount (split 50% Cash + 50% Card/Bank)
    const total = Number(invoice.total_paise);
    const half = Math.floor(total / 2);
    await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: order.id,
      payment_method: 'cash',
      amount_paise: half,
      idempotency_key: `PMT-CASH-${Date.now()}`,
      user_id: managerUserId,
    });
    await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: order.id,
      payment_method: 'card',
      amount_paise: total - half,
      idempotency_key: `PMT-CARD-${Date.now()}`,
      user_id: managerUserId,
    });

    // Day close
    const dcResult = await closeBusinessDay(outletId, '2026-10-01', managerUserId);
    dayCloseId = dcResult.day_close.id;

    // 5. Raw Material & Stock Movement for COGS
    const uom = await createUOM({ name: 'Kilogram', symbol: 'kg' });
    const raw = await createRawMaterial({
      outlet_id: outletId,
      name: 'Baby Lamb Leg',
      sku: 'RAW-LAMB-01',
      uom_id: uom.id,
      current_cost_paise: 80000, // Rs 800/kg
      par_level: 20.0,
      reorder_point: 10.0,
    });
    rawMaterialId = raw.id;

    // Record sales consumption of 3.0 kg lamb leg (Rs 2,400 = 240,000 paise)
    await recordStockMovement({
      outlet_id: outletId,
      raw_material_id: rawMaterialId,
      movement_type: 'sale_consumption',
      quantity: -3.0,
      unit_cost_paise: 80000,
      business_date: '2026-10-01',
      notes: 'Dinner service meat consumption',
      user_id: managerUserId,
    });

    // 6. Employee & Payroll run
    const emp = await createEmployee({
      outlet_id: outletId,
      employee_code: 'EMP-OB-01',
      first_name: 'Rajeev',
      last_name: 'Sharma',
      role: 'line_cook',
      salary_type: 'monthly',
      base_rate_paise: 4000000, // Rs 40,000
    });

    const run = await runPayroll(outletId, 10, 2026, managerUserId);
    payrollRunId = run.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects unbalanced journal entries where debits do not equal credits', async () => {
    await expect(
      createJournalEntry({
        outlet_id: outletId,
        business_date: '2026-10-01',
        entry_type: 'manual',
        narration: 'Unbalanced test entry',
        lines: [
          { account_code: '1010', debit_paise: 100000, credit_paise: 0 },
          { account_code: '4010', debit_paise: 0, credit_paise: 90000 }, // Mismatch by 10,000 paise!
        ],
      })
    ).rejects.toThrow('Unbalanced journal entry');
  });

  it('posts automated sales journal from Day Close Z-report ensuring exact double-entry balance', async () => {
    const entry = await postDayCloseSalesJournal(outletId, dayCloseId);

    expect(entry.entry_type).toBe('sale');
    expect(entry.entry_number).toMatch(/JE-\d+/);
    expect(entry.lines.length).toBeGreaterThanOrEqual(4);

    // Sum of debits must match sum of credits
    const totalDebits = entry.lines.reduce((s: number, l: any) => s + l.debit_paise, 0);
    const totalCredits = entry.lines.reduce((s: number, l: any) => s + l.credit_paise, 0);
    expect(totalDebits).toBe(totalCredits);

    // Verify Cash on hand and Bank clearing accounts exist in debits
    const cashLine = entry.lines.find((l: any) => l.account_code === '1010');
    const bankLine = entry.lines.find((l: any) => l.account_code === '1020');
    expect(cashLine?.debit_paise).toBeGreaterThan(0);
    expect(bankLine?.debit_paise).toBeGreaterThan(0);
  });

  it('posts automated inventory consumption journal debiting COGS and crediting Inventory Asset', async () => {
    const entry = await postInventoryConsumptionJournal(outletId, '2026-10-01');

    expect(entry).not.toBeNull();
    expect(entry?.entry_type).toBe('consumption');
    expect(entry?.lines.length).toBe(2);

    const cogsLine = entry?.lines.find((l: any) => l.account_code === '5010'); // Food COGS
    const invLine = entry?.lines.find((l: any) => l.account_code === '1040');  // Inventory Asset

    expect(cogsLine?.debit_paise).toBe(240000); // 3 kg * 80000 paise = 240,000 paise (Rs 2,400)
    expect(invLine?.credit_paise).toBe(240000);
  });

  it('posts automated payroll journal debiting Salaries Expense and crediting Bank clearing and Liabilities', async () => {
    const entry = await postPayrollJournal(outletId, payrollRunId);

    expect(entry.entry_type).toBe('payroll');
    expect(entry.lines.length).toBe(3);

    const salaryExpLine = entry.lines.find((l: any) => l.account_code === '6010'); // DR Salaries Expense
    const bankLine = entry.lines.find((l: any) => l.account_code === '1020');      // CR Bank Clearing (Net Salary)
    const liabLine = entry.lines.find((l: any) => l.account_code === '2050');      // CR Statutory Liabilities

    expect(salaryExpLine?.debit_paise).toBe(4000000); // Rs 40,000 gross
    expect(bankLine?.credit_paise).toBeGreaterThan(0);
    expect(liabLine?.credit_paise).toBeGreaterThanOrEqual(0);

    const totalDebits = entry.lines.reduce((s: number, l: any) => s + l.debit_paise, 0);
    const totalCredits = entry.lines.reduce((s: number, l: any) => s + l.credit_paise, 0);
    expect(totalDebits).toBe(totalCredits);
  });

  it('generates a balanced Trial Balance across all accounts in the organization', async () => {
    const tb = await getTrialBalance(orgId);

    expect(tb.is_balanced).toBe(true);
    expect(tb.total_debits_paise).toBe(tb.total_credits_paise);
    expect(tb.total_debits_paise).toBeGreaterThan(0);
    expect(tb.accounts.length).toBeGreaterThan(0);
  });

  it('generates a Flash P&L statement calculating Revenue, COGS, Gross Profit, and Net Operating Income', async () => {
    const pl = await getFlashPL(orgId);

    expect(pl.total_revenue_paise).toBeGreaterThan(0);
    expect(pl.total_cogs_paise).toBe(240000); // Rs 2,400
    expect(pl.gross_profit_paise).toBe(pl.total_revenue_paise - pl.total_cogs_paise);
    expect(pl.gross_margin_percent).toBeGreaterThan(0);
    expect(pl.total_operating_expenses_paise).toBe(4000000); // Rs 40,000 salaries
    expect(pl.net_operating_income_paise).toBe(pl.gross_profit_paise - pl.total_operating_expenses_paise);
  });

  it('triggers operational alerts for low stock and cash discrepancy', async () => {
    // 1. Raw material stock is currently -3 kg (below reorder point 10.0) -> Triggers LOW_STOCK alert
    const stockAlerts = await checkInventoryShortages(outletId);
    expect(stockAlerts.length).toBeGreaterThan(0);
    expect(stockAlerts[0].alert_type).toBe('LOW_STOCK');
    expect(stockAlerts[0].severity).toBe('critical');

    // 2. Shift cash discrepancy check (shortage of Rs 600 exceeds Rs 500 threshold)
    const cashAlert = await checkCashOverShort(outletId, 'dummy-shift-id', -60000, 50000);
    expect(cashAlert).not.toBeNull();
    expect(cashAlert?.alert_type).toBe('CASH_SHORTAGE');

    // 3. Retrieve unread alerts
    const alerts = await getAlerts(outletId, true);
    expect(alerts.length).toBeGreaterThanOrEqual(2);

    // 4. Mark alert as read
    const readAlert = await markAlertRead(alerts[0].id);
    expect(readAlert.is_read).toBe(true);
  });
});
