import { query, withTransaction } from '../db/pool.js';
import { realtimeBus } from './realtime.js';

export interface KotItemSummary {
  id: string;
  order_item_id: string;
  item_name: string;
  quantity: number;
  course: string;
  course_status: string;
  notes: string | null;
  status: string; // 'queued', 'preparing', 'ready', 'bumped'
  modifiers: Array<{ name: string; price_paise: number }>;
}

export interface KotQueueEntry {
  kot_id: string;
  kot_number: number;
  station_id: string;
  station_name: string;
  station_code: string;
  order_id: string;
  order_number: number;
  order_type: string;
  table_number: string | null;
  server_name: string;
  status: string; // 'sent', 'preparing', 'ready', 'bumped'
  created_at: string;
  elapsed_seconds: number;
  urgency: 'normal' | 'warning' | 'critical';
  items: KotItemSummary[];
}

export async function getStationQueue(
  outletId: string,
  stationId?: string,
  options?: { showBumped?: boolean; limit?: number }
): Promise<KotQueueEntry[]> {
  const showBumped = options?.showBumped ?? false;
  const limit = options?.limit ?? 50;

  let filterClause = `k.outlet_id = $1`;
  const params: any[] = [outletId];

  if (stationId) {
    params.push(stationId);
    filterClause += ` AND k.station_id = $${params.length}`;
  }

  if (!showBumped) {
    filterClause += ` AND k.status != 'bumped'`;
  }

  params.push(limit);
  const sql = `
    SELECT 
      k.id as kot_id,
      k.kot_number,
      k.station_id,
      s.name as station_name,
      s.station_code,
      k.order_id,
      SUBSTRING(o.id::text, 1, 8) as order_number,
      o.order_type,
      t.table_number,
      u.full_name as server_name,
      k.status,
      k.created_at,
      EXTRACT(EPOCH FROM (NOW() - k.created_at))::int as elapsed_seconds
    FROM kots k
    JOIN kitchen_stations s ON s.id = k.station_id
    JOIN orders o ON o.id = k.order_id
    LEFT JOIN tables t ON t.id = o.table_id
    JOIN users u ON u.id = o.created_by_user_id
    WHERE ${filterClause}
    ORDER BY k.created_at ASC
    LIMIT $${params.length}
  `;

  const kotRows = await query(sql, params);
  if (kotRows.rows.length === 0) return [];

  const kotIds = kotRows.rows.map((r) => r.kot_id);

  // Fetch items for all these KOTs
  const itemsSql = `
    SELECT 
      ki.id as kot_item_id,
      ki.kot_id,
      ki.order_item_id,
      ki.quantity,
      ki.status,
      oi.item_name,
      oi.course,
      oi.course_status,
      oi.notes
    FROM kot_items ki
    JOIN order_items oi ON oi.id = ki.order_item_id
    WHERE ki.kot_id = ANY($1)
    ORDER BY ki.created_at ASC
  `;
  const itemRows = await query(itemsSql, [kotIds]);

  // Fetch modifiers for items
  const orderItemIds = itemRows.rows.map((r) => r.order_item_id);
  let modifierMap: Record<string, Array<{ name: string; price_paise: number }>> = {};
  if (orderItemIds.length > 0) {
    const modSql = `
      SELECT order_item_id, name, price_paise 
      FROM order_item_modifiers 
      WHERE order_item_id = ANY($1)
    `;
    const modRows = await query(modSql, [orderItemIds]);
    for (const m of modRows.rows) {
      if (!modifierMap[m.order_item_id]) modifierMap[m.order_item_id] = [];
      modifierMap[m.order_item_id].push({ name: m.name, price_paise: Number(m.price_paise) });
    }
  }

  // Group items by KOT
  const itemsByKot: Record<string, KotItemSummary[]> = {};
  for (const row of itemRows.rows) {
    if (!itemsByKot[row.kot_id]) itemsByKot[row.kot_id] = [];
    itemsByKot[row.kot_id].push({
      id: row.kot_item_id,
      order_item_id: row.order_item_id,
      item_name: row.item_name,
      quantity: row.quantity,
      course: row.course,
      course_status: row.course_status,
      notes: row.notes,
      status: row.status,
      modifiers: modifierMap[row.order_item_id] || [],
    });
  }

  return kotRows.rows.map((k) => {
    const elapsed = k.elapsed_seconds || 0;
    let urgency: 'normal' | 'warning' | 'critical' = 'normal';
    if (elapsed > 900) urgency = 'critical'; // > 15 mins
    else if (elapsed > 600) urgency = 'warning'; // > 10 mins

    return {
      kot_id: k.kot_id,
      kot_number: k.kot_number,
      station_id: k.station_id,
      station_name: k.station_name,
      station_code: k.station_code,
      order_id: k.order_id,
      order_number: k.order_number,
      order_type: k.order_type,
      table_number: k.table_number,
      server_name: k.server_name,
      status: k.status,
      created_at: k.created_at,
      elapsed_seconds: elapsed,
      urgency,
      items: itemsByKot[k.kot_id] || [],
    };
  });
}

export async function bumpKotItem(
  kotItemId: string,
  targetStatus: 'preparing' | 'ready' | 'bumped' = 'bumped',
  userId?: string
) {
  return withTransaction(async (client) => {
    const itemRes = await client.query(
      `SELECT ki.*, k.outlet_id, k.station_id, k.order_id 
       FROM kot_items ki
       JOIN kots k ON k.id = ki.kot_id
       WHERE ki.id = $1 FOR UPDATE`,
      [kotItemId]
    );
    if (itemRes.rows.length === 0) throw new Error('KOT item not found');
    const item = itemRes.rows[0];

    const bumpedAt = targetStatus === 'bumped' ? new Date() : null;
    await client.query(
      `UPDATE kot_items SET status = $1, bumped_at = $2 WHERE id = $3`,
      [targetStatus, bumpedAt, kotItemId]
    );

    // Update underlying order item status
    const orderItemStatus = targetStatus === 'bumped' ? 'ready' : targetStatus;
    await client.query(
      `UPDATE order_items SET status = $1 WHERE id = $2`,
      [orderItemStatus, item.order_item_id]
    );

    // Check if all items in KOT are now bumped
    const remainingRes = await client.query(
      `SELECT COUNT(id) as unbumped_count FROM kot_items WHERE kot_id = $1 AND status != 'bumped'`,
      [item.kot_id]
    );
    const unbumped = Number(remainingRes.rows[0].unbumped_count);
    let kotBumped = false;

    if (unbumped === 0) {
      await client.query(
        `UPDATE kots SET status = 'bumped', bumped_at = NOW() WHERE id = $1`,
        [item.kot_id]
      );
      kotBumped = true;
    }

    const event = realtimeBus.publish({
      outlet_id: item.outlet_id,
      station_id: item.station_id,
      order_id: item.order_id,
      type: 'ITEM_BUMPED',
      data: {
        kot_item_id: kotItemId,
        kot_id: item.kot_id,
        status: targetStatus,
        kot_bumped: kotBumped,
        user_id: userId,
      },
    });

    return { kotItemId, targetStatus, kotBumped, event };
  });
}

export async function bumpKot(kotId: string, userId?: string) {
  return withTransaction(async (client) => {
    const kotRes = await client.query(
      `SELECT * FROM kots WHERE id = $1 FOR UPDATE`,
      [kotId]
    );
    if (kotRes.rows.length === 0) throw new Error('KOT not found');
    const kot = kotRes.rows[0];

    // Bump all items
    await client.query(
      `UPDATE kot_items SET status = 'bumped', bumped_at = NOW() WHERE kot_id = $1`,
      [kotId]
    );

    // Bump KOT ticket
    await client.query(
      `UPDATE kots SET status = 'bumped', bumped_at = NOW() WHERE id = $1`,
      [kotId]
    );

    // Update corresponding order items to ready
    await client.query(
      `UPDATE order_items 
       SET status = 'ready' 
       WHERE id IN (SELECT order_item_id FROM kot_items WHERE kot_id = $1)`,
      [kotId]
    );

    const event = realtimeBus.publish({
      outlet_id: kot.outlet_id,
      station_id: kot.station_id,
      order_id: kot.order_id,
      type: 'KOT_BUMPED',
      data: {
        kot_id: kotId,
        user_id: userId,
        bumped_at: new Date().toISOString(),
      },
    });

    return { kotId, status: 'bumped', event };
  });
}

export async function recallKot(kotId: string, userId: string) {
  return withTransaction(async (client) => {
    const kotRes = await client.query(
      `SELECT * FROM kots WHERE id = $1 FOR UPDATE`,
      [kotId]
    );
    if (kotRes.rows.length === 0) throw new Error('KOT not found');
    const kot = kotRes.rows[0];

    if (kot.status !== 'bumped') {
      throw new Error(`Cannot recall KOT with status '${kot.status}'`);
    }

    // Restore KOT to preparing
    await client.query(
      `UPDATE kots 
       SET status = 'preparing', bumped_at = NULL, recalled_at = NOW() 
       WHERE id = $1`,
      [kotId]
    );

    // Restore items to preparing
    await client.query(
      `UPDATE kot_items 
       SET status = 'preparing', bumped_at = NULL 
       WHERE kot_id = $1`,
      [kotId]
    );

    // Restore order items to preparing
    await client.query(
      `UPDATE order_items 
       SET status = 'preparing' 
       WHERE id IN (SELECT order_item_id FROM kot_items WHERE kot_id = $1)`,
      [kotId]
    );

    const event = realtimeBus.publish({
      outlet_id: kot.outlet_id,
      station_id: kot.station_id,
      order_id: kot.order_id,
      type: 'KOT_RECALLED',
      data: {
        kot_id: kotId,
        user_id: userId,
        recalled_at: new Date().toISOString(),
      },
    });

    return { kotId, status: 'preparing', event };
  });
}

export async function fireCourse(
  orderId: string,
  course: 'starters' | 'mains' | 'desserts' | 'beverages',
  userId: string
) {
  return withTransaction(async (client) => {
    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    // Fire all order items in that course
    const updateRes = await client.query(
      `UPDATE order_items 
       SET course_status = 'fire' 
       WHERE order_id = $1 AND course = $2 AND course_status = 'hold'
       RETURNING id, item_name`,
      [orderId, course]
    );

    const firedCount = updateRes.rows.length;

    const event = realtimeBus.publish({
      outlet_id: order.outlet_id,
      order_id: orderId,
      table_id: order.table_id,
      type: 'COURSE_FIRED',
      data: {
        order_id: orderId,
        course,
        items_fired: firedCount,
        user_id: userId,
      },
    });

    return { orderId, course, firedCount, event };
  });
}

export async function getExpediterSummary(outletId: string) {
  const sql = `
    SELECT 
      o.id as order_id,
      SUBSTRING(o.id::text, 1, 8) as order_number,
      o.order_type,
      t.table_number,
      o.created_at as order_created_at,
      u.full_name as server_name,
      COUNT(DISTINCT k.id) as total_kots,
      COUNT(DISTINCT CASE WHEN k.status = 'bumped' THEN k.id END) as bumped_kots,
      COUNT(DISTINCT ki.id) as total_items,
      COUNT(DISTINCT CASE WHEN ki.status = 'bumped' THEN ki.id END) as bumped_items
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    JOIN users u ON u.id = o.created_by_user_id
    JOIN kots k ON k.order_id = o.id
    JOIN kot_items ki ON ki.kot_id = k.id
    WHERE o.outlet_id = $1 AND o.status NOT IN ('billed', 'paid', 'closed', 'cancelled')
    GROUP BY o.id, o.order_type, t.table_number, o.created_at, u.full_name
    ORDER BY o.created_at ASC
  `;

  const res = await query(sql, [outletId]);
  return res.rows.map((row) => ({
    order_id: row.order_id,
    order_number: row.order_number,
    order_type: row.order_type,
    table_number: row.table_number,
    server_name: row.server_name,
    order_created_at: row.order_created_at,
    total_kots: Number(row.total_kots),
    bumped_kots: Number(row.bumped_kots),
    is_ready_for_dispatch: Number(row.total_kots) > 0 && Number(row.total_kots) === Number(row.bumped_kots),
    total_items: Number(row.total_items),
    bumped_items: Number(row.bumped_items),
  }));
}

export async function getKitchenPerformanceMetrics(
  outletId: string,
  startDate?: string,
  endDate?: string
) {
  let filter = `k.outlet_id = $1`;
  const params: any[] = [outletId];

  if (startDate) {
    params.push(startDate);
    filter += ` AND k.created_at >= $${params.length}::timestamptz`;
  }
  if (endDate) {
    params.push(endDate);
    filter += ` AND k.created_at <= $${params.length}::timestamptz`;
  }

  // Overall metrics
  const overallSql = `
    SELECT 
      COUNT(k.id) as total_kots,
      COUNT(k.bumped_at) as bumped_kots,
      COALESCE(AVG(EXTRACT(EPOCH FROM (k.bumped_at - k.created_at)))::int, 0) as avg_prep_time_seconds,
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (k.bumped_at - k.created_at)) > 900 THEN 1 END) as delayed_kots_count
    FROM kots k
    WHERE ${filter}
  `;
  const overallRes = await query(overallSql, params);
  const overall = overallRes.rows[0];

  // Station breakdown
  const stationSql = `
    SELECT 
      s.id as station_id,
      s.name as station_name,
      s.station_code,
      COUNT(k.id) as total_kots,
      COUNT(k.bumped_at) as bumped_kots,
      COALESCE(AVG(EXTRACT(EPOCH FROM (k.bumped_at - k.created_at)))::int, 0) as avg_prep_time_seconds
    FROM kitchen_stations s
    LEFT JOIN kots k ON k.station_id = s.id AND ${filter}
    WHERE s.outlet_id = $1
    GROUP BY s.id, s.name, s.station_code
    ORDER BY s.name ASC
  `;
  const stationRes = await query(stationSql, params);

  return {
    total_kots: Number(overall.total_kots),
    bumped_kots: Number(overall.bumped_kots),
    avg_prep_time_seconds: Number(overall.avg_prep_time_seconds),
    delayed_kots_count: Number(overall.delayed_kots_count),
    station_metrics: stationRes.rows.map((s) => ({
      station_id: s.station_id,
      station_name: s.station_name,
      station_code: s.station_code,
      total_kots: Number(s.total_kots),
      bumped_kots: Number(s.bumped_kots),
      avg_prep_time_seconds: Number(s.avg_prep_time_seconds),
    })),
  };
}
