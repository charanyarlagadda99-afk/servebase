import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export interface CreateOrderInput {
  outlet_id: string;
  terminal_id?: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery' | 'room_service' | 'aggregator' | 'qr_table';
  table_id?: string;
  customer_id?: string;
  room_number?: string;
  hotel_folio_id?: string;
  covers?: number;
  business_date: string;
  notes?: string;
  user_id: string;
  items?: Array<{
    menu_item_id: string;
    variant_id?: string;
    item_name: string;
    quantity: number;
    unit_price_paise: number;
    course?: string;
    course_status?: 'hold' | 'fire';
    notes?: string;
    modifiers?: Array<{ modifier_id: string; name: string; price_paise: number }>;
  }>;
}

export async function createOrder(input: CreateOrderInput) {
  return withTransaction(async (client) => {
    // 1. Create order record
    const orderRes = await client.query(
      `INSERT INTO orders (
        outlet_id, terminal_id, order_type, table_id, customer_id,
        room_number, hotel_folio_id, status, covers, business_date,
        notes, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11)
      RETURNING *`,
      [
        input.outlet_id,
        input.terminal_id || null,
        input.order_type,
        input.table_id || null,
        input.customer_id || null,
        input.room_number || null,
        input.hotel_folio_id || null,
        input.covers || 1,
        input.business_date,
        input.notes || null,
        input.user_id,
      ]
    );

    const order = orderRes.rows[0];

    // If dine-in and table specified, link active order to table
    if (input.table_id) {
      await client.query(
        `UPDATE tables 
         SET active_order_id = $1, status = 'occupied', current_covers = $2, status_updated_at = NOW(), version = version + 1
         WHERE id = $3`,
        [order.id, input.covers || 1, input.table_id]
      );
    }

    // 2. Add initial items if provided
    const createdItems = [];
    if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        const itemRes = await client.query(
          `INSERT INTO order_items (
            order_id, menu_item_id, variant_id, item_name, quantity,
            unit_price_paise, course, course_status, notes, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
          RETURNING *`,
          [
            order.id,
            item.menu_item_id,
            item.variant_id || null,
            item.item_name,
            item.quantity,
            item.unit_price_paise,
            item.course || 'mains',
            item.course_status || 'hold',
            item.notes || null,
          ]
        );
        const orderItem = itemRes.rows[0];

        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            await client.query(
              `INSERT INTO order_item_modifiers (order_item_id, modifier_id, name, price_paise)
               VALUES ($1, $2, $3, $4)`,
              [orderItem.id, mod.modifier_id, mod.name, mod.price_paise]
            );
          }
        }
        createdItems.push(orderItem);
      }
    }

    await recordAudit({
      outlet_id: input.outlet_id,
      user_id: input.user_id,
      action: 'ORDER_CREATE',
      entity_type: 'ORDER',
      entity_id: order.id,
      after_state: { order_type: order.order_type, table_id: order.table_id, covers: order.covers },
    });

    return { ...order, items: createdItems };
  });
}

export async function addItemsToOrder(
  orderId: string,
  items: Array<{
    menu_item_id: string;
    variant_id?: string;
    item_name: string;
    quantity: number;
    unit_price_paise: number;
    course?: string;
    course_status?: 'hold' | 'fire';
    notes?: string;
    modifiers?: Array<{ modifier_id: string; name: string; price_paise: number }>;
  }>,
  userId: string
) {
  return withTransaction(async (client) => {
    const orderRes = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error('Order not found');

    const order = orderRes.rows[0];
    if (['billed', 'paid', 'closed', 'cancelled'].includes(order.status)) {
      throw new Error(`Cannot add items to order with status '${order.status}'`);
    }

    const added = [];
    for (const item of items) {
      const itemRes = await client.query(
        `INSERT INTO order_items (
          order_id, menu_item_id, variant_id, item_name, quantity,
          unit_price_paise, course, course_status, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
        RETURNING *`,
        [
          order.id,
          item.menu_item_id,
          item.variant_id || null,
          item.item_name,
          item.quantity,
          item.unit_price_paise,
          item.course || 'mains',
          item.course_status || 'hold',
          item.notes || null,
        ]
      );
      const orderItem = itemRes.rows[0];

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          await client.query(
            `INSERT INTO order_item_modifiers (order_item_id, modifier_id, name, price_paise)
             VALUES ($1, $2, $3, $4)`,
            [orderItem.id, mod.modifier_id, mod.name, mod.price_paise]
          );
        }
      }
      added.push(orderItem);
    }

    await client.query(`UPDATE orders SET updated_at = NOW(), version = version + 1 WHERE id = $1`, [orderId]);

    return added;
  });
}

export async function sendKOT(orderId: string, userId: string) {
  return withTransaction(async (client) => {
    const orderRes = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    // Find pending items
    const itemsRes = await client.query(
      `SELECT oi.*, m.station_id, m.name as item_name
       FROM order_items oi
       JOIN menu_items m ON m.id = oi.menu_item_id
       WHERE oi.order_id = $1 AND oi.status = 'pending' AND oi.is_voided = FALSE`,
      [orderId]
    );

    if (itemsRes.rows.length === 0) {
      throw new Error('No pending items to send to kitchen');
    }

    // Default station fallback if station_id is null
    const defStationRes = await client.query(
      `SELECT id FROM kitchen_stations WHERE outlet_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [order.outlet_id]
    );
    const defaultStationId = defStationRes.rows.length > 0 ? defStationRes.rows[0].id : null;

    // Group items by station
    const itemsByStation = new Map<string, any[]>();
    for (const item of itemsRes.rows) {
      const stationId = item.station_id || defaultStationId;
      if (!stationId) throw new Error('No kitchen station configured for this outlet');
      if (!itemsByStation.has(stationId)) {
        itemsByStation.set(stationId, []);
      }
      itemsByStation.get(stationId)!.push(item);
    }

    const generatedKots = [];

    // For each station, allocate next sequential KOT number for outlet
    for (const [stationId, stationItems] of itemsByStation.entries()) {
      const kotNumRes = await client.query(
        `SELECT COALESCE(MAX(kot_number), 0) + 1 as next_num 
         FROM kots WHERE outlet_id = $1`,
        [order.outlet_id]
      );
      const kotNumber = kotNumRes.rows[0].next_num;

      const kotRes = await client.query(
        `INSERT INTO kots (outlet_id, order_id, station_id, kot_number, status)
         VALUES ($1, $2, $3, $4, 'sent')
         RETURNING *`,
        [order.outlet_id, orderId, stationId, kotNumber]
      );
      const kot = kotRes.rows[0];

      for (const item of stationItems) {
        await client.query(
          `INSERT INTO kot_items (kot_id, order_item_id, quantity, status)
           VALUES ($1, $2, $3, 'queued')`,
          [kot.id, item.id, item.quantity]
        );

        // Update item status to sent
        await client.query(`UPDATE order_items SET status = 'sent' WHERE id = $1`, [item.id]);
      }

      generatedKots.push({ ...kot, items: stationItems });
    }

    // Update order status to kot_sent
    await client.query(
      `UPDATE orders SET status = 'kot_sent', updated_at = NOW(), version = version + 1 WHERE id = $1`,
      [orderId]
    );

    await recordAudit({
      outlet_id: order.outlet_id,
      user_id: userId,
      action: 'ORDER_KOT_SENT',
      entity_type: 'ORDER',
      entity_id: orderId,
      after_state: { kots_generated: generatedKots.length },
    });

    return generatedKots;
  });
}

export async function voidOrderItem(
  orderItemId: string,
  reason: string,
  approvalId: string | null,
  userId: string
) {
  return withTransaction(async (client) => {
    const itemRes = await client.query(
      `SELECT oi.*, o.outlet_id, o.status as order_status 
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1 FOR UPDATE`,
      [orderItemId]
    );

    if (itemRes.rows.length === 0) throw new Error('Order item not found');
    const item = itemRes.rows[0];

    if (item.is_voided) throw new Error('Item is already voided');

    // Rule: Before KOT (status === 'pending'), void is free without mandatory approval
    // After KOT (status !== 'pending'), manager approval PIN is strictly required!
    if (item.status !== 'pending' && !approvalId) {
      throw new Error('Voiding an item after KOT requires manager approval and valid reason');
    }

    let approvedBy = null;
    if (approvalId) {
      const appRes = await client.query(
        `SELECT approver_user_id FROM approvals WHERE id = $1`,
        [approvalId]
      );
      if (appRes.rows.length > 0) approvedBy = appRes.rows[0].approver_user_id;
    }

    const updated = await client.query(
      `UPDATE order_items 
       SET is_voided = TRUE, 
           void_reason = $1, 
           void_approved_by = $2, 
           void_at = NOW(),
           status = 'voided'
       WHERE id = $3
       RETURNING *`,
      [reason, approvedBy || userId, orderItemId]
    );

    await recordAudit({
      outlet_id: item.outlet_id,
      user_id: userId,
      action: 'ORDER_ITEM_VOID',
      entity_type: 'ORDER_ITEM',
      entity_id: orderItemId,
      before_state: { item_name: item.item_name, quantity: item.quantity, status: item.status },
      after_state: { is_voided: true, reason, approvedBy },
    });

    return updated.rows[0];
  });
}

export async function markItemComplimentary(
  orderItemId: string,
  reason: string,
  authorizerUserId: string
) {
  const res = await query(
    `UPDATE order_items 
     SET is_complimentary = TRUE, comp_reason = $1, comp_authorized_by = $2
     WHERE id = $3
     RETURNING *`,
    [reason, authorizerUserId, orderItemId]
  );
  if (res.rows.length === 0) throw new Error('Order item not found');
  return res.rows[0];
}

export async function reprintKOT(kotId: string, reason: string, userId: string) {
  const kotRes = await query(`SELECT * FROM kots WHERE id = $1`, [kotId]);
  if (kotRes.rows.length === 0) throw new Error('KOT ticket not found');

  const kot = kotRes.rows[0];
  const itemsRes = await query(
    `SELECT ki.*, oi.item_name 
     FROM kot_items ki
     JOIN order_items oi ON oi.id = ki.order_item_id
     WHERE ki.kot_id = $1`,
    [kotId]
  );

  await recordAudit({
    outlet_id: kot.outlet_id,
    user_id: userId,
    action: 'KOT_REPRINT_DUPLICATE',
    entity_type: 'KOT',
    entity_id: kotId,
    after_state: { kot_number: kot.kot_number, is_reprint: true, reason },
  });

  return {
    ...kot,
    is_reprint: true,
    reprint_reason: reason,
    items: itemsRes.rows,
  };
}

export async function getOrderDetails(orderId: string) {
  const orderRes = await query(
    `SELECT o.*, t.table_number, u.full_name as created_by_name
     FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users u ON u.id = o.created_by_user_id
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderRes.rows.length === 0) throw new Error('Order not found');

  const itemsRes = await query(
    `SELECT oi.*,
            COALESCE(
              json_agg(json_build_object('modifier_id', oim.modifier_id, 'name', oim.name, 'price_paise', oim.price_paise))
              FILTER (WHERE oim.id IS NOT NULL), '[]'::json
            ) as modifiers
     FROM order_items oi
     LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
     WHERE oi.order_id = $1
     GROUP BY oi.id
     ORDER BY oi.created_at ASC`,
    [orderId]
  );

  return {
    ...orderRes.rows[0],
    items: itemsRes.rows,
  };
}
