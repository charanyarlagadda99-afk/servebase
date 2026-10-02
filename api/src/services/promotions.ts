import { query, withTransaction } from '../db/pool.js';

export interface CreateCouponInput {
  outlet_id: string;
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number; // e.g. 20.0 for 20%, or 100 for Rs 100 flat
  min_order_paise?: number;
  max_discount_paise?: number;
  valid_until: string; // YYYY-MM-DD
  usage_limit?: number;
}

export async function createCoupon(input: CreateCouponInput) {
  const res = await query(
    `INSERT INTO coupons (
      outlet_id, code, discount_type, discount_value, min_order_paise,
      max_discount_paise, valid_until, usage_limit
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      input.outlet_id,
      input.code.toUpperCase().trim(),
      input.discount_type,
      input.discount_value,
      input.min_order_paise || 0,
      input.max_discount_paise || null,
      input.valid_until,
      input.usage_limit || 1000,
    ]
  );
  const c = res.rows[0];
  return {
    ...c,
    discount_value: Number(c.discount_value),
    min_order_paise: Number(c.min_order_paise),
    max_discount_paise: c.max_discount_paise ? Number(c.max_discount_paise) : null,
    usage_limit: Number(c.usage_limit),
    times_used: Number(c.times_used),
  };
}

export async function validateAndApplyCoupon(
  outletId: string,
  code: string,
  orderSubtotalPaise: number
) {
  return withTransaction(async (client) => {
    const cRes = await client.query(
      `SELECT * FROM coupons WHERE outlet_id = $1 AND code = $2 FOR UPDATE`,
      [outletId, code.toUpperCase().trim()]
    );
    if (cRes.rows.length === 0) {
      throw new Error(`Coupon code '${code}' not found or invalid`);
    }

    const coupon = cRes.rows[0];

    // 1. Expiration check
    const today = new Date().toISOString().slice(0, 10);
    const validUntilStr = new Date(coupon.valid_until).toISOString().slice(0, 10);
    if (today > validUntilStr) {
      throw new Error(`Coupon '${code}' has expired on ${validUntilStr}`);
    }

    // 2. Usage limit check
    if (Number(coupon.times_used) >= Number(coupon.usage_limit)) {
      throw new Error(`Coupon '${code}' usage limit has been reached`);
    }

    // 3. Minimum order check
    const minOrder = Number(coupon.min_order_paise);
    if (orderSubtotalPaise < minOrder) {
      throw new Error(
        `Order subtotal of Rs ${orderSubtotalPaise / 100} does not meet minimum order of Rs ${minOrder / 100} for coupon '${code}'`
      );
    }

    // 4. Compute discount
    let discountPaise = 0;
    if (coupon.discount_type === 'percent') {
      const pct = Number(coupon.discount_value);
      discountPaise = Math.round(orderSubtotalPaise * (pct / 100.0));
      if (coupon.max_discount_paise) {
        discountPaise = Math.min(discountPaise, Number(coupon.max_discount_paise));
      }
    } else { // 'flat'
      // flat discount_value in rupees
      const flatPaise = Math.round(Number(coupon.discount_value) * 100);
      discountPaise = Math.min(orderSubtotalPaise, flatPaise);
    }

    // 5. Increment usage
    await client.query(
      `UPDATE coupons SET times_used = times_used + 1 WHERE id = $1`,
      [coupon.id]
    );

    return {
      coupon_id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_paise: discountPaise,
      times_used: Number(coupon.times_used) + 1,
    };
  });
}
