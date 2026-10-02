import { FastifyInstance } from 'fastify';
import { getFullMenu, getCategories, createMenuItem, toggleItemAvailability, createCategory } from '../services/menu.js';
import { authenticateToken } from '../middleware/auth.js';

export async function menuRoutes(fastify: FastifyInstance) {
  // Get full menu for active outlet
  const handleGetMenu = async (req: any, reply: any) => {
    const menu = await getFullMenu(req.outletId!);
    return reply.send({ ok: true, data: menu });
  };

  fastify.get('/', { preHandler: [authenticateToken] }, handleGetMenu);
  fastify.get('/items', { preHandler: [authenticateToken] }, handleGetMenu);

  // Get categories
  fastify.get('/categories', { preHandler: [authenticateToken] }, async (req, reply) => {
    const categories = await getCategories(req.outletId!);
    return reply.send({ ok: true, data: categories });
  });

  // Create category
  fastify.post('/categories', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { name, sort_order, parent_id } = req.body;
    const cat = await createCategory(req.outletId!, name, sort_order || 0, parent_id);
    return reply.send({ ok: true, data: cat });
  });

  // Create menu item
  fastify.post('/items', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const item = await createMenuItem(
      {
        ...req.body,
        outlet_id: req.outletId!,
      },
      req.user!.userId
    );
    return reply.send({ ok: true, data: item });
  });

  // Toggle item availability (86 item)
  fastify.patch('/items/:id/availability', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { id } = req.params;
    const { is_available } = req.body;
    const result = await toggleItemAvailability(id, is_available, req.user!.userId);
    return reply.send({ ok: true, data: result });
  });
}
