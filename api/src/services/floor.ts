import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export interface CreateTableInput {
  outlet_id: string;
  area_id: string;
  table_number: string;
  capacity?: number;
}

export async function createFloorArea(outletId: string, name: string, sortOrder = 0) {
  const res = await query(
    `INSERT INTO floor_areas (outlet_id, name, sort_order)
     VALUES ($1, $2, $3) RETURNING *`,
    [outletId, name, sortOrder]
  );
  return res.rows[0];
}

export async function createTable(input: CreateTableInput) {
  const res = await query(
    `INSERT INTO tables (outlet_id, area_id, table_number, capacity)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.outlet_id, input.area_id, input.table_number, input.capacity || 4]
  );
  return res.rows[0];
}

export async function getFloorLayout(outletId: string) {
  const areasRes = await query(
    `SELECT * FROM floor_areas WHERE outlet_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`,
    [outletId]
  );

  const tablesRes = await query(
    `SELECT t.*, 
            u.full_name as waiter_name,
            EXTRACT(EPOCH FROM (NOW() - t.status_updated_at))::int as idle_seconds,
            o.order_type,
            o.total_items_count
     FROM tables t
     LEFT JOIN users u ON u.id = t.assigned_waiter_id
     LEFT JOIN (
       SELECT order_id, COUNT(*) as total_items_count, MAX(o2.order_type) as order_type
       FROM order_items oi
       JOIN orders o2 ON o2.id = oi.order_id
       WHERE oi.is_voided = FALSE
       GROUP BY order_id
     ) o ON o.order_id = t.active_order_id
     WHERE t.outlet_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.table_number ASC`,
    [outletId]
  );

  const tablesByArea = areasRes.rows.map((area) => ({
    ...area,
    tables: tablesRes.rows.filter((t) => t.area_id === area.id),
  }));

  return { areas: tablesByArea };
}

export async function acquireTableLock(tableId: string, userId: string): Promise<boolean> {
  const now = new Date();
  const res = await query(
    `UPDATE tables 
     SET locked_by_user_id = $1, locked_at = $2
     WHERE id = $3 AND (locked_by_user_id IS NULL OR locked_by_user_id = $1 OR locked_at < NOW() - INTERVAL '2 minutes')
     RETURNING id, locked_by_user_id`,
    [userId, now, tableId]
  );
  return res.rows.length > 0;
}

export async function releaseTableLock(tableId: string, userId: string): Promise<boolean> {
  const res = await query(
    `UPDATE tables 
     SET locked_by_user_id = NULL, locked_at = NULL
     WHERE id = $1 AND locked_by_user_id = $2
     RETURNING id`,
    [tableId, userId]
  );
  return res.rows.length > 0;
}

export async function seatGuests(
  tableId: string,
  covers: number,
  waiterId: string,
  expectedVersion: number,
  userId: string
) {
  return withTransaction(async (client) => {
    // Optimistic locking
    const tableRes = await client.query(
      `SELECT * FROM tables WHERE id = $1 FOR UPDATE`,
      [tableId]
    );
    if (tableRes.rows.length === 0) throw new Error('Table not found');

    const table = tableRes.rows[0];
    if (table.version !== expectedVersion) {
      throw new Error(`Concurrency conflict: table was updated by another operator (expected v${expectedVersion}, found v${table.version})`);
    }

    if (table.status !== 'available' && table.status !== 'reserved') {
      throw new Error(`Cannot seat guests on table with status '${table.status}'`);
    }

    // Update table status
    const updatedRes = await client.query(
      `UPDATE tables 
       SET status = 'occupied',
           current_covers = $1,
           assigned_waiter_id = $2,
           status_updated_at = NOW(),
           version = version + 1
       WHERE id = $3
       RETURNING *`,
      [covers, waiterId, tableId]
    );

    await recordAudit({
      outlet_id: table.outlet_id,
      user_id: userId,
      action: 'TABLE_SEAT_GUESTS',
      entity_type: 'TABLE',
      entity_id: tableId,
      before_state: { status: table.status, covers: table.current_covers, version: table.version },
      after_state: { status: 'occupied', covers, waiterId, version: updatedRes.rows[0].version },
    });

    return updatedRes.rows[0];
  });
}

export async function moveTable(
  sourceTableId: string,
  targetTableId: string,
  sourceVersion: number,
  targetVersion: number,
  userId: string
) {
  return withTransaction(async (client) => {
    const srcRes = await client.query(`SELECT * FROM tables WHERE id = $1 FOR UPDATE`, [sourceTableId]);
    const tgtRes = await client.query(`SELECT * FROM tables WHERE id = $1 FOR UPDATE`, [targetTableId]);

    if (srcRes.rows.length === 0 || tgtRes.rows.length === 0) {
      throw new Error('Source or target table not found');
    }

    const src = srcRes.rows[0];
    const tgt = tgtRes.rows[0];

    if (src.version !== sourceVersion || tgt.version !== targetVersion) {
      throw new Error('Concurrency conflict on table move operation');
    }

    if (src.status !== 'occupied' || !src.active_order_id) {
      throw new Error('Source table is not occupied with an active order');
    }

    if (tgt.status !== 'available') {
      throw new Error(`Target table ${tgt.table_number} is not available (status: ${tgt.status})`);
    }

    // 1. Move active order reference to target table
    await client.query(
      `UPDATE orders SET table_id = $1, updated_at = NOW() WHERE id = $2`,
      [targetTableId, src.active_order_id]
    );

    // 2. Set target table to occupied with source's active order, covers, and assigned waiter
    const updatedTarget = await client.query(
      `UPDATE tables 
       SET status = 'occupied',
           active_order_id = $1,
           current_covers = $2,
           assigned_waiter_id = $3,
           status_updated_at = NOW(),
           version = version + 1
       WHERE id = $4
       RETURNING *`,
      [src.active_order_id, src.current_covers, src.assigned_waiter_id, targetTableId]
    );

    // 3. Clear source table to available
    const updatedSource = await client.query(
      `UPDATE tables 
       SET status = 'available',
           active_order_id = NULL,
           current_covers = 0,
           assigned_waiter_id = NULL,
           status_updated_at = NOW(),
           version = version + 1
       WHERE id = $1
       RETURNING *`,
      [sourceTableId]
    );

    await recordAudit({
      outlet_id: src.outlet_id,
      user_id: userId,
      action: 'TABLE_MOVE',
      entity_type: 'TABLE',
      entity_id: targetTableId,
      before_state: { sourceTable: src.table_number, targetTable: tgt.table_number, orderId: src.active_order_id },
      after_state: { sourceStatus: 'available', targetStatus: 'occupied' },
    });

    return { source: updatedSource.rows[0], target: updatedTarget.rows[0] };
  });
}

export async function mergeTables(
  primaryTableId: string,
  secondaryTableId: string,
  primaryVersion: number,
  secondaryVersion: number,
  userId: string
) {
  return withTransaction(async (client) => {
    const pRes = await client.query(`SELECT * FROM tables WHERE id = $1 FOR UPDATE`, [primaryTableId]);
    const sRes = await client.query(`SELECT * FROM tables WHERE id = $1 FOR UPDATE`, [secondaryTableId]);

    const primary = pRes.rows[0];
    const secondary = sRes.rows[0];

    if (!primary || !secondary) throw new Error('Tables not found');
    if (primary.version !== primaryVersion || secondary.version !== secondaryVersion) {
      throw new Error('Concurrency conflict on merge tables');
    }

    if (!primary.active_order_id || !secondary.active_order_id) {
      throw new Error('Both tables must have active orders to merge');
    }

    // Move items from secondary order to primary order
    await client.query(
      `UPDATE order_items SET order_id = $1 WHERE order_id = $2`,
      [primary.active_order_id, secondary.active_order_id]
    );

    // Cancel secondary order as merged
    await client.query(
      `UPDATE orders SET status = 'cancelled', notes = 'Merged into order ' || $1, updated_at = NOW() WHERE id = $2`,
      [primary.active_order_id, secondary.active_order_id]
    );

    // Sum covers on primary
    const totalCovers = Number(primary.current_covers) + Number(secondary.current_covers);
    const updatedPrimary = await client.query(
      `UPDATE tables SET current_covers = $1, version = version + 1 WHERE id = $2 RETURNING *`,
      [totalCovers, primaryTableId]
    );

    // Set secondary table to available
    const updatedSecondary = await client.query(
      `UPDATE tables 
       SET status = 'available', active_order_id = NULL, current_covers = 0, assigned_waiter_id = NULL, version = version + 1
       WHERE id = $1 RETURNING *`,
      [secondaryTableId]
    );

    await recordAudit({
      outlet_id: primary.outlet_id,
      user_id: userId,
      action: 'TABLE_MERGE',
      entity_type: 'TABLE',
      entity_id: primaryTableId,
      after_state: {
        primaryTable: primary.table_number,
        secondaryTable: secondary.table_number,
        retainedOrderId: primary.active_order_id,
        mergedCovers: totalCovers,
      },
    });

    return { primary: updatedPrimary.rows[0], secondary: updatedSecondary.rows[0] };
  });
}
