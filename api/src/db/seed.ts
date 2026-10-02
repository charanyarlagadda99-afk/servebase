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

  // Users
  const user1 = await query(
    `INSERT INTO users (full_name, pin_hash, email) VALUES ('Rajiv Singhania', $1, 'rajiv@imperial.in') RETURNING id`,
    [pinHash1234]
  );
  const user2 = await query(
    `INSERT INTO users (full_name, pin_hash, email) VALUES ('Pooja Verma', $1, 'pooja@imperial.in') RETURNING id`,
    [pinHash5678]
  );
  const gmUserId = user1.rows[0].id;
  const cashierUserId = user2.rows[0].id;

  await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [gmUserId, dawatOutletId, roleMgr.rows[0].id]);
  await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [cashierUserId, dawatOutletId, roleCashier.rows[0].id]);

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

  // 5. Floor & Tables
  const areaHall = await createFloorArea(dawatOutletId, 'Main Royal Hall', 1);
  const areaTerrace = await createFloorArea(dawatOutletId, 'Terrace Courtyard', 2);

  const tables = [];
  for (let i = 1; i <= 10; i++) {
    const t = await createTable({
      outlet_id: dawatOutletId,
      area_id: areaHall.id,
      table_number: `T-${i}`,
      capacity: i % 2 === 0 ? 4 : 2,
    });
    tables.push(t);
  }

  // 6. UOMs & Raw Materials
  const uomKg = await createUOM({ name: 'Kilogram', symbol: 'kg' });
  const uomL = await createUOM({ name: 'Litre', symbol: 'l' });
  const uomPcs = await createUOM({ name: 'Pieces', symbol: 'pcs' });

  const matPaneer = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Malai Paneer', sku: 'RAW-PAN-01', uom_id: uomKg.id, current_cost_paise: 32000 });
  const matChicken = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Chicken Boneless', sku: 'RAW-CHK-01', uom_id: uomKg.id, current_cost_paise: 26000 });
  const matRice = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Basmati Rice', sku: 'RAW-RIC-01', uom_id: uomKg.id, current_cost_paise: 9500 });
  const matButter = await createRawMaterial({ outlet_id: dawatOutletId, name: 'Table Butter', sku: 'RAW-BUT-01', uom_id: uomKg.id, current_cost_paise: 44000 });

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
    ],
  });

  // 8. Menu Items & Recipes
  const catStarters = await createCategory(dawatOutletId, 'Starters', 1);
  const catMains = await createCategory(dawatOutletId, 'Mains', 2);
  const catBreads = await createCategory(dawatOutletId, 'Breads & Rice', 3);

  const dishTikka = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catStarters.id,
    station_id: stTandoor.rows[0].id,
    name: 'Murgh Malai Tikka',
    base_price_paise: 52000, // Rs 520
  });

  const dishPaneer = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catMains.id,
    station_id: stCurry.rows[0].id,
    name: 'Paneer Makhani',
    base_price_paise: 44000, // Rs 440
  });

  const dishBiryani = await createMenuItem({
    outlet_id: dawatOutletId,
    category_id: catBreads.id,
    station_id: stCurry.rows[0].id,
    name: 'Dum Pukht Biryani',
    base_price_paise: 58000, // Rs 580
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
  const sampleGuest = await createGuest({
    name: 'Maharaja Gaj Singh',
    phone: '+919829012345',
    email: 'gajsingh@heritage.in',
  });
  await checkInGuest(hotelOutletId, hotelRooms[0].id, sampleGuest.id, 10000000);

  // 10. Staff Employees
  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-001',
    first_name: 'Imtiaz',
    last_name: 'Qureshi',
    role: 'head_chef',
    salary_type: 'monthly',
    base_rate_paise: 7500000, // Rs 75,000
  });

  await createEmployee({
    outlet_id: dawatOutletId,
    employee_code: 'EMP-DAW-002',
    first_name: 'Vikram',
    last_name: 'Sethi',
    role: 'line_cook',
    salary_type: 'monthly',
    base_rate_paise: 3500000, // Rs 35,000
  });

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
