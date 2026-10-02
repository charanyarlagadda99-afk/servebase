import { query, withTransaction } from '../db/pool.js';
import { upsertCustomer } from './customers.js';
import { sendKOT } from './orders.js';
import { realtimeBus } from './realtime.js';

export interface CreateChannelInput {
  outlet_id: string;
  name: 'zomato' | 'swiggy' | 'direct_web';
  commission_percent?: number;
  gst_collected_by?: 'platform' | 'merchant';
}

export async function createChannel(input: CreateChannelInput) {
  const res = await query(
    `INSERT INTO channels (outlet_id, name, commission_percent, gst_collected_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (outlet_id, name)
     DO UPDATE SET commission_percent = EXCLUDED.commission_percent, gst_collected_by = EXCLUDED.gst_collected_by
     RETURNING *`,
    [
      input.outlet_id,
      input.name,
      input.commission_percent !== undefined ? input.commission_percent : 20.0,
      input.gst_collected_by || 'platform',
    ]
  );
  return {
    ...res.rows[0],
    commission_percent: Number(res.rows[0].commission_percent),
  };
}

export async function getChannels(outletId: string) {
  const res = await query(
    `SELECT * FROM channels WHERE outlet_id = $1 AND is_active = TRUE`,
    [outletId]
  );
  return res.rows.map((r) => ({
    ...r,
    commission_percent: Number(r.commission_percent),
  }));
}

export interface SimulatedAggregatorOrderPayload {
  outlet_id: string;
  channel_name: 'zomato' | 'swiggy' | 'direct_web';
  external_order_id: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  items: Array<{
    menu_item_id: string;
    variant_id?: string;
    item_name: string;
    quantity: number;
    unit_price_paise: number;
    course?: string;
    notes?: string;
  }>;
  rider?: {
    name: string;
    phone: string;
  };
  special_instructions?: string;
  business_date: string;
  system_user_id: string;
}

export async function simulateAggregatorOrderWebhook(payload: SimulatedAggregatorOrderPayload) {
  return withTransaction(async (client) => {
    // 1. Get or create channel
    let chRes = await client.query(
      `SELECT * FROM channels WHERE outlet_id = $1 AND name = $2`,
      [payload.outlet_id, payload.channel_name]
    );

    let channelId: string;
    if (chRes.rows.length === 0) {
      const newCh = await client.query(
        `INSERT INTO channels (outlet_id, name, commission_percent, gst_collected_by)
         VALUES ($1, $2, 20.0, 'platform') RETURNING id`,
        [payload.outlet_id, payload.channel_name]
      );
      channelId = newCh.rows[0].id;
    } else {
      channelId = chRes.rows[0].id;
    }

    // 2. Upsert customer
    const customer = await upsertCustomer({
      name: payload.customer.name,
      phone: payload.customer.phone,
      email: payload.customer.email,
    });

    // 3. Create aggregator order
    const orderRes = await client.query(
      `INSERT INTO orders (
        outlet_id, order_type, channel_id, external_order_id,
        customer_id, status, covers, business_date, notes,
        rider_name, rider_phone, rider_status, created_by_user_id
      ) VALUES ($1, 'aggregator', $2, $3, $4, 'open', 1, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        payload.outlet_id,
        channelId,
        payload.external_order_id,
        customer.id,
        payload.business_date,
        payload.special_instructions || `Simulated ${payload.channel_name} order`,
        payload.rider?.name || 'Rider Assigned',
        payload.rider?.phone || '+919999900000',
        'assigned',
        payload.system_user_id,
      ]
    );
    const order = orderRes.rows[0];

    // 4. Insert items
    for (const item of payload.items) {
      await client.query(
        `INSERT INTO order_items (
          order_id, menu_item_id, variant_id, item_name, quantity,
          unit_price_paise, course, course_status, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'fire', $8, 'pending')`,
        [
          order.id,
          item.menu_item_id,
          item.variant_id || null,
          item.item_name,
          item.quantity,
          item.unit_price_paise,
          item.course || 'mains',
          item.notes || null,
        ]
      );
    }

    return {
      order_id: order.id,
      channel: payload.channel_name,
      external_order_id: payload.external_order_id,
      customer_id: customer.id,
      customer_name: customer.name,
      rider_name: order.rider_name,
      rider_status: order.rider_status,
      simulated: true,
    };
  });
}

export async function updateRiderStatus(
  orderId: string,
  riderStatus: 'assigned' | 'at_store' | 'picked_up' | 'delivered'
) {
  const res = await query(
    `UPDATE orders SET rider_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [riderStatus, orderId]
  );
  if (res.rows.length === 0) throw new Error('Order not found');
  const order = res.rows[0];

  realtimeBus.publish({
    outlet_id: order.outlet_id,
    order_id: orderId,
    type: 'TABLE_UPDATED',
    data: {
      order_id: orderId,
      rider_status: riderStatus,
      rider_name: order.rider_name,
    },
  });

  return {
    order_id: order.id,
    rider_status: order.rider_status,
    updated_at: order.updated_at,
  };
}
