import { query, pool, withTransaction } from './pool.js';
import { runMigrations } from './migrate.js';
import { truncateAll } from './clean.js';
import { hashSecret } from '../services/auth.js';
import { createFloorArea, createTable } from '../services/floor.js';
import { createCategory, createMenuItem } from '../services/menu.js';
import { createRoom, checkInGuest, createGuest } from '../services/hotel.js';
import { createUOM, createRawMaterial, recordStockMovement } from '../services/inventory.js';
import { createVendor, createGoodsReceiptNote } from '../services/purchasing.js';
import { createRecipe } from '../services/recipes.js';
import { initStandardChartOfAccounts } from '../services/accounting.js';
import { createEmployee } from '../services/staff.js';

export async function runSeed(daysToGenerate = 90) {
  console.log(`[SEED] Initializing ServeBase seed generation for ${daysToGenerate} days...`);
  await runMigrations();
  await truncateAll();

  // 1. Organization
  const orgRes = await query(
    `INSERT INTO organizations (name) VALUES ('Imperial Heritage Hospitality Ltd') RETURNING id`
  );
  const orgId = orgRes.rows[0].id;
  await initStandardChartOfAccounts(orgId);

  // 2. Brands & Outlets
  const brand1 = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'Dawat Heritage') RETURNING id`, [orgId]);
  const brand2 = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'The Brew Table') RETURNING id`, [orgId]);
  const brand3 = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'Coastal Tides') RETURNING id`, [orgId]);
  const brand4 = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'The Grand Heritage Hotel') RETURNING id`, [orgId]);

  const outletDawat = await query(
    `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code, current_business_date)
     VALUES ($1, 'Dawat Fine Dine CP', 'DEL-DAW01', '07AAAAA0000A1Z5', 'Connaught Place New Delhi', '07', '2026-10-01')
     RETURNING id`,
    [brand1.rows[0].id]
  );
  const dawatOutletId = outletDawat.rows[0].id;

  const outletCafe = await query(
    `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code, current_business_date)
     VALUES ($1, 'The Brew Table Indiranagar', 'BLR-BRW01', '29AAAAA0000A1Z5', '100ft Road Indiranagar Bangalore', '29', '2026-10-01')
     RETURNING id`,
    [brand2.rows[0].id]
  );
  const cafeOutletId = outletCafe.rows[0].id;

  const outletHotel = await query(
    `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code, current_business_date)
     VALUES ($1, 'The Grand Heritage Jaipur', 'JAI-GRH01', '08AAAAA0000A1Z5', 'Civil Lines Jaipur', '08', '2026-10-01')
     RETURNING id`,
    [brand4.rows[0].id]
  );
  const hotelOutletId = outletHotel.rows[0].id;

  // 3. Roles and Permissions
  const roleMgr = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('General Manager', 100.0) RETURNING id`);
  const roleChef = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Head Chef', 0.0) RETURNING id`);
  const roleCashier = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Cashier', 10.0) RETURNING id`);
  const roleWaiter = await query(`INSERT INTO roles (name, discount_cap_percent) VALUES ('Captain', 5.0) RETURNING id`);

  const pinHash1234 = await hashSecret('1234');
  const pinHash5678 = await hashSecret('5678');
  const pinHash9999 = await hashSecret('9999');
  const pwdHash = await hashSecret('Admin@1234');

  // Users
  const user1 = await query(
    `INSERT INTO users (full_name, pin_hash, password_hash, email) VALUES ('Rajiv Singhania', $1, $2, 'manager@dawat.com') RETURNING id`,
    [pinHash1234, pwdHash]
  );
  const user2 = await query(
    `INSERT INTO users (full_name, pin_hash, password_hash, email) VALUES ('Pooja Verma', $1, $2, 'cashier@dawat.com') RETURNING id`,
    [pinHash5678, pwdHash]
  );
  const user3 = await query(
    `INSERT INTO users (full_name, pin_hash, password_hash, email) VALUES ('Sanjeev Kapoor', $1, $2, 'chef@dawat.com') RETURNING id`,
    [pinHash9999, pwdHash]
  );
  const gmUserId = user1.rows[0].id;
  const cashierUserId = user2.rows[0].id;
  const chefUserId = user3.rows[0].id;

  await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [gmUserId, dawatOutletId, roleMgr.rows[0].id]);
  await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [cashierUserId, dawatOutletId, roleCashier.rows[0].id]);
  await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [chefUserId, dawatOutletId, roleChef.rows[0].id]);

  // Terminals
  const term1 = await query(
    `INSERT INTO terminals (outlet_id, name, terminal_code, invoice_series_code)
     VALUES ($1, 'POS Terminal 1', 'T1', 'T1') RETURNING id`,
    [dawatOutletId]
  );
  const terminal1Id = term1.rows[0].id;

  // 4. Kitchen Stations
  const stTandoor = await query(`INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Tandoor & Kebab', 'TAND') RETURNING id`, [dawatOutletId]);
  const stCurry = await query(`INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Curry & Gravy', 'CURR') RETURNING id`, [dawatOutletId]);
  const stBar = await query(`INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Beverage Bar', 'BAR') RETURNING id`, [dawatOutletId]);
  const stPantry = await query(`INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Pantry & Cold', 'PAN') RETURNING id`, [dawatOutletId]);
  const stDessert = await query(`INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Desserts & Sweets', 'DES') RETURNING id`, [dawatOutletId]);

  // 5. Floor & Tables
  const areaHall = await createFloorArea(dawatOutletId, 'Main Royal Hall', 1);
  const areaTerrace = await createFloorArea(dawatOutletId, 'Terrace Courtyard', 2);
  const areaBar = await createFloorArea(dawatOutletId, 'Bar & Lounge', 3);

  const tables: any[] = [];
  // Main Hall: T-1 to T-5
  for (let i = 1; i <= 5; i++) {
    const t = await createTable({
      outlet_id: dawatOutletId,
      area_id: areaHall.id,
      table_number: `T-${i}`,
      capacity: i % 2 === 0 ? 4 : 2,
    });
    tables.push(t);
  }
  // Terrace Courtyard: T-6 to T-8
  for (let i = 6; i <= 8; i++) {
    const t = await createTable({
      outlet_id: dawatOutletId,
      area_id: areaTerrace.id,
      table_number: `T-${i}`,
      capacity: i === 6 ? 6 : 4,
    });
    tables.push(t);
  }
  // Bar & Lounge: B-1, B-2
  for (let i = 1; i <= 2; i++) {
    const t = await createTable({
      outlet_id: dawatOutletId,
      area_id: areaBar.id,
      table_number: `B-${i}`,
      capacity: 2,
    });
    tables.push(t);
  }

  // 6. UOMs & Raw Materials
  const uomKg = await createUOM({ name: 'Kilogram', symbol: 'kg' });
  const uomL = await createUOM({ name: 'Litre', symbol: 'l' });
  const uomPcs = await createUOM({ name: 'Pieces', symbol: 'pcs' });

  const matPaneer = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Malai Paneer', sku: 'RAW-PAN-01', uom_id: uomKg.id, current_cost_paise: 32000, par_level: 25, reorder_point: 15 });
  const matChicken = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Chicken Boneless', sku: 'RAW-CHK-01', uom_id: uomKg.id, current_cost_paise: 26000, par_level: 30, reorder_point: 20 });
  const matRice = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Basmati Rice', sku: 'RAW-RIC-01', uom_id: uomKg.id, current_cost_paise: 9500, par_level: 50, reorder_point: 30 });
  const matButter = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Table Butter', sku: 'RAW-BUT-01', uom_id: uomKg.id, current_cost_paise: 44000, par_level: 20, reorder_point: 10 });
  const matCream = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Fresh Cooking Cream', sku: 'RAW-CRM-01', uom_id: uomL.id, current_cost_paise: 21000, par_level: 15, reorder_point: 8 });
  const matSpices = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Shahi Garam Masala', sku: 'RAW-SPC-01', uom_id: uomKg.id, current_cost_paise: 85000, par_level: 10, reorder_point: 5 });

  // 7. Initial Stock Intake via Vendor GRN
  const vendor = await createVendor({ name: 'Heritage Farm Supplies', gstin: '07AAACH9911A1Z0' });
  await createGoodsReceiptNote({
    outlet_id: dawatOutletId,
    vendor_id: vendor.id,
    vendor_invoice_number: 'HERITAGE-INIT-01',
    received_date: '2026-07-01',
    received_by: gmUserId,
    items: [
      { raw_material_id: matPaneer.id, po_qty: 500, received_qty: 500, unit_price_paise: 32000 },
      { raw_material_id: matChicken.id, po_qty: 600, received_qty: 600, unit_price_paise: 26000 },
      { raw_material_id: matRice.id, po_qty: 1000, received_qty: 1000, unit_price_paise: 9500 },
      { raw_material_id: matButter.id, po_qty: 300, received_qty: 300, unit_price_paise: 44000 },
      { raw_material_id: matCream.id, po_qty: 200, received_qty: 200, unit_price_paise: 21000 },
      { raw_material_id: matSpices.id, po_qty: 100, received_qty: 100, unit_price_paise: 85000 },
    ],
  });

  // 8. Menu Items & Recipes
  const catStarters = await createCategory(dawatOutletId, 'Starters', 1);
  const catMains = await createCategory(dawatOutletId, 'Main Curries', 2);
  const catBreads = await createCategory(dawatOutletId, 'Biryani & Breads', 3);
  const catDesserts = await createCategory(dawatOutletId, 'Desserts', 4);
  const catBeverages = await createCategory(dawatOutletId, 'Beverages', 5);

  const dishTikka = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catStarters.id,
    station_id: stTandoor.rows[0].id,
    name: 'Murgh Malai Tikka',
    base_price_paise: 46000,
  });

  const dishPaneerTikka = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catStarters.id,
    station_id: stTandoor.rows[0].id,
    name: 'Paneer Tikka Angaarey',
    base_price_paise: 38000,
  });

  const dishDahiKebab = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catStarters.id,
    station_id: stPantry.rows[0].id,
    name: 'Dahi Ke Kebab',
    base_price_paise: 34000,
  });

  const dishSeekh = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catStarters.id,
    station_id: stTandoor.rows[0].id,
    name: 'Seekh Kebab Gilafi',
    base_price_paise: 49000,
  });

  const dishPaneer = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catMains.id,
    station_id: stCurry.rows[0].id,
    name: 'Paneer Makhani',
    base_price_paise: 44000,
  });

  const dishButterChicken = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catMains.id,
    station_id: stCurry.rows[0].id,
    name: 'Butter Chicken Grand Trunk',
    base_price_paise: 54000,
  });

  const dishDalMakhani = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catMains.id,
    station_id: stCurry.rows[0].id,
    name: 'Dal Makhani Bukhara',
    base_price_paise: 39000,
  });

  const dishPaneerLababdar = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catMains.id,
    station_id: stCurry.rows[0].id,
    name: 'Paneer Lababdar',
    base_price_paise: 44000,
  });

  const dishBiryani = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catBreads.id,
    station_id: stCurry.rows[0].id,
    name: 'Dum Biryani Awadhi',
    base_price_paise: 48000,
  });

  const dishNaan = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catBreads.id,
    station_id: stTandoor.rows[0].id,
    name: 'Tandoori Garlic Butter Naan',
    base_price_paise: 11000,
  });

  const dishRoti = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catBreads.id,
    station_id: stTandoor.rows[0].id,
    name: 'Roomali Roti',
    base_price_paise: 8000,
  });

  const dishPhirni = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catDesserts.id,
    station_id: stDessert.rows[0].id,
    name: 'Kesari Phirni',
    base_price_paise: 22000,
  });

  const dishJamun = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catDesserts.id,
    station_id: stDessert.rows[0].id,
    name: 'Gulab Jamun Shahi',
    base_price_paise: 18000,
  });

  const dishChaas = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catBeverages.id,
    station_id: stBar.rows[0].id,
    name: 'Masala Chaas',
    base_price_paise: 14000,
  });

  const dishLimeSoda = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catBeverages.id,
    station_id: stBar.rows[0].id,
    name: 'Darjeeling Fresh Lime Soda',
    base_price_paise: 16000,
  });

  // Recipes
  await createRecipe({
    menu_item_id: dishPaneer.id,
    yield_portions: 1.0,
    ingredients: [
      { raw_material_id: matPaneer.id, quantity: 0.25, uom_id: uomKg.id, wastage_percent: 5.0 },
      { raw_material_id: matButter.id, quantity: 0.05, uom_id: uomKg.id, wastage_percent: 0.0 },
    ],
  });

  await createRecipe({
    menu_item_id: dishTikka.id,
    yield_portions: 1.0,
    ingredients: [
      { raw_material_id: matChicken.id, quantity: 0.30, uom_id: uomKg.id, wastage_percent: 10.0 },
    ],
  });

  // 9. Hotel Rooms (20 Rooms in Jaipur Hotel)
  const hotelRooms = [];
  for (let r = 101; r <= 110; r++) {
    const rm = await createRoom({
      outlet_id: hotelOutletId,
      room_number: String(r),
      room_type: 'Deluxe Heritage Room',
      base_tariff_paise: 650000, // Rs 6,500
    });
    hotelRooms.push(rm);
  }
  for (let r = 201; r <= 208; r++) {
    const rm = await createRoom({
      outlet_id: hotelOutletId,
      room_number: String(r),
      room_type: 'Palace Executive Suite',
      base_tariff_paise: 1200000, // Rs 12,000
    });
    hotelRooms.push(rm);
  }
  for (let r = 301; r <= 302; r++) {
    const rm = await createRoom({
      outlet_id: hotelOutletId,
      room_number: String(r),
      room_type: 'Maharaja Presidential Suite',
      base_tariff_paise: 2500000, // Rs 25,000
    });
    hotelRooms.push(rm);
  }

  // Check in sample guests
  const sampleGuest1 = await createGuest({
    name: 'Maharaja Gaj Singh',
    phone: '+919829012345',
    email: 'gajsingh@heritage.in',
  });
  await checkInGuest(hotelOutletId, hotelRooms[0].id, sampleGuest1.id, 10000000);

  const sampleGuest2 = await createGuest({
    name: 'Vikramaditya Roy',
    phone: '+919876543210',
    email: 'vikram@roy.com',
  });
  await checkInGuest(hotelOutletId, hotelRooms[1].id, sampleGuest2.id, 5000000);

  const sampleGuest3 = await createGuest({
    name: 'Dr. Farhan Qureshi',
    phone: '+919811223344',
    email: 'farhan@delhihealth.org',
  });
  await checkInGuest(hotelOutletId, hotelRooms[10].id, sampleGuest3.id, 15000000);

  // 10. Staff Employees
  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-001',
    first_name: 'Rajiv',
    last_name: 'Singhania',
    role: 'manager',
    phone: '+91 98765 43210',
    salary_type: 'monthly',
    base_rate_paise: 8500000,
  });

  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-002',
    first_name: 'Pooja',
    last_name: 'Verma',
    role: 'cashier',
    phone: '+91 98765 43211',
    salary_type: 'monthly',
    base_rate_paise: 3200000,
  });

  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-003',
    first_name: 'Sanjeev',
    last_name: 'Kapoor',
    role: 'head_chef',
    phone: '+91 98765 43212',
    salary_type: 'monthly',
    base_rate_paise: 7500000,
  });

  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-004',
    first_name: 'Vikram',
    last_name: 'Sethi',
    role: 'line_cook',
    phone: '+91 98765 43213',
    salary_type: 'monthly',
    base_rate_paise: 3500000,
  });

  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-005',
    first_name: 'Rahul',
    last_name: 'Sharma',
    role: 'waiter',
    phone: '+91 98765 43214',
    salary_type: 'monthly',
    base_rate_paise: 2800000,
  });

  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-006',
    first_name: 'Rohan',
    last_name: 'Mehra',
    role: 'bartender',
    phone: '+91 98765 43215',
    salary_type: 'monthly',
    base_rate_paise: 3000000,
  });

  // 11. Active Operational Orders, Tables & Live KOTs
  // Table T-2: Occupied
  const activeOrd1 = await query(
    `INSERT INTO orders (outlet_id, terminal_id, order_type, table_id, status, covers, business_date, created_by_user_id)
     VALUES ($1, $2, 'dine_in', $3, 'occupied', 2, '2026-10-01', $4) RETURNING id`,
    [dawatOutletId, terminal1Id, tables[1].id, gmUserId]
  );
  await query(`UPDATE tables SET status = 'occupied', active_order_id = $1, current_covers = 2 WHERE id = $2`, [activeOrd1.rows[0].id, tables[1].id]);

  const ordItem1 = await query(
    `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price_paise, course, course_status, status, notes)
     VALUES ($1, $2, 'Paneer Tikka Angaarey', 1, 38000, 'starter', 'fire', 'sent', 'Crispy charred') RETURNING id`,
    [activeOrd1.rows[0].id, dishPaneerTikka.id]
  );
  const ordItem2 = await query(
    `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price_paise, course, course_status, status)
     VALUES ($1, $2, 'Butter Chicken Grand Trunk', 1, 54000, 'main', 'hold', 'sent') RETURNING id`,
    [activeOrd1.rows[0].id, dishButterChicken.id]
  );

  const activeKot1 = await query(
    `INSERT INTO kots (outlet_id, order_id, station_id, kot_number, status, created_at)
     VALUES ($1, $2, $3, 101, 'sent', NOW() - INTERVAL '12 minutes') RETURNING id`,
    [dawatOutletId, activeOrd1.rows[0].id, stTandoor.rows[0].id]
  );
  await query(
    `INSERT INTO kot_items (kot_id, order_item_id, quantity, status)
     VALUES ($1, $2, 1, 'queued')`,
    [activeKot1.rows[0].id, ordItem1.rows[0].id]
  );

  // Table T-4: Billed
  const activeOrd2 = await query(
    `INSERT INTO orders (outlet_id, terminal_id, order_type, table_id, status, covers, business_date, created_by_user_id)
     VALUES ($1, $2, 'dine_in', $3, 'billed', 4, '2026-10-01', $4) RETURNING id`,
    [dawatOutletId, terminal1Id, tables[3].id, cashierUserId]
  );
  await query(`UPDATE tables SET status = 'billed', active_order_id = $1, current_covers = 4 WHERE id = $2`, [activeOrd2.rows[0].id, tables[3].id]);

  const ordItem3 = await query(
    `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price_paise, course, course_status, status)
     VALUES ($1, $2, 'Dal Makhani Bukhara', 2, 39000, 'main', 'fire', 'sent') RETURNING id`,
    [activeOrd2.rows[0].id, dishDalMakhani.id]
  );
  const activeKot2 = await query(
    `INSERT INTO kots (outlet_id, order_id, station_id, kot_number, status, created_at)
     VALUES ($1, $2, $3, 102, 'sent', NOW() - INTERVAL '6 minutes') RETURNING id`,
    [dawatOutletId, activeOrd2.rows[0].id, stCurry.rows[0].id]
  );
  await query(
    `INSERT INTO kot_items (kot_id, order_item_id, quantity, status)
     VALUES ($1, $2, 2, 'preparing')`,
    [activeKot2.rows[0].id, ordItem3.rows[0].id]
  );

  // Bar Table B-2: Occupied
  const activeOrd3 = await query(
    `INSERT INTO orders (outlet_id, terminal_id, order_type, table_id, status, covers, business_date, created_by_user_id)
     VALUES ($1, $2, 'dine_in', $3, 'occupied', 2, '2026-10-01', $4) RETURNING id`,
    [dawatOutletId, terminal1Id, tables[9].id, cashierUserId]
  );
  await query(`UPDATE tables SET status = 'occupied', active_order_id = $1, current_covers = 2 WHERE id = $2`, [activeOrd3.rows[0].id, tables[9].id]);

  const ordItem4 = await query(
    `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price_paise, course, course_status, status, notes)
     VALUES ($1, $2, 'Darjeeling Fresh Lime Soda', 2, 16000, 'beverage', 'fire', 'sent', 'Less sweet') RETURNING id`,
    [activeOrd3.rows[0].id, dishLimeSoda.id]
  );
  const activeKot3 = await query(
    `INSERT INTO kots (outlet_id, order_id, station_id, kot_number, status, created_at)
     VALUES ($1, $2, $3, 103, 'sent', NOW() - INTERVAL '3 minutes') RETURNING id`,
    [dawatOutletId, activeOrd3.rows[0].id, stBar.rows[0].id]
  );
  await query(
    `INSERT INTO kot_items (kot_id, order_item_id, quantity, status)
     VALUES ($1, $2, 2, 'ready')`,
    [activeKot3.rows[0].id, ordItem4.rows[0].id]
  );

  // Table T-6: Reserved
  await query(`UPDATE tables SET status = 'reserved', current_covers = 6 WHERE id = $1`, [tables[5].id]);

  // System Alerts
  await query(
    `INSERT INTO system_alerts (outlet_id, alert_type, severity, message, is_read)
     VALUES 
     ($1, 'low_stock', 'warning', 'Fresh Malai Paneer stock is below reorder threshold (18 kg < 25 kg)', false),
     ($1, 'approval_required', 'info', 'Table T-4 requested 20% bill discount. Approved by Rajiv Singhania.', false),
     ($1, 'security_seal', 'info', 'Linear cryptographic ledger verified. 142 chained blocks intact.', false)`,
    [dawatOutletId]
  );

  console.log(`[SEED] Master data configured successfully. Generating ${daysToGenerate} days of operational activity...`);

  // 11. Generate daily transactions over past N days
  // Date calculation: start from (today - daysToGenerate)
  const baseDate = new Date('2026-10-01');

  for (let d = daysToGenerate; d >= 1; d--) {
    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() - d);
    const dateStr = currentDate.toISOString().slice(0, 10);
    const fyCode = '26-27';

    // Fast-path transaction generation for realistic sales & invoices
    // Generate 4 lunch orders & 6 dinner orders per day
    const dailyOrdersCount = 10;
    let dayTotalGross = 0;
    let dayTotalTax = 0;

    for (let o = 1; o <= dailyOrdersCount; o++) {
      const isVeg = o % 2 === 0;
      const dish = isVeg ? dishPaneer : dishTikka;
      const qty = (o % 3) + 1;
      const subtotal = dish.base_price_paise * qty;
      const tax = Math.round(subtotal * 0.05); // 5% GST
      const total = subtotal + tax;

      dayTotalGross += total;
      dayTotalTax += tax;

      // Allocate consecutive invoice number
      const cntRes = await query(
        `INSERT INTO invoice_counters (outlet_id, series_code, financial_year, last_number)
         VALUES ($1, 'T1', $2, 1)
         ON CONFLICT (outlet_id, series_code, financial_year)
         DO UPDATE SET last_number = invoice_counters.last_number + 1
         RETURNING last_number`,
        [dawatOutletId, fyCode]
      );
      const invNum = `T1/${fyCode}/${String(cntRes.rows[0].last_number).padStart(5, '0')}`;

      // Insert dummy order
      const ordRes = await query(
        `INSERT INTO orders (
          outlet_id, terminal_id, order_type, table_id, status, covers, business_date, created_by_user_id
        ) VALUES ($1, $2, 'dine_in', $3, 'paid', $4, $5, $6)
        RETURNING id`,
        [dawatOutletId, terminal1Id, tables[o % tables.length].id, 2, dateStr, cashierUserId]
      );

      // Insert invoice
      const invRes = await query(
        `INSERT INTO invoices (
          outlet_id, terminal_id, order_id, invoice_number, financial_year, business_date,
          invoice_type, supplier_gstin, subtotal_paise, taxable_value_paise, cgst_paise,
          sgst_paise, total_paise, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'tax_invoice', '07AAAAA0000A1Z5', $7, $7, $8, $8, $9, 'issued')
        RETURNING id`,
        [dawatOutletId, terminal1Id, ordRes.rows[0].id, invNum, fyCode, dateStr, subtotal, Math.round(tax / 2), total]
      );

      // Insert payment (50% cash, 50% UPI)
      const pmtMethod = o % 2 === 0 ? 'cash' : 'upi';
      await query(
        `INSERT INTO payments (
          outlet_id, invoice_id, order_id, payment_method, amount_paise, idempotency_key, simulated
        ) VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [dawatOutletId, invRes.rows[0].id, ordRes.rows[0].id, pmtMethod, total, `SEED-PAY-${d}-${o}`]
      );

      // Record recipe inventory consumption
      const consumedQty = isVeg ? 0.25 * qty : 0.30 * qty;
      const consumedMat = isVeg ? matPaneer.id : matChicken.id;
      const consumedCost = isVeg ? 32000 : 26000;
      await query(
        `INSERT INTO stock_ledger (
          outlet_id, raw_material_id, movement_type, quantity, unit_cost_paise, total_value_paise, business_date
        ) VALUES ($1, $2, 'sale_consumption', $3, $4, $5, $6)`,
        [dawatOutletId, consumedMat, -consumedQty, consumedCost, Math.round(consumedQty * consumedCost), dateStr]
      );
    }

    // Day Close Z-Report record
    const zReportSummary = {
      business_date: dateStr,
      gross_sales_paise: dayTotalGross,
      net_sales_paise: dayTotalGross - dayTotalTax,
      total_invoices: dailyOrdersCount,
      total_covers: dailyOrdersCount * 2,
    };

    await query(
      `INSERT INTO day_closes (outlet_id, business_date, closed_by_user_id, summary_data)
       VALUES ($1, $2, $3, $4)`,
      [dawatOutletId, dateStr, gmUserId, JSON.stringify(zReportSummary)]
    );
  }

  console.log(`[SEED] Successfully seeded 90 days of complete hospitality operations data!`);
}

// Standalone execution check
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed(90)
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED] Failed:', err);
      process.exit(1);
    });
}
