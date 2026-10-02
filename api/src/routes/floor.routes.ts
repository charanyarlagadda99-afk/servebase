import { FastifyInstance } from 'fastify';
import { getFloorLayout, moveTable, mergeTables, seatGuests, acquireTableLock, releaseTableLock } from '../services/floor.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function floorRoutes(fastify: FastifyInstance) {
  // Get full floor layout with areas and live table statuses
  fastify.get('/layout', { preHandler: [authenticateToken] }, async (req, reply) => {
    const layout = await getFloorLayout(req.outletId!);
    return reply.send({ ok: true, data: layout });
  });

  // Get flat tables list
  fastify.get('/tables', { preHandler: [authenticateToken] }, async (req, reply) => {
    const layout = await getFloorLayout(req.outletId!);
    const allTables = layout.areas.flatMap((a: any) => a.tables);
    return reply.send({ ok: true, data: allTables });
  });

  // Update table status directly
  fastify.patch('/tables/:id/status', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { id } = req.params;
    const { status, covers, waiter_id } = req.body;
    const res = await query(
      `UPDATE tables
       SET status = COALESCE($1, status),
           current_covers = COALESCE($2, current_covers),
           assigned_waiter_id = COALESCE($3, assigned_waiter_id),
           status_updated_at = NOW(),
           version = version + 1
       WHERE id = $4
       RETURNING *`,
      [status, covers, waiter_id, id]
    );
    return reply.send({ ok: true, data: res.rows[0] });
  });

  // Seat guests at table
  fastify.post('/tables/:id/seat', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { id } = req.params;
    const { covers, waiter_id, order_type } = req.body;
    const result = await seatGuests(id, covers || 2, waiter_id, order_type || 'dine_in', req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Acquire table lock for optimistic concurrency
  fastify.post('/tables/:id/lock', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const acquired = await acquireTableLock(req.params.id, req.user!.userId);
    return reply.send({ ok: true, data: { locked: acquired } });
  });

  // Release table lock
  fastify.post('/tables/:id/unlock', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const released = await releaseTableLock(req.params.id, req.user!.userId);
    return reply.send({ ok: true, data: { unlocked: released } });
  });

  // Move table
  fastify.post('/move', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { source_table_id, target_table_id, reason, approval_id } = req.body;
    const result = await moveTable(source_table_id, target_table_id, req.user!.userId, reason || 'Customer request', approval_id);
    return reply.send({ ok: true, data: result });
  });

  // Merge tables
  fastify.post('/merge', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { primary_table_id, secondary_table_ids, reason, approval_id } = req.body;
    const result = await mergeTables(secondary_table_ids || [], primary_table_id, req.user!.userId, reason || 'Large party', approval_id);
    return reply.send({ ok: true, data: result });
  });
}
