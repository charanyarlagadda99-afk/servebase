import { FastifyInstance } from 'fastify';
import { upsertCustomer, getCustomer, awardLoyaltyPoints, redeemLoyaltyPoints } from '../services/customers.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function customerRoutes(fastify: FastifyInstance) {
  // Search / list customers
  fastify.get('/', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const q = req.query.q;
    let sql = 'SELECT * FROM customers WHERE deleted_at IS NULL';
    const params: any[] = [];
    if (q) {
      sql += ' AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const res = await query(sql, params);
    return reply.send({ ok: true, data: res.rows });
  });

  // Get customer by ID or phone
  fastify.get('/:identifier', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const cust = await getCustomer(req.params.identifier);
    if (!cust) {
      return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }
    return reply.send({ ok: true, data: cust });
  });

  // Create or update customer
  fastify.post('/', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const cust = await upsertCustomer(req.body);
    return reply.send({ ok: true, data: cust });
  });

  // Loyalty points redemption against order
  fastify.post('/:id/redeem-loyalty', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { points, order_id } = req.body;
    const result = await redeemLoyaltyPoints(req.params.id, points, order_id || req.params.id);
    return reply.send({ ok: true, data: result });
  });
}
