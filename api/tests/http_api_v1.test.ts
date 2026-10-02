import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { pool, query } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { truncateAll } from '../src/db/clean.js';
import { hashSecret } from '../src/services/auth.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';

describe('HTTP API v1: Full REST Surface, Auth, Permissions & Core Engine Operations', () => {
  let app: FastifyInstance;
  let orgId: string;
  let brandId: string;
  let outletId: string;
  let terminalId: string;
  let managerToken: string;
  let cashierToken: string;
  let managerUserId: string;
  let cashierUserId: string;
  let tableId: string;
  let menuItemId: string;
  let rawMaterialId: string;
  let uomId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Setup organization, brand, outlet, terminal
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Dawat Hospitality') RETURNING id`);
    orgId = orgRes.rows[0].id;

    const brandRes = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'Dawat Heritage') RETURNING id`, [orgId]);
    brandId = brandRes.rows[0].id;

    const outletRes = await query(
      `INSERT INTO outlets (
        brand_id, name, code, gstin, address, state_code, state_name,
        tax_mode, rounding_rule, target_food_cost_min, target_food_cost_max,
        target_labor_cost_min, target_labor_cost_max, target_prime_cost_max
      ) VALUES ($1, 'Dawat Express CP', 'OUT-CP01', '07AAAAA0000A1Z5', 'B-12 CP, New Delhi', '07', 'Delhi', 'no_itc_5', 'nearest_rupee', 28.0, 35.0, 25.0, 35.0, 60.0)
      RETURNING id`,
      [brandId]
    );
    outletId = outletRes.rows[0].id;

    const termRes = await query(
      `INSERT INTO terminals (outlet_id, terminal_code, name, invoice_series_code)
       VALUES ($1, 'T1', 'Main Billing Counter', 'T1')
       RETURNING id`,
      [outletId]
    );
    terminalId = termRes.rows[0].id;

    // 2. Roles
    const mgrRoleRes = await query(
      `INSERT INTO roles (name, description, discount_cap_percent, can_void_after_kot, can_approve_refund, permissions)
       VALUES ('Outlet Manager', 'Floor manager', 50.0, true, true, '["orders:write", "bills:discount", "void:approve", "shifts:close", "day_close:perform", "reports:read", "inventory:write", "payroll:run"]')
       RETURNING id`
    );
    const mgrRoleId = mgrRoleRes.rows[0].id;

    const cshRoleRes = await query(
      `INSERT INTO roles (name, description, discount_cap_percent, permissions)
       VALUES ('Cashier', 'POS operator', 10.0, '["orders:write", "bills:create", "payments:collect", "shifts:open"]')
       RETURNING id`
    );
    const cshRoleId = cshRoleRes.rows[0].id;

    // 3. Users
    const passwordHash = await hashSecret('Admin@1234');
    const mgrPinHash = await hashSecret('1234');
    const cshPinHash = await hashSecret('5678');

    const mgrUserRes = await query(
      `INSERT INTO users (email, password_hash, pin_hash, full_name)
       VALUES ('manager@dawat.com', $1, $2, 'Aarav Sharma')
       RETURNING id`,
      [passwordHash, mgrPinHash]
    );
    managerUserId = mgrUserRes.rows[0].id;

    const cshUserRes = await query(
      `INSERT INTO users (email, password_hash, pin_hash, full_name)
       VALUES ('cashier@dawat.com', $1, $2, 'Rohan Verma')
       RETURNING id`,
      [passwordHash, cshPinHash]
    );
    cashierUserId = cshUserRes.rows[0].id;

    // Map user outlet roles
    await query(
      `INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`,
      [managerUserId, outletId, mgrRoleId]
    );
    await query(
      `INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`,
      [cashierUserId, outletId, cshRoleId]
    );

    // 4. Floor table
    const secRes = await query(`INSERT INTO floor_areas (outlet_id, name) VALUES ($1, 'Main Dining') RETURNING id`, [outletId]);
    const tableRes = await query(`INSERT INTO tables (outlet_id, area_id, table_number, capacity) VALUES ($1, $2, 'T-01', 4) RETURNING id`, [outletId, secRes.rows[0].id]);
    tableId = tableRes.rows[0].id;

    // 5. Menu item
    const cat = await createCategory(outletId, 'Biryani Specials', 1);
    const item = await createMenuItem({
      outlet_id: outletId,
      category_id: cat.id,
      name: 'Dum Gosht Biryani',
      base_price_paise: 45000,
      tax_rate_percent: 5.0,
    });
    menuItemId = item.id;

    // 6. Raw material
    const uomRes = await query(`INSERT INTO uoms (name, symbol) VALUES ('Kilogram', 'kg') RETURNING id`);
    uomId = uomRes.rows[0].id;
    const matRes = await query(
      `INSERT INTO raw_materials (outlet_id, name, sku, uom_id, current_cost_paise, par_level, reorder_point)
       VALUES ($1, 'Basmati Rice Premium', 'RM-RICE-01', $2, 12000, 50, 10)
       RETURNING id`,
      [outletId, uomId]
    );
    rawMaterialId = matRes.rows[0].id;

    // Build the Fastify app
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /health returns 200, connected database and active C++ core engine', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.core_engine).toBe('active');
  });

  it('GET /docs returns 200 and OpenAPI Swagger interface', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toContain('ServeBase');
  });

  it('POST /api/v1/auth/login authenticates back-office manager with email/password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'manager@dawat.com',
        password: 'Admin@1234',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe('manager@dawat.com');
    managerToken = body.data.token;
  });

  it('POST /api/v1/auth/pin-login authenticates cashier via terminal PIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/pin-login',
      payload: {
        outlet_id: outletId,
        terminal_id: terminalId,
        pin: '5678',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.token).toBeDefined();
    cashierToken = body.data.token;
  });

  it('GET /api/v1/auth/me returns current user profile and authorized outlets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.user.userId).toBe(managerUserId);
    expect(body.data.user.roles.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/platform/businesses lists organizations and brands', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/businesses',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/menu/items returns outlet menu items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/menu/items',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].name).toBe('Dum Gosht Biryani');
  });

  it('GET /api/v1/floor/tables returns outlet floor layout', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/floor/tables',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].table_number).toBe('T-01');
  });

  let createdOrderId: string;
  let orderItemId: string;

  it('POST /api/v1/orders/create creates a new dine-in order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/create',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        order_type: 'dine_in',
        table_id: tableId,
        covers: 2,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe('open');
    createdOrderId = body.data.id;
  });

  it('POST /api/v1/orders/:id/items appends items to the active order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${createdOrderId}/items`,
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        items: [
          {
            menu_item_id: menuItemId,
            item_name: 'Dum Gosht Biryani',
            quantity: 2,
            unit_price_paise: 45000,
            course: 'main',
            station: 'kitchen',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    orderItemId = body.data[0].id;
  });

  let generatedKotId: string;

  it('POST /api/v1/orders/:id/kot generates kitchen order tickets (KOT)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${createdOrderId}/kot`,
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].kot_number).toBeDefined();
    generatedKotId = body.data[0].id;
  });

  it('GET /api/v1/kitchen/queue lists tickets in the KDS station queue', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kitchen/queue?station=kitchen',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/kitchen/bump updates KOT status to preparing / completed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kitchen/bump',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        kot_id: generatedKotId,
        station: 'kitchen',
        action: 'bump',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(['preparing', 'completed', 'bumped']).toContain(body.data.status);
  });

  it('POST /api/v1/billing/calculate executes C++ core engine price_bill calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/calculate',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        items: [
          { quantity: 2, unit_price_paise: 45000, tax_rate_percent: 5 },
        ],
        bill_discount_percent: 10,
        service_charge_percent: 5,
        service_charge_enabled: true,
        rounding_rule: 'nearest_rupee',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.subtotal_paise).toBe(90000);
    expect(body.data.bill_discount_paise).toBe(9000);
    expect(body.data.total_paise).toBeGreaterThan(0);
  });

  it('POST /api/v1/billing/split executes C++ core engine split_bill calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/split',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        bill: { total_paise: 100000 },
        split_type: 'equal',
        num_parts: 4,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.splits.length).toBe(4);
    expect(body.data.splits[0].total_paise).toBe(25000);
  });

  let generatedInvoiceId: string;

  it('POST /api/v1/billing/invoice issues sequential GST tax invoice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/invoice',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        order_id: createdOrderId,
        series_code: 'T1',
        invoice_type: 'tax_invoice',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.invoice_number).toMatch(/^T1\//);
    generatedInvoiceId = body.data.id;
  });

  it('POST /api/v1/payments/record records completed payment for invoice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/record',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        invoice_id: generatedInvoiceId,
        payment_method: 'upi',
        amount_paise: 94500,
        reference_id: 'UPI-REF-998822',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.payment.status).toBe('completed');
    expect(body.data.is_fully_paid).toBe(true);
  });

  let activeShiftId: string;

  it('POST /api/v1/shifts/open opens a register shift', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shifts/open',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        terminal_id: terminalId,
        opening_float_paise: 200000, // Rs 2,000 float
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeDefined();
    activeShiftId = body.data.id;
  });

  it('POST /api/v1/shifts/cash-movement records cash paid in / paid out', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shifts/cash-movement',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        shift_id: activeShiftId,
        movement_type: 'paid_out',
        amount_paise: 50000,
        reason: 'Vendor dairy petty purchase',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });

  it('POST /api/v1/shifts/close reconciles shift via C++ engine', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/shifts/close',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        shift_id: activeShiftId,
        actual_cash_paise: 150000,
        denominations: { '500': 3 },
        notes: 'Shift balanced successfully',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('closed');
  });

  it('POST /api/v1/inventory/adjust records stock movement', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        raw_material_id: rawMaterialId,
        quantity: 25.0,
        movement_type: 'purchase',
        unit_cost_paise: 12000,
        business_date: '2026-10-02',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /api/v1/inventory/items returns live stock on hand', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/items',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    const mat = body.data.find((m: any) => m.raw_material_id === rawMaterialId);
    expect(mat).toBeDefined();
    expect(mat.on_hand).toBe(25);
  });

  it('POST /api/v1/recipes/cost-breakdown executes C++ core explode_recipe calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/cost-breakdown',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        ordered_items: [{ menu_item_id: menuItemId, quantity: 2 }],
        recipes: [
          {
            menu_item_id: menuItemId,
            yield_portions: 1,
            ingredients: [{ raw_material_id: rawMaterialId, quantity: 0.25, wastage_percent: 5 }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.consumptions.length).toBeGreaterThan(0);
    expect(body.data.total_materials).toBeGreaterThan(0);
  });

  let createdEmployeeId: string;

  it('POST /api/v1/staff/employees creates a new staff employee', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/staff/employees',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        employee_code: 'EMP-001',
        first_name: 'Vikas',
        last_name: 'Khanna',
        role: 'Head Chef',
        salary_type: 'monthly',
        base_rate_paise: 6500000, // Rs 65,000 / month
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    createdEmployeeId = body.data.id;
  });

  it('POST /api/v1/staff/clock-in and clock-out registers staff attendance', async () => {
    const clockInRes = await app.inject({
      method: 'POST',
      url: '/api/v1/staff/clock-in',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        employee_id: createdEmployeeId,
        work_date: '2026-10-02',
      },
    });
    expect(clockInRes.statusCode).toBe(200);

    const clockOutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/staff/clock-out',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        employee_id: createdEmployeeId,
        work_date: '2026-10-02',
        break_minutes: 30,
      },
    });
    expect(clockOutRes.statusCode).toBe(200);
    expect(clockOutRes.json().ok).toBe(true);
  });

  it('POST /api/v1/payroll/run executes C++ compute_payroll calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payroll/run',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        month: 10,
        year: 2026,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.total_gross_paise).toBeGreaterThan(0);
  });

  it('GET /api/v1/accounting/trial-balance returns balanced ledger accounts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/trial-balance',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /api/v1/alerts/active returns real-time operational notifications', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/alerts/active',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });

  it('POST /api/v1/hotel/rooms and checkin manages hotel PMS guest folios', async () => {
    // 1. Create room
    const roomRes = await query(
      `INSERT INTO rooms (outlet_id, room_number, room_type, base_tariff_paise, status)
       VALUES ($1, 'Suite-401', 'Deluxe', 850000, 'clean')
       RETURNING id`,
      [outletId]
    );
    const roomId = roomRes.rows[0].id;

    // 2. Create guest
    const guestRes = await query(
      `INSERT INTO guests (name, phone, email, id_type, id_number)
       VALUES ('Dr. Vikram Patel', '+919876543210', 'patel@example.com', 'aadhaar', '998877665544')
       RETURNING id`
    );
    const guestId = guestRes.rows[0].id;

    // 3. Check-in
    const checkInRes = await app.inject({
      method: 'POST',
      url: '/api/v1/hotel/checkin',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        room_id: roomId,
        guest_id: guestId,
        credit_limit_paise: 5000000,
      },
    });
    expect(checkInRes.statusCode).toBe(200);
    const folio = checkInRes.json().data;
    expect(folio.id).toBeDefined();

    // 4. Post restaurant charge to room folio
    const chargeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/hotel/post-charge',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        room_number: 'Suite-401',
        amount_paise: 125000,
        description: 'Room service dining: Dum Biryani & Kebabs',
      },
    });
    expect(chargeRes.statusCode).toBe(200);
    expect(chargeRes.json().data.folio_balance_paise).toBe(125000);
  });

  it('POST /api/v1/channels/simulate-order accepts online delivery aggregator webhook', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/channels/simulate-order',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        channel_name: 'zomato',
        external_order_id: 'ZOM-992182',
        customer: {
          name: 'Pooja Hegde',
          phone: '+919811122233',
        },
        items: [
          {
            menu_item_id: menuItemId,
            item_name: 'Dum Gosht Biryani',
            quantity: 1,
            unit_price_paise: 45000,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.simulated).toBe(true);
    expect(body.data.order_id).toBeDefined();
  });

  it('GET /api/v1/audit/verify-chain verifies cryptographically linked audit hash chain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit/verify-chain',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.valid).toBe(true);
  });

  it('Security: Denies access without authorization header (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/businesses',
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('RBAC: Denies low-privilege cashier access to manager-only endpoints (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payroll/run',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: { month: 11, year: 2026 },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
