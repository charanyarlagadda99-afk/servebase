import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  upsertCustomer,
  getCustomer,
  awardLoyaltyPoints,
  redeemLoyaltyPoints,
} from '../src/services/customers.js';
import {
  createCoupon,
  validateAndApplyCoupon,
} from '../src/services/promotions.js';
import {
  createChannel,
  getChannels,
  simulateAggregatorOrderWebhook,
  updateRiderStatus,
} from '../src/services/channels.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';

describe('Block 10: Channels, Customers, Loyalty & Promotions', () => {
  let outletId: string;
  let systemUserId: string;
  let dishItemId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Organization & Outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Haldiram Snacks Corp') RETURNING id`);
    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Haldirams Express') RETURNING id`,
      [orgRes.rows[0].id]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'Haldirams Sector 29', 'DEL-HAL01', '07AAAAA0000A1Z5', 'Sector 29 Gurugram', '06')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // 2. System User
    const userRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('API Gateway', 'hash', 'system@haldiram.in') RETURNING id`
    );
    systemUserId = userRes.rows[0].id;

    // 3. Menu Item
    const cat = await createCategory(outletId, 'Street Food', 1);
    const dish = await createMenuItem({
      outlet_id: outletId,
      category_id: cat.id,
      name: 'Raj Kachori Special',
      base_price_paise: 25000, // Rs 250
    });
    dishItemId = dish.id;

    // 4. Delivery Channel
    await createChannel({
      outlet_id: outletId,
      name: 'zomato',
      commission_percent: 22.5,
      gst_collected_by: 'platform',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('upserts customer profile and tracks marketing consent', async () => {
    const cust1 = await upsertCustomer({
      name: 'Ananya Birla',
      phone: '+919988776655',
      email: 'ananya@birla.in',
      consent_marketing: true,
    });

    expect(cust1.name).toBe('Ananya Birla');
    expect(cust1.loyalty_points).toBe(0);
    expect(cust1.loyalty_tier).toBe('bronze');

    // Update profile without duplicating phone
    const cust2 = await upsertCustomer({
      name: 'Ananya Birla Official',
      phone: '+919988776655',
      email: 'ananya.b@birla.in',
    });

    expect(cust2.id).toBe(cust1.id);
    expect(cust2.name).toBe('Ananya Birla Official');
  });

  it('accumulates spend, awards loyalty points, and automatically upgrades tiers', async () => {
    const cust = await getCustomer('+919988776655');
    expect(cust).not.toBeNull();

    // Spend Rs 12,000 (1,200,000 paise) -> Earn 120 points -> Upgrades to Silver (threshold Rs 10,000)
    const tx1 = await awardLoyaltyPoints(cust!.id, 1200000);
    expect(tx1.points_earned).toBe(120);
    expect(tx1.customer.loyalty_tier).toBe('silver');
    expect(tx1.customer.total_spend_paise).toBe(1200000);

    // Additional spend Rs 40,000 (4,000,000 paise) -> Total Rs 52,000 -> Upgrades to Platinum (threshold Rs 50,000)
    const tx2 = await awardLoyaltyPoints(cust!.id, 4000000);
    expect(tx2.points_earned).toBe(400);
    expect(tx2.customer.loyalty_tier).toBe('platinum');
    expect(tx2.customer.loyalty_points).toBe(520); // 120 + 400

    // Redeem 100 points for Rs 100 discount (10,000 paise)
    const redemption = await redeemLoyaltyPoints(cust!.id, 100, 50000); // Order subtotal Rs 500
    expect(redemption.points_redeemed).toBe(100);
    expect(redemption.discount_paise).toBe(10000); // Rs 100
    expect(redemption.remaining_points).toBe(420);
  });

  it('creates and validates promo coupon codes with min order and max discount caps', async () => {
    // Percentage coupon: 20% off, min order Rs 500 (50,000 paise), max discount Rs 150 (15,000 paise)
    const coupon20 = await createCoupon({
      outlet_id: outletId,
      code: 'TASTY20',
      discount_type: 'percent',
      discount_value: 20.0,
      min_order_paise: 50000,
      max_discount_paise: 15000,
      valid_until: '2027-12-31',
      usage_limit: 2,
    });
    expect(coupon20.code).toBe('TASTY20');

    // 1. Order below min threshold (Rs 400) -> Rejection
    await expect(validateAndApplyCoupon(outletId, 'TASTY20', 40000)).rejects.toThrow('does not meet minimum order');

    // 2. Order of Rs 1,000 -> 20% would be Rs 200, but capped at Rs 150 (15,000 paise)
    const applied1 = await validateAndApplyCoupon(outletId, 'TASTY20', 100000);
    expect(applied1.discount_paise).toBe(15000);
    expect(applied1.times_used).toBe(1);

    // 3. Second usage succeeds
    const applied2 = await validateAndApplyCoupon(outletId, 'TASTY20', 100000);
    expect(applied2.times_used).toBe(2);

    // 4. Third usage fails (limit 2 reached)
    await expect(validateAndApplyCoupon(outletId, 'TASTY20', 100000)).rejects.toThrow('usage limit has been reached');
  });

  it('ingests simulated aggregator delivery order webhook and tracks rider dispatch lifecycle', async () => {
    const channels = await getChannels(outletId);
    expect(channels.length).toBeGreaterThan(0);

    // Simulated Zomato incoming webhook payload (labelled simulated)
    const webhookPayload = {
      outlet_id: outletId,
      channel_name: 'zomato' as const,
      external_order_id: 'ZOMATO-OD-99182',
      customer: {
        name: 'Gaurav Munjal',
        phone: '+919911002233',
        email: 'gaurav@unacademy.com',
      },
      items: [
        {
          menu_item_id: dishItemId,
          item_name: 'Raj Kachori Special',
          quantity: 2,
          unit_price_paise: 25000,
          notes: 'Pack chutney separately',
        },
      ],
      rider: {
        name: 'Ramesh Kumar',
        phone: '+919876543210',
      },
      special_instructions: 'Ring bell and leave at door',
      business_date: '2026-10-01',
      system_user_id: systemUserId,
    };

    const orderResult = await simulateAggregatorOrderWebhook(webhookPayload);
    expect(orderResult.simulated).toBe(true);
    expect(orderResult.channel).toBe('zomato');
    expect(orderResult.external_order_id).toBe('ZOMATO-OD-99182');
    expect(orderResult.rider_status).toBe('assigned');

    // Update rider status: arrived at store -> picked up -> delivered
    const s1 = await updateRiderStatus(orderResult.order_id, 'at_store');
    expect(s1.rider_status).toBe('at_store');

    const s2 = await updateRiderStatus(orderResult.order_id, 'picked_up');
    expect(s2.rider_status).toBe('picked_up');

    const s3 = await updateRiderStatus(orderResult.order_id, 'delivered');
    expect(s3.rider_status).toBe('delivered');
  });
});
