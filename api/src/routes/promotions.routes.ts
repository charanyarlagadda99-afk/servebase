import { FastifyInstance } from 'fastify';
import { createCoupon, validateAndApplyCoupon } from '../services/promotions.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function promotionRoutes(fastify: FastifyInstance) {
  // Get active coupons for outlet
  fastify.get('/coupons', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT * FROM coupons 
       WHERE outlet_id = $1 AND is_active = TRUE AND valid_until >= CURRENT_DATE
       ORDER BY created_at DESC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });

  // Create coupon
  fastify.post('/coupons', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const coupon = await createCoupon({
      ...req.body,
      outlet_id: req.outletId!,
    });
    return reply.send({ ok: true, data: coupon });
  });

  // Validate and calculate coupon discount against order subtotal
  fastify.post('/validate', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { code, subtotal_paise } = req.body;
    const result = await validateAndApplyCoupon(req.outletId!, code, subtotal_paise);
    return reply.send({ ok: true, data: result });
  });
}
