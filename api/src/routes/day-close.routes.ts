import { FastifyInstance } from 'fastify';
import { closeBusinessDay } from '../services/day-close.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function dayCloseRoutes(fastify: FastifyInstance) {
  // Pre-flight check for day close
  fastify.get('/precheck', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const outletId = req.outletId!;
    const businessDate = req.query.business_date || new Date().toISOString().split('T')[0];

    const openOrders = await query(
      `SELECT COUNT(*) FROM orders 
       WHERE outlet_id = $1 AND business_date = $2 AND status IN ('open', 'kot_sent', 'preparing', 'ready')`,
      [outletId, businessDate]
    );

    const unsettledBills = await query(
      `SELECT COUNT(*) FROM orders 
       WHERE outlet_id = $1 AND business_date = $2 AND status = 'billed'`,
      [outletId, businessDate]
    );

    const openShifts = await query(
      `SELECT COUNT(*) FROM shifts 
       WHERE outlet_id = $1 AND business_date = $2 AND status = 'open'`,
      [outletId, businessDate]
    );

    const isReady =
      Number(openOrders.rows[0].count) === 0 &&
      Number(unsettledBills.rows[0].count) === 0 &&
      Number(openShifts.rows[0].count) === 0;

    return reply.send({
      ok: true,
      data: {
        is_ready: isReady,
        open_orders_count: Number(openOrders.rows[0].count),
        unsettled_bills_count: Number(unsettledBills.rows[0].count),
        open_shifts_count: Number(openShifts.rows[0].count),
      },
    });
  });

  // Execute End-of-Day Z-Close
  fastify.post('/execute', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const businessDate = req.body.business_date || new Date().toISOString().split('T')[0];
    const result = await closeBusinessDay(req.outletId!, businessDate, req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Day close history / reports
  fastify.get('/history', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT dc.*, u.full_name as closed_by_name
       FROM day_closes dc
       JOIN users u ON u.id = dc.closed_by_user_id
       WHERE dc.outlet_id = $1
       ORDER BY dc.business_date DESC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });
}
