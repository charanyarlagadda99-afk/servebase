import { FastifyInstance } from 'fastify';
import { openShift, recordCashMovement, closeShift } from '../services/shifts.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function shiftRoutes(fastify: FastifyInstance) {
  // Get active shift for current terminal or user
  fastify.get('/current', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT s.*, u.full_name as user_name, t.name as terminal_name
       FROM shifts s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN terminals t ON t.id = s.terminal_id
       WHERE s.outlet_id = $1 AND s.status = 'open'
       ORDER BY s.opened_at DESC LIMIT 1`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows[0] || null });
  });

  // Open shift
  fastify.post('/open', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { terminal_id, opening_float_paise, business_date } = req.body;
    const shift = await openShift(
      req.outletId!,
      terminal_id || req.outletId!,
      req.user!.userId,
      opening_float_paise || 0,
      business_date || new Date().toISOString().split('T')[0]
    );
    return reply.send({ ok: true, data: shift });
  });

  // Record cash movement (paid_in, paid_out, drop, no_sale_open)
  fastify.post('/cash-movement', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { shift_id, movement_type, amount_paise, reason, authorized_by } = req.body;
    const result = await recordCashMovement(
      shift_id,
      movement_type,
      amount_paise || 0,
      reason,
      authorized_by || req.user!.userId,
      req.user!.userId
    );
    return reply.send({ ok: true, data: result });
  });

  // Close shift with physical denomination tally (reconciled via C++ core engine)
  fastify.post('/close', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { shift_id, actual_cash_paise, denominations, is_blind_close, notes } = req.body;
    const result = await closeShift(
      shift_id,
      actual_cash_paise || 0,
      denominations || {},
      is_blind_close ?? false,
      notes || '',
      req.user!.userId
    );
    return reply.send({ ok: true, data: result });
  });

  // Get shift report
  fastify.get('/:id/report', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const shiftRes = await query('SELECT * FROM shifts WHERE id = $1', [req.params.id]);
    const movementsRes = await query('SELECT * FROM shift_cash_movements WHERE shift_id = $1', [req.params.id]);
    return reply.send({
      ok: true,
      data: {
        shift: shiftRes.rows[0],
        movements: movementsRes.rows,
      },
    });
  });
}
