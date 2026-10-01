import { describe, it, expect, afterAll } from 'vitest';
import { corePool } from '../src/services/core-pool.js';

describe('Block 3: C++17 Core Engine Worker Pool Integration', () => {
  afterAll(() => {
    corePool.shutdown();
  });

  it('prices bill via C++ core engine with GST and rounding', async () => {
    const res = await corePool.execute('price_bill', {
      tax_mode: 'no_itc_5',
      is_inter_state: false,
      service_charge_percent: 5.0,
      service_charge_enabled: true,
      tip_paise: 5000,
      bill_discount_percent: 10.0,
      items: [
        {
          item_id: 'i-1',
          name: 'Dal Makhani',
          quantity: 2,
          unit_price_paise: 35000,
          tax_rate_percent: 5.0,
        },
        {
          item_id: 'i-2',
          name: 'Garlic Naan',
          quantity: 3,
          unit_price_paise: 8000,
          tax_rate_percent: 5.0,
        },
      ],
    });

    expect(res.subtotal_paise).toBe(94000); // 700 + 240 = 940 Rs
    expect(res.bill_discount_paise).toBe(9400); // 10%
    expect(res.taxable_value_paise).toBe(84600);
    expect(res.cgst_paise).toBe(res.sgst_paise);
    expect(res.cgst_paise).toBeGreaterThan(0);
    expect(res.total_paise % 100).toBe(0); // Nearest rupee
    expect(res.total_paise).toBe(
      res.taxable_value_paise +
        res.cgst_paise +
        res.sgst_paise +
        res.igst_paise +
        res.service_charge_paise +
        res.tip_paise +
        res.round_off_paise
    );
  });

  it('splits bill via C++ core engine with largest-remainder rounding', async () => {
    const bill = {
      subtotal_paise: 94000,
      item_discount_paise: 0,
      bill_discount_paise: 9400,
      taxable_value_paise: 84600,
      cgst_paise: 2115,
      sgst_paise: 2115,
      igst_paise: 0,
      service_charge_paise: 4230,
      tip_paise: 5000,
      round_off_paise: -60,
      total_paise: 98000,
    };

    const res = await corePool.execute('split_bill', {
      bill,
      split_type: 'equal',
      num_parts: 3,
    });

    expect(res.splits.length).toBe(3);
    const sumTotal = res.splits.reduce((acc: number, s: any) => acc + s.total_paise, 0);
    expect(sumTotal).toBe(98000); // EXACT TO THE PAISE
  });

  it('routes KOT via C++ core engine with course priority ordering', async () => {
    const res = await corePool.execute('route_kot', {
      stations: [
        { id: 'st-kitchen', name: 'Kitchen' },
        { id: 'st-bar', name: 'Bar' },
      ],
      items: [
        { id: '1', name: 'Chicken Tikka', station_id: 'st-kitchen', course: 'starters', quantity: 1 },
        { id: '2', name: 'Butter Chicken', station_id: 'st-kitchen', course: 'mains', quantity: 1 },
        { id: '3', name: 'Mojito', station_id: 'st-bar', course: 'beverages', quantity: 2 },
      ],
    });

    expect(res.tickets.length).toBe(2);
    const kitchenTicket = res.tickets.find((t: any) => t.station_id === 'st-kitchen');
    expect(kitchenTicket.items[0].name).toBe('Chicken Tikka'); // Starters before mains
    expect(kitchenTicket.items[1].name).toBe('Butter Chicken');
  });

  it('explodes recipe into raw material usage', async () => {
    const res = await corePool.execute('explode_recipe', {
      ordered_items: [{ menu_item_id: 'dish-1', quantity: 10 }],
      recipes: [
        {
          menu_item_id: 'dish-1',
          yield_portions: 1.0,
          ingredients: [
            { raw_material_id: 'rice', quantity: 0.150, wastage_percent: 5.0 },
            { raw_material_id: 'ghee', quantity: 0.030, wastage_percent: 0.0 },
          ],
        },
      ],
    });

    expect(res.consumptions.length).toBe(2);
    const rice = res.consumptions.find((c: any) => c.raw_material_id === 'rice');
    expect(rice.total_quantity_required).toBeCloseTo(1.575, 3); // 10 * 0.15 * 1.05
  });

  it('computes inventory variance and cost impact', async () => {
    const res = await corePool.execute('compute_variance', {
      opening_stock: [{ raw_material_id: 'butter', quantity: 20, unit_cost_paise: 50000 }],
      purchases: [{ raw_material_id: 'butter', quantity: 10, unit_cost_paise: 50000 }],
      closing_stock: [{ raw_material_id: 'butter', quantity: 8 }],
      theoretical_usage: [{ raw_material_id: 'butter', quantity: 21 }],
    });

    // Actual usage = 20 + 10 - 8 = 22. Theoretical = 21. Variance = -1.0
    const v = res.variances[0];
    expect(v.variance_qty).toBe(-1);
    expect(v.variance_cost_paise).toBe(-50000);
  });

  it('reconciles terminal cash shift and denominations', async () => {
    const res = await corePool.execute('reconcile_shift', {
      opening_float_paise: 200000,
      cash_sales_paise: 800000,
      paid_ins_paise: 0,
      paid_outs_paise: 50000,
      cash_drops_paise: 500000,
      denominations: {
        '500': 8, // 4000 Rs
        '100': 5, // 500 Rs
      },
    });

    // Expected: 2000 + 8000 - 500 - 5000 = 4500 Rs = 450,000 paise
    // Actual: 8*500 + 5*100 = 4500 Rs = 450,000 paise
    expect(res.expected_cash_paise).toBe(450000);
    expect(res.actual_cash_paise).toBe(450000);
    expect(res.over_short_paise).toBe(0);
    expect(res.is_balanced).toBe(true);
  });

  it('classifies items in menu engineering matrix (Star, Plowhorse, Puzzle, Dog)', async () => {
    const res = await corePool.execute('menu_engineering', {
      items: [
        { item_id: 'item-star', name: 'Signature Biryani', quantity_sold: 200, total_revenue_paise: 10000000, unit_food_cost_paise: 15000 },
        { item_id: 'item-dog', name: 'Boiled Egg Plate', quantity_sold: 2, total_revenue_paise: 10000, unit_food_cost_paise: 3500 },
      ],
    });

    expect(res.items.length).toBe(2);
    expect(res.items[0].classification).toBe('star');
    expect(res.items[1].classification).toBe('dog');
  });

  it('handles concurrent requests across worker pool seamlessly', async () => {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        corePool.execute('price_bill', {
          tax_mode: 'no_itc_5',
          items: [{ item_id: `item-${i}`, name: 'Tea', quantity: i + 1, unit_price_paise: 2000 }],
        })
      );
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      expect(results[i].subtotal_paise).toBe((i + 1) * 2000);
    }
  });
});
