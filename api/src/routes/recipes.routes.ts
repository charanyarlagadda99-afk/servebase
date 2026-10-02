import { FastifyInstance } from 'fastify';
import { createRecipe, getRecipeForMenuItem } from '../services/recipes.js';
import { corePool } from '../services/core-pool.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function recipeRoutes(fastify: FastifyInstance) {
  // Get all active recipes
  fastify.get('/', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT r.*, m.name as menu_item_name, m.base_price_paise
       FROM recipes r
       JOIN menu_items m ON m.id = r.menu_item_id
       WHERE m.outlet_id = $1 AND r.is_active = TRUE
       ORDER BY m.name ASC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });

  // Get recipe for specific menu item
  fastify.get('/item/:menuItemId', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const recipe = await getRecipeForMenuItem(req.params.menuItemId, req.query.variant_id);
    return reply.send({ ok: true, data: recipe });
  });

  // Create recipe
  fastify.post('/', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const recipe = await createRecipe(req.body);
    return reply.send({ ok: true, data: recipe });
  });

  // Explode menu items into raw material ingredient consumption via C++ core engine
  const handleExplode = async (req: any, reply: any) => {
    const explosion = await corePool.execute('explode_recipe', req.body);
    return reply.send({ ok: true, data: explosion });
  };

  fastify.post('/explode', { preHandler: [authenticateToken] }, handleExplode);
  fastify.post('/cost-breakdown', { preHandler: [authenticateToken] }, handleExplode);
}
