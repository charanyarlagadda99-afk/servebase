import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  createRoom,
  getRooms,
  updateRoomStatus,
  createGuest,
  checkInGuest,
  postChargeToRoom,
  runNightAudit,
  settleAndCheckOut,
} from '../src/services/hotel.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';
import { createOrder } from '../src/services/orders.js';
import { finalizeBill } from '../src/services/billing.js';
import { processPayment } from '../src/services/payments.js';

describe('Block 9: Hotel Extension - Rooms, Folios, Night Audit & Room Charges', () => {
  let outletId: string;
  let managerUserId: string;
  let room101Id: string;
  let room201Id: string;
  let room301Id: string;
  let guestId: string;
  let activeFolioId: string;
  let dishItemId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Organization & Outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Taj Hospitality Group') RETURNING id`);
    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Taj Palace') RETURNING id`,
      [orgRes.rows[0].id]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'Taj Palace Hotel & Resorts', 'DEL-TAJ01', '07AAAAA0000A1Z5', 'Diplomatic Enclave New Delhi', '07')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // 2. Manager
    const mgrRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Jamshed Tata', 'hash', 'jamshed@taj.in') RETURNING id`
    );
    managerUserId = mgrRes.rows[0].id;

    // 3. Create Hotel Rooms
    const r1 = await createRoom({
      outlet_id: outletId,
      room_number: '101',
      room_type: 'Deluxe Garden View',
      base_tariff_paise: 500000, // Rs 5,000/night
    });
    room101Id = r1.id;

    const r2 = await createRoom({
      outlet_id: outletId,
      room_number: '201',
      room_type: 'Presidential Suite',
      base_tariff_paise: 1500000, // Rs 15,000/night
    });
    room201Id = r2.id;

    const r3 = await createRoom({
      outlet_id: outletId,
      room_number: '301',
      room_type: 'Superior Queen',
      base_tariff_paise: 400000, // Rs 4,000/night
    });
    room301Id = r3.id;

    // 4. Create Guest Profile
    const guest = await createGuest({
      name: 'Dr. Vikram Sarabhai',
      phone: '+919822334455',
      email: 'vikram.sarabhai@isro.gov.in',
      id_type: 'passport',
      id_number: 'Z1234567',
    });
    guestId = guest.id;

    // 5. Menu Item for Room Service / Dining
    const cat = await createCategory(outletId, 'In-Room Dining', 1);
    const dish = await createMenuItem({
      outlet_id: outletId,
      category_id: cat.id,
      name: 'Tandoori Lobster Thermidor',
      base_price_paise: 350000, // Rs 3,500
    });
    dishItemId = dish.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('manages room inventory, inspection statuses, and lists all rooms', async () => {
    const rooms = await getRooms(outletId);
    expect(rooms.length).toBe(3);

    const r101 = rooms.find((r) => r.room_number === '101');
    expect(r101?.status).toBe('clean');
    expect(r101?.base_tariff_paise).toBe(500000);

    // Update room 301 to maintenance
    const updated = await updateRoomStatus(room301Id, 'maintenance');
    expect(updated.status).toBe('maintenance');
  });

  it('checks in guest into clean room, creates active folio, and locks room', async () => {
    const folio = await checkInGuest(outletId, room101Id, guestId, 4000000); // Rs 40,000 credit limit

    expect(folio.status).toBe('active');
    expect(folio.room_number).toBe('101');
    expect(folio.credit_limit_paise).toBe(4000000);
    expect(folio.total_posted_paise).toBe(0);
    activeFolioId = folio.id;

    // Verify room status is now 'occupied'
    const rooms = await getRooms(outletId);
    const r101 = rooms.find((r) => r.room_number === '101');
    expect(r101?.status).toBe('occupied');

    // Attempting to check in another guest into occupied room must fail
    await expect(checkInGuest(outletId, room101Id, guestId, 5000000)).rejects.toThrow('already occupied');
  });

  it('charges restaurant/room service bill directly to guest hotel folio', async () => {
    // 1. Create order for Room Service
    const order = await createOrder({
      outlet_id: outletId,
      order_type: 'room_service',
      room_number: '101',
      business_date: '2026-10-01',
      user_id: managerUserId,
      items: [{ menu_item_id: dishItemId, item_name: 'Tandoori Lobster Thermidor', quantity: 1, unit_price_paise: 350000 }],
    });

    // 2. Finalize bill
    const invoice = await finalizeBill({
      order_id: order.id,
      user_id: managerUserId,
    });

    // 3. Settle bill via charge_to_room
    const pmt = await processPayment({
      outlet_id: outletId,
      invoice_id: invoice.id,
      order_id: order.id,
      payment_method: 'charge_to_room',
      amount_paise: Number(invoice.total_paise),
      idempotency_key: `PMT-ROOM-101-${Date.now()}`,
      user_id: managerUserId,
    });

    expect(pmt.is_fully_paid).toBe(true);

    // 4. Verify folio balance updated
    const folioRes = await query(`SELECT * FROM hotel_folios WHERE id = $1`, [activeFolioId]);
    expect(Number(folioRes.rows[0].total_posted_paise)).toBe(Number(invoice.total_paise));
  });

  it('strictly enforces guest credit limits on room charges', async () => {
    // Attempting to post an exorbitant charge (Rs 1,00,000) that exceeds credit limit of Rs 40,000
    await expect(
      postChargeToRoom(outletId, '101', 10000000, 'Vintage Champagne Bottle', 'room_service')
    ).rejects.toThrow('Charge exceeds room credit limit');
  });

  it('runs hotel night audit posting daily room charges and calculating hospitality KPIs', async () => {
    const auditSummary = await runNightAudit(outletId, '2026-10-01', managerUserId);

    expect(auditSummary.total_rooms).toBe(3);
    expect(auditSummary.occupied_rooms).toBe(1); // Room 101
    expect(auditSummary.occupancy_percent).toBeCloseTo(33.33, 1);
    expect(auditSummary.total_room_revenue_paise).toBe(500000); // Rs 5,000 for Room 101
    expect(auditSummary.average_daily_rate_paise).toBe(500000);
    expect(auditSummary.revpar_paise).toBe(Math.round(500000 / 3)); // ~Rs 1,667

    // Verify folio has room charge posted
    const chargesRes = await query(
      `SELECT * FROM folio_charges WHERE folio_id = $1 AND charge_type = 'room_charge'`,
      [activeFolioId]
    );
    expect(chargesRes.rows.length).toBe(1);
    expect(Number(chargesRes.rows[0].amount_paise)).toBe(500000);
  });

  it('settles folio upon checkout and queues room for housekeeping cleaning', async () => {
    const checkoutResult = await settleAndCheckOut(activeFolioId, 'card', managerUserId);

    expect(checkoutResult.status).toBe('settled');
    expect(checkoutResult.total_settled_paise).toBeGreaterThan(0);
    expect(checkoutResult.payment_method).toBe('card');

    // Room 101 must now transition to 'dirty'
    const rooms = await getRooms(outletId);
    const r101 = rooms.find((r) => r.room_number === '101');
    expect(r101?.status).toBe('dirty');
  });
});
