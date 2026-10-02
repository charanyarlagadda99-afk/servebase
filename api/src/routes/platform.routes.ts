import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function platformRoutes(fastify: FastifyInstance) {
  // Public or token-authenticated platform hierarchy
  fastify.get('/hierarchy', async (_req, reply) => {
    const orgsRes = await query('SELECT * FROM organizations WHERE deleted_at IS NULL ORDER BY created_at ASC');
    const brandsRes = await query('SELECT * FROM brands WHERE deleted_at IS NULL ORDER BY created_at ASC');
    const outletsRes = await query('SELECT * FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC');
    const terminalsRes = await query('SELECT * FROM terminals WHERE deleted_at IS NULL ORDER BY created_at ASC');

    return reply.send({
      ok: true,
      data: {
        organizations: orgsRes.rows,
        brands: brandsRes.rows,
        outlets: outletsRes.rows,
        terminals: terminalsRes.rows,
      },
    });
  });

  // Organizations list
  fastify.get('/businesses', { preHandler: [authenticateToken] }, async (_req, reply) => {
    const res = await query('SELECT * FROM organizations WHERE deleted_at IS NULL ORDER BY name ASC');
    return reply.send({ ok: true, data: res.rows });
  });

  // Outlets list
  fastify.get('/outlets', async (_req, reply) => {
    const res = await query('SELECT * FROM outlets WHERE deleted_at IS NULL ORDER BY name ASC');
    return reply.send({ ok: true, data: res.rows });
  });

  // Outlet settings
  fastify.get('/settings', { preHandler: [authenticateToken] }, async (req, reply) => {
    const outletId = req.outletId;
    const res = await query('SELECT * FROM outlet_settings WHERE outlet_id = $1', [outletId]);
    return reply.send({ ok: true, data: res.rows[0] || null });
  });

  // Update outlet settings
  fastify.patch('/settings', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const outletId = req.outletId;
    const s = req.body;
    const res = await query(
      `UPDATE outlet_settings
       SET tax_mode = COALESCE($1, tax_mode),
           price_includes_tax = COALESCE($2, price_includes_tax),
           business_day_cutoff_hour = COALESCE($3, business_day_cutoff_hour),
           target_food_cost_pct = COALESCE($4, target_food_cost_pct),
           target_labor_cost_pct = COALESCE($5, target_labor_cost_pct),
           target_prime_cost_pct = COALESCE($6, target_prime_cost_pct),
           updated_at = NOW()
       WHERE outlet_id = $7
       RETURNING *`,
      [
        s.tax_mode,
        s.price_includes_tax,
        s.business_day_cutoff_hour,
        s.target_food_cost_pct,
        s.target_labor_cost_pct,
        s.target_prime_cost_pct,
        outletId,
      ]
    );
    return reply.send({ ok: true, data: res.rows[0] });
  });
}
