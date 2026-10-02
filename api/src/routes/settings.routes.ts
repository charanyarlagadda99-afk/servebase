import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get all outlet settings
  fastify.get('/', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query('SELECT * FROM outlet_settings WHERE outlet_id = $1', [req.outletId!]);
    return reply.send({ ok: true, data: res.rows[0] || {} });
  });

  // Update outlet settings
  fastify.put('/', { preHandler: [authenticateToken] }, async (req: any, reply) => {
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
        req.outletId!,
      ]
    );
    return reply.send({ ok: true, data: res.rows[0] });
  });
}
