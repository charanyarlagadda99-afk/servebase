import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  createUOM,
  createRawMaterial,
  getStockOnHand,
  getAllStockOnHand,
  recordWastage,
  executeStockCount,
} from '../src/services/inventory.js';
import { createRecipe, deductSalesInventory } from '../src/services/recipes.js';
import {
  createVendor,
  createPurchaseOrder,
  approvePurchaseOrder,
  createGoodsReceiptNote,
  validateThreeWayMatch,
} from '../src/services/purchasing.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';
import { createOrder } from '../src/services/orders.js';

describe('Block 6: Inventory, Recipes, Purchasing & 3-Way Match', () => {
  let outletId: string;
  let userId: string;
  let kgUomId: string;
  let paneerRawId: string;
  let butterRawId: string;
  let vendorId: string;
  let menuItemId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Organization & Outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Punjab Grill Group') RETURNING id`);
    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Punjab Heritage') RETURNING id`,
      [orgRes.rows[0].id]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'Cyber Hub Outlet', 'DEL-CH01', '07AAAAA0000A1Z5', 'Cyber Hub Gurugram', '06')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // 2. User
    const userRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Vikas Khanna', 'hash', 'vikas@punjab.in') RETURNING id`
    );
    userId = userRes.rows[0].id;

    // 3. UOMs
    const kgUom = await createUOM({ name: 'Kilogram', symbol: 'kg' });
    kgUomId = kgUom.id;
    await createUOM({ name: 'Gram', symbol: 'g' });
    await createUOM({ name: 'Litre', symbol: 'l' });

    // 4. Raw Materials
    const paneer = await createRawMaterial({
      outlet_id: outletId,
      name: 'Fresh Malai Paneer',
      sku: 'RAW-PAN-01',
      uom_id: kgUomId,
      category: 'dairy',
      current_cost_paise: 30000, // Rs 300/kg
      par_level: 20.0,
      reorder_point: 10.0,
    });
    paneerRawId = paneer.id;

    const butter = await createRawMaterial({
      outlet_id: outletId,
      name: 'White Table Butter',
      sku: 'RAW-BUT-01',
      uom_id: kgUomId,
      category: 'dairy',
      current_cost_paise: 45000, // Rs 450/kg
      par_level: 15.0,
      reorder_point: 5.0,
    });
    butterRawId = butter.id;

    // 5. Vendor
    const vendor = await createVendor({
      name: 'Amul Dairy Supplies Ltd',
      gstin: '07AAACA1234A1Z1',
      contact_name: 'Rajesh Sharma',
      phone: '+919811223344',
      payment_terms_days: 15,
    });
    vendorId = vendor.id;

    // 6. Menu item
    const cat = await createCategory(outletId, 'Mains', 1);
    const dish = await createMenuItem({
      outlet_id: outletId,
      category_id: cat.id,
      name: 'Paneer Butter Masala',
      base_price_paise: 48000,
    });
    menuItemId = dish.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates purchase order, approves it, and receives goods via GRN to increase stock on hand', async () => {
    // Initial stock is 0
    const initialStock = await getStockOnHand(outletId, paneerRawId);
    expect(initialStock).toBe(0);

    // 1. Create PO for 40 kg Paneer @ Rs 300/kg (tax 5%)
    const po = await createPurchaseOrder({
      outlet_id: outletId,
      vendor_id: vendorId,
      created_by: userId,
      items: [
        {
          raw_material_id: paneerRawId,
          quantity: 40.0,
          unit_price_paise: 30000, // Rs 300/kg
          tax_rate_percent: 5.0,
        },
      ],
    });

    expect(po.status).toBe('draft');
    expect(po.po_number).toMatch(/PO-\d+/);
    expect(po.subtotal_paise).toBe(1200000); // 40 * 30000 = Rs 12,000
    expect(po.tax_paise).toBe(60000);        // 5% of Rs 12,000 = Rs 600
    expect(po.total_paise).toBe(1260000);

    // 2. Approve PO
    const approvedPo = await approvePurchaseOrder(po.id, userId);
    expect(approvedPo.status).toBe('approved');

    // 3. Receive Goods via GRN (40 kg accepted)
    const grn = await createGoodsReceiptNote({
      outlet_id: outletId,
      vendor_id: vendorId,
      purchase_order_id: po.id,
      vendor_invoice_number: 'AMUL-INV-8891',
      received_date: '2026-10-01',
      received_by: userId,
      items: [
        {
          raw_material_id: paneerRawId,
          po_qty: 40.0,
          received_qty: 40.0,
          unit_price_paise: 30000,
          tax_rate_percent: 5.0,
          batch_number: 'BATCH-202610-P01',
          expiry_date: '2026-10-10',
        },
      ],
    });

    expect(grn.status).toBe('verified');
    expect(grn.grn_number).toMatch(/GRN-\d+/);

    // Stock on hand must now be exactly 40 kg
    const updatedStock = await getStockOnHand(outletId, paneerRawId);
    expect(updatedStock).toBe(40.0);
  });

  it('re-calculates Weighted Average Cost (WAC) correctly on subsequent purchases at different prices', async () => {
    // Current stock: 40 kg @ 30,000 paise (Rs 300) = Rs 12,000 value
    // Receive 60 kg @ 35,000 paise (Rs 350) = Rs 21,000 value
    // Total: 100 kg, total value = Rs 33,000 -> New WAC = Rs 330/kg (33,000 paise)

    await createGoodsReceiptNote({
      outlet_id: outletId,
      vendor_id: vendorId,
      vendor_invoice_number: 'AMUL-INV-9902',
      received_date: '2026-10-01',
      received_by: userId,
      items: [
        {
          raw_material_id: paneerRawId,
          po_qty: 60.0,
          received_qty: 60.0,
          unit_price_paise: 35000, // Rs 350/kg
          tax_rate_percent: 5.0,
        },
      ],
    });

    // Check stock on hand: 40 + 60 = 100 kg
    const currentStock = await getStockOnHand(outletId, paneerRawId);
    expect(currentStock).toBe(100.0);

    // Verify raw material current_cost_paise updated to 33,000 paise (Rs 330)
    const matRes = await query(`SELECT current_cost_paise FROM raw_materials WHERE id = $1`, [paneerRawId]);
    expect(Number(matRes.rows[0].current_cost_paise)).toBe(33000);
  });

  it('defines bill of materials (recipe) and automatically explodes and deducts inventory on sale', async () => {
    // 1. Also add 20 kg of butter to stock
    await createGoodsReceiptNote({
      outlet_id: outletId,
      vendor_id: vendorId,
      vendor_invoice_number: 'AMUL-INV-7711',
      received_date: '2026-10-01',
      received_by: userId,
      items: [
        {
          raw_material_id: butterRawId,
          po_qty: 20.0,
          received_qty: 20.0,
          unit_price_paise: 45000,
          tax_rate_percent: 12.0,
        },
      ],
    });

    // 2. Define recipe for Paneer Butter Masala (1 portion requires 0.25 kg Paneer with 10% wastage, 0.05 kg Butter with 0% wastage)
    const recipe = await createRecipe({
      menu_item_id: menuItemId,
      yield_portions: 1.0,
      ingredients: [
        {
          raw_material_id: paneerRawId,
          quantity: 0.25,
          uom_id: kgUomId,
          wastage_percent: 10.0, // 10% prep/cutting trim loss
        },
        {
          raw_material_id: butterRawId,
          quantity: 0.05,
          uom_id: kgUomId,
          wastage_percent: 0.0,
        },
      ],
    });
    expect(recipe.ingredients.length).toBe(2);

    // 3. Create an order with 4 portions of Paneer Butter Masala
    const order = await createOrder({
      outlet_id: outletId,
      order_type: 'dine_in',
      business_date: '2026-10-01',
      user_id: userId,
      items: [
        {
          menu_item_id: menuItemId,
          item_name: 'Paneer Butter Masala',
          quantity: 4,
          unit_price_paise: 48000,
        },
      ],
    });

    // 4. Trigger inventory deduction via C++ explode_recipe
    const deduction = await deductSalesInventory(order.id, '2026-10-01');
    expect(deduction.consumed.length).toBe(2);

    // 4 portions:
    // Paneer: 4 * 0.25 = 1.0 kg net. With 10% wastage: 1.0 / (1 - 0.10) = 1.111 kg gross
    // Butter: 4 * 0.05 = 0.20 kg gross
    const paneerDeduction = deduction.consumed.find((c) => c.raw_material_id === paneerRawId);
    expect(paneerDeduction).toBeDefined();
    expect(paneerDeduction?.quantity_consumed).toBeGreaterThan(1.0);

    const butterDeduction = deduction.consumed.find((c) => c.raw_material_id === butterRawId);
    expect(butterDeduction).toBeDefined();
    expect(butterDeduction?.quantity_consumed).toBeCloseTo(0.20, 2);

    // Check stock on hand decreased
    const remainingPaneer = await getStockOnHand(outletId, paneerRawId);
    expect(remainingPaneer).toBeLessThan(100.0);
  });

  it('records wastage movements and tracks reason codes', async () => {
    const beforeStock = await getStockOnHand(outletId, paneerRawId);

    // Record 2.5 kg spoilage due to cold-storage power failure
    const waste = await recordWastage({
      outlet_id: outletId,
      raw_material_id: paneerRawId,
      quantity: 2.5,
      reason: 'spoilage',
      business_date: '2026-10-01',
      notes: 'Cold room circuit breaker tripped overnight',
      user_id: userId,
    });

    expect(waste.movement_type).toBe('wastage');
    expect(waste.quantity).toBe(-2.5);

    const afterStock = await getStockOnHand(outletId, paneerRawId);
    expect(afterStock).toBeCloseTo(beforeStock - 2.5, 3);
  });

  it('conducts physical cycle count and classifies variance via C++ variance engine', async () => {
    // Current stock on hand for Butter is ~19.80 kg
    // Suppose physical count finds only 18.50 kg (variance of -1.30 kg)
    const stockCount = await executeStockCount(
      outletId,
      '2026-10-01',
      userId,
      [
        {
          raw_material_id: butterRawId,
          actual_qty: 18.5,
          variance_reason: 'Spillage during lunch service prep',
        },
      ],
      'cycle'
    );

    expect(stockCount.status).toBe('approved');
    expect(stockCount.items.length).toBe(1);
    const item = stockCount.items[0];
    expect(item.actual_qty).toBe(18.5);
    expect(item.variance_qty).toBeLessThan(0);
    expect(item.classification).toBeDefined(); // C++ engine classifies 'within_tolerance', 'minor_leakage', or 'critical_leakage'

    // Verify stock on hand updated to physical count (18.50 kg)
    const currentButter = await getStockOnHand(outletId, butterRawId);
    expect(currentButter).toBeCloseTo(18.5, 2);
  });

  it('performs 3-way match validation detecting matching, quantity discrepancy, and price discrepancy', async () => {
    // 1. Create a PO for 20 kg Paneer @ Rs 300
    const po = await createPurchaseOrder({
      outlet_id: outletId,
      vendor_id: vendorId,
      created_by: userId,
      items: [
        {
          raw_material_id: paneerRawId,
          quantity: 20.0,
          unit_price_paise: 30000,
          tax_rate_percent: 5.0,
        },
      ],
    });
    await approvePurchaseOrder(po.id, userId);

    // 2. GRN: Physical delivery arrived with only 18 kg (2 kg damaged in transit)
    const grn = await createGoodsReceiptNote({
      outlet_id: outletId,
      vendor_id: vendorId,
      purchase_order_id: po.id,
      vendor_invoice_number: 'INV-3WAY-TEST',
      received_date: '2026-10-01',
      received_by: userId,
      items: [
        {
          raw_material_id: paneerRawId,
          po_qty: 20.0,
          received_qty: 18.0, // Only 18 kg received
          unit_price_paise: 30000,
          tax_rate_percent: 5.0,
        },
      ],
    });

    // Test Case A: Vendor bills for 20 kg instead of 18 kg -> Quantity mismatch!
    const billQtyMismatch = await validateThreeWayMatch({
      outlet_id: outletId,
      vendor_id: vendorId,
      po_id: po.id,
      grn_id: grn.id,
      bill_number: 'INV-MISMATCH-QTY',
      bill_date: '2026-10-01',
      due_date: '2026-10-16',
      subtotal_paise: 600000, // 20 * 30000
      tax_paise: 30000,
      total_paise: 630000,
      items: [
        {
          raw_material_id: paneerRawId,
          billed_qty: 20.0, // Mismatch: GRN was only 18 kg!
          unit_price_paise: 30000,
        },
      ],
    });

    expect(billQtyMismatch.is_matched).toBe(false);
    expect(billQtyMismatch.status).toBe('discrepancy');
    expect(billQtyMismatch.discrepancies.length).toBeGreaterThan(0);
    expect(billQtyMismatch.discrepancies[0].type).toBe('quantity_mismatch');

    // Test Case B: Vendor bills for 18 kg but inflated price @ Rs 350 instead of PO Rs 300 -> Price mismatch!
    const billPriceMismatch = await validateThreeWayMatch({
      outlet_id: outletId,
      vendor_id: vendorId,
      po_id: po.id,
      grn_id: grn.id,
      bill_number: 'INV-MISMATCH-PRICE',
      bill_date: '2026-10-01',
      due_date: '2026-10-16',
      subtotal_paise: 630000,
      tax_paise: 31500,
      total_paise: 661500,
      items: [
        {
          raw_material_id: paneerRawId,
          billed_qty: 18.0,
          unit_price_paise: 35000, // Mismatch: PO was 30000!
        },
      ],
    });

    expect(billPriceMismatch.is_matched).toBe(false);
    expect(billPriceMismatch.status).toBe('discrepancy');
    expect(billPriceMismatch.discrepancies[0].type).toBe('price_mismatch');

    // Test Case C: Correct bill matching 18 kg @ Rs 300 -> Match Verified!
    const billMatched = await validateThreeWayMatch({
      outlet_id: outletId,
      vendor_id: vendorId,
      po_id: po.id,
      grn_id: grn.id,
      bill_number: 'INV-CORRECT-MATCH',
      bill_date: '2026-10-01',
      due_date: '2026-10-16',
      subtotal_paise: 540000, // 18 * 30000
      tax_paise: 27000,
      total_paise: 567000,
      items: [
        {
          raw_material_id: paneerRawId,
          billed_qty: 18.0,
          unit_price_paise: 30000,
        },
      ],
    });

    expect(billMatched.is_matched).toBe(true);
    expect(billMatched.status).toBe('verified');
    expect(billMatched.discrepancies.length).toBe(0);
  });
});
