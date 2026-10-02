import { query, withTransaction } from '../db/pool.js';

export interface UpsertCustomerInput {
  name: string;
  phone: string;
  email?: string;
  gstin?: string;
  consent_marketing?: boolean;
}

export async function upsertCustomer(input: UpsertCustomerInput) {
  const res = await query(
    `INSERT INTO customers (name, phone, email, gstin, consent_marketing)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (phone)
     DO UPDATE SET 
       name = EXCLUDED.name,
       email = COALESCE(EXCLUDED.email, customers.email),
       gstin = COALESCE(EXCLUDED.gstin, customers.gstin),
       consent_marketing = EXCLUDED.consent_marketing
     RETURNING *`,
    [
      input.name,
      input.phone,
      input.email || null,
      input.gstin || null,
      input.consent_marketing ?? true,
    ]
  );
  return {
    ...res.rows[0],
    total_spend_paise: Number(res.rows[0].total_spend_paise),
    loyalty_points: Number(res.rows[0].loyalty_points),
    visit_count: Number(res.rows[0].visit_count),
  };
}

export async function getCustomer(identifier: string) {
  // Can be ID or phone
  const res = await query(
    `SELECT * FROM customers WHERE (id::text = $1 OR phone = $1) AND deleted_at IS NULL`,
    [identifier]
  );
  if (res.rows.length === 0) return null;
  const c = res.rows[0];
  return {
    ...c,
    total_spend_paise: Number(c.total_spend_paise),
    loyalty_points: Number(c.loyalty_points),
    visit_count: Number(c.visit_count),
  };
}

export async function awardLoyaltyPoints(customerId: string, spendPaise: number) {
  return withTransaction(async (client) => {
    const custRes = await client.query(
      `SELECT * FROM customers WHERE id = $1 FOR UPDATE`,
      [customerId]
    );
    if (custRes.rows.length === 0) throw new Error('Customer not found');
    const cust = custRes.rows[0];

    // Earn 1 point per Rs 100 spent (10,000 paise)
    const pointsEarned = Math.floor(spendPaise / 10000);
    const newTotalSpend = Number(cust.total_spend_paise) + spendPaise;
    const newPoints = Number(cust.loyalty_points) + pointsEarned;
    const newVisits = Number(cust.visit_count) + 1;

    // Evaluate tier
    let tier = 'bronze';
    if (newTotalSpend >= 5000000) {
      tier = 'platinum'; // >= Rs 50,000
    } else if (newTotalSpend >= 2500000) {
      tier = 'gold';     // >= Rs 25,000
    } else if (newTotalSpend >= 1000000) {
      tier = 'silver';   // >= Rs 10,000
    }

    const updateRes = await client.query(
      `UPDATE customers 
       SET total_spend_paise = $1, loyalty_points = $2, visit_count = $3, loyalty_tier = $4
       WHERE id = $5
       RETURNING *`,
      [newTotalSpend, newPoints, newVisits, tier, customerId]
    );

    const updated = updateRes.rows[0];
    return {
      customer: {
        ...updated,
        total_spend_paise: Number(updated.total_spend_paise),
        loyalty_points: Number(updated.loyalty_points),
        visit_count: Number(updated.visit_count),
      },
      points_earned: pointsEarned,
    };
  });
}

export async function redeemLoyaltyPoints(
  customerId: string,
  pointsToRedeem: number,
  orderSubtotalPaise: number
) {
  return withTransaction(async (client) => {
    const custRes = await client.query(
      `SELECT * FROM customers WHERE id = $1 FOR UPDATE`,
      [customerId]
    );
    if (custRes.rows.length === 0) throw new Error('Customer not found');
    const cust = custRes.rows[0];

    const currentPoints = Number(cust.loyalty_points);
    if (pointsToRedeem > currentPoints) {
      throw new Error(`Insufficient points: Customer has ${currentPoints} points, requested ${pointsToRedeem}`);
    }

    // 1 point = Rs 1 discount = 100 paise
    const maxRedeemablePaise = orderSubtotalPaise;
    const proposedDiscountPaise = pointsToRedeem * 100;
    const discountPaise = Math.min(proposedDiscountPaise, maxRedeemablePaise);
    const actualPointsUsed = Math.ceil(discountPaise / 100);

    await client.query(
      `UPDATE customers SET loyalty_points = loyalty_points - $1 WHERE id = $2`,
      [actualPointsUsed, customerId]
    );

    return {
      points_redeemed: actualPointsUsed,
      discount_paise: discountPaise,
      remaining_points: currentPoints - actualPointsUsed,
    };
  });
}
