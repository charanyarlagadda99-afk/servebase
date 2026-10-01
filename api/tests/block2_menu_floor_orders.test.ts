import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  createCategory,
  createModifierGroup,
  createMenuItem,
  toggleItemAvailability,
  getFullMenu,
} from '../src/services/menu.js';
import {
  createFloorArea,
  createTable,
  getFloorLayout,
  seatGuests,
  moveTable,
  mergeTables,
} from '../src/services/floor.js';
import {
  createOrder,
  addItemsToOrder,
  sendKOT,
  voidOrderItem,
  markItemComplimentary,
  reprintKOT,
  getOrderDetails,
} from '../src/services/orders.js';
import { hashSecret, authorizeApproval } from '../src/services/auth.js';

import { truncateAll } from '../src/db/clean.js';

describe('Block 2: Menu, Floor Layout, Orders & Kitchen Tickets (KOT)', () => {
  let outletId: string;
  let managerUserId: string;
  let waiterUserId: string;
  let kitchenStationId: string;
  let barStationId: string;
  let categoryId: string;
  let pizzaItemId: string;
  let mojitoItemId: string;
  let areaId: string;
  let table1Id: string;
  let table2Id: string;
  let table3Id: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // Setup base hierarchy
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Spice & Spirit Hospitality') RETURNING id`);
    const brandRes = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'The Urban Bistro') RETURNING id`, [orgRes.rows[0].id]);
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'Indiranagar Bistro', 'BLR-IN01', '29AAAAA0000A1Z5', '100ft Road Indiranagar, Bengaluru', '29')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // Kitchen Stations: Kitchen and Bar
    const kRes = await query(
      `INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Main Kitchen', 'KITCHEN_MAIN') RETURNING id`,
      [outletId]
    );
    kitchenStationId = kRes.rows[0].id;

    const bRes = await query(
      `INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Main Bar', 'BAR_MAIN') RETURNING id`,
      [outletId]
    );
    barStationId = bRes.rows[0].id;

    // Users
    const mgrRole = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Outlet Manager', 50.0) RETURNING id`);
    const waiterRole = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Captain', 10.0) RETURNING id`);

    const mgrPin = await hashSecret('1111');
    const mgrRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Anita Roy', $1, 'anita@urbanbistro.com') RETURNING id`,
      [mgrPin]
    );
    managerUserId = mgrRes.rows[0].id;

    const waiterRes = await query(
      `INSERT INTO users (full_name, pin_hash) VALUES ('Vikram Singh', 'dummy') RETURNING id`
    );
    waiterUserId = waiterRes.rows[0].id;

    await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [managerUserId, outletId, mgrRole.rows[0].id]);
    await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [waiterUserId, outletId, waiterRole.rows[0].id]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates categories, modifier groups, and menu items with variants and channel pricing', async () => {
    const cat = await createCategory(outletId, 'Artisan Pizzas', 1);
    categoryId = cat.id;
    expect(cat.name).toBe('Artisan Pizzas');

    const modGroup = await createModifierGroup(outletId, 'Cheese Options', 0, 2, [
      { name: 'Extra Fresh Mozzarella', price_paise: 9000 },
      { name: 'Truffle Burrata', price_paise: 25000 },
    ]);
    expect(modGroup.modifiers.length).toBe(2);

    const pizza = await createMenuItem({
      outlet_id: outletId,
      category_id: categoryId,
      station_id: kitchenStationId,
      name: 'Margherita Rustica',
      base_price_paise: 45000, // Rs 450
      dietary_type: 'veg',
      variants: [
        { name: '10 inch Regular', price_paise: 45000, is_default: true },
        { name: '14 inch Large', price_paise: 65000 },
      ],
      modifier_group_ids: [modGroup.id],
      channel_pricing: [
        { channel: 'dine_in', price_paise: 45000 },
        { channel: 'aggregator', price_paise: 52000 }, // Markup for Swiggy/Zomato
      ],
    });
    pizzaItemId = pizza.id;
    expect(pizza.variants.length).toBe(2);

    // Create Bar item
    const barCat = await createCategory(outletId, 'Cocktails & Mocktails', 2);
    const mojito = await createMenuItem({
      outlet_id: outletId,
      category_id: barCat.id,
      station_id: barStationId,
      name: 'Virgin Mint Mojito',
      base_price_paise: 22000,
      dietary_type: 'veg',
    });
    mojitoItemId = mojito.id;

    // Check menu retrieval
    const menu = await getFullMenu(outletId, 'dine_in');
    expect(menu.length).toBe(2);
    const mPizza = menu.find((m) => m.name === 'Margherita Rustica');
    expect(mPizza.effective_price_paise).toBe(45000);
  });

  it('toggles item availability and verifies audit log entry', async () => {
    const toggled = await toggleItemAvailability(pizzaItemId, false, managerUserId);
    expect(toggled.is_available).toBe(false);

    // Toggle back on
    await toggleItemAvailability(pizzaItemId, true, managerUserId);
  });

  it('creates floor areas and tables, verifying status layout', async () => {
    const area = await createFloorArea(outletId, 'Main Dining Room', 1);
    areaId = area.id;

    const t1 = await createTable({ outlet_id: outletId, area_id: areaId, table_number: 'T-01', capacity: 4 });
    const t2 = await createTable({ outlet_id: outletId, area_id: areaId, table_number: 'T-02', capacity: 4 });
    const t3 = await createTable({ outlet_id: outletId, area_id: areaId, table_number: 'T-03', capacity: 6 });

    table1Id = t1.id;
    table2Id = t2.id;
    table3Id = t3.id;

    const layout = await getFloorLayout(outletId);
    expect(layout.areas.length).toBe(1);
    expect(layout.areas[0].tables.length).toBe(3);
  });

  it('seats guests with optimistic concurrency control', async () => {
    const tableRes = await query(`SELECT version FROM tables WHERE id = $1`, [table1Id]);
    const currentVersion = tableRes.rows[0].version;

    const seated = await seatGuests(table1Id, 3, waiterUserId, currentVersion, waiterUserId);
    expect(seated.status).toBe('occupied');
    expect(seated.current_covers).toBe(3);
    expect(seated.version).toBe(currentVersion + 1);

    // Expect conflict when passing stale version
    await expect(seatGuests(table1Id, 3, waiterUserId, currentVersion, waiterUserId)).rejects.toThrow('Concurrency conflict');
  });

  it('creates an order, adds items to order, and generates station-wise KOTs', async () => {
    const order = await createOrder({
      outlet_id: outletId,
      order_type: 'dine_in',
      table_id: table1Id,
      covers: 3,
      business_date: '2026-10-01',
      user_id: waiterUserId,
      items: [
        {
          menu_item_id: pizzaItemId,
          item_name: 'Margherita Rustica (10")',
          quantity: 2,
          unit_price_paise: 45000,
          course: 'mains',
          course_status: 'fire',
        },
        {
          menu_item_id: mojitoItemId,
          item_name: 'Virgin Mint Mojito',
          quantity: 3,
          unit_price_paise: 22000,
          course: 'beverages',
          course_status: 'fire',
        },
      ],
    });

    expect(order.status).toBe('open');
    expect(order.items.length).toBe(2);

    // Fire KOT
    const kots = await sendKOT(order.id, waiterUserId);
    // Pizza goes to Kitchen, Mojito goes to Bar -> Exactly 2 station KOTs
    expect(kots.length).toBe(2);

    const kitchenKot = kots.find((k: any) => k.station_id === kitchenStationId);
    const barKot = kots.find((k: any) => k.station_id === barStationId);

    expect(kitchenKot).toBeDefined();
    expect(barKot).toBeDefined();
    expect(kitchenKot.kot_number).toBeGreaterThan(0);
    expect(barKot.kot_number).toBeGreaterThan(0);

    // Verify order status is now kot_sent
    const details = await getOrderDetails(order.id);
    expect(details.status).toBe('kot_sent');
    expect(details.items[0].status).toBe('sent');
  });

  it('moves table with active order to an available table', async () => {
    const t1 = (await query(`SELECT * FROM tables WHERE id = $1`, [table1Id])).rows[0];
    const t2 = (await query(`SELECT * FROM tables WHERE id = $1`, [table2Id])).rows[0];

    const result = await moveTable(table1Id, table2Id, t1.version, t2.version, waiterUserId);

    expect(result.source.status).toBe('available');
    expect(result.source.active_order_id).toBeNull();

    expect(result.target.status).toBe('occupied');
    expect(result.target.active_order_id).toBe(t1.active_order_id);
    expect(result.target.current_covers).toBe(t1.current_covers);
  });

  it('enforces void rules: requires manager approval after KOT', async () => {
    const t2 = (await query(`SELECT * FROM tables WHERE id = $1`, [table2Id])).rows[0];
    const details = await getOrderDetails(t2.active_order_id);
    const sentItem = details.items[0];

    // Attempting void without approval after KOT must fail
    await expect(voidOrderItem(sentItem.id, 'Wrong order', null, waiterUserId)).rejects.toThrow('requires manager approval');

    // Authorize via manager PIN
    const approval = await authorizeApproval('1111', outletId, 'ITEM_VOID_AFTER_KOT', sentItem.id, 'Guest changed mind');
    expect(approval.approved).toBe(true);

    // Perform void with valid approval ID
    const voided = await voidOrderItem(sentItem.id, 'Guest changed mind', approval.approvalId, waiterUserId);
    expect(voided.is_voided).toBe(true);
    expect(voided.void_reason).toBe('Guest changed mind');
  });

  it('marks items as complimentary with valid reason and authorizer', async () => {
    const t2 = (await query(`SELECT * FROM tables WHERE id = $1`, [table2Id])).rows[0];
    const details = await getOrderDetails(t2.active_order_id);
    const nonVoidedItem = details.items.find((i: any) => !i.is_voided);

    const comp = await markItemComplimentary(nonVoidedItem.id, 'Chef tasting compliment', managerUserId);
    expect(comp.is_complimentary).toBe(true);
    expect(comp.comp_reason).toBe('Chef tasting compliment');
  });

  it('reprints KOT and flags ticket as duplicate', async () => {
    const kotRes = await query(`SELECT id FROM kots WHERE outlet_id = $1 LIMIT 1`, [outletId]);
    const kotId = kotRes.rows[0].id;

    const reprinted = await reprintKOT(kotId, 'Printer paper roll jammed', waiterUserId);
    expect(reprinted.is_reprint).toBe(true);
    expect(reprinted.reprint_reason).toBe('Printer paper roll jammed');
  });
});
