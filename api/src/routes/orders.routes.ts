import { FastifyInstance } from 'fastify';
import {
  createOrder,
  getOrderDetails,
  addItemsToOrder,
  voidOrderItem,
  markItemComplimentary,
  sendKOT,
} from '../services/orders.js';
import { fireCourse } from '../services/kds.js';
import { query, withTransaction } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function orderRoutes(fastify: FastifyInstance) {
  // Create new order
  const handleCreateOrder = async (req: any, reply: any) => {
    const order = await createOrder({
      ...req.body,
      outlet_id: req.outletId!,
      user_id: req.user!.userId,
      business_date: req.body.business_date || new Date().toISOString().split('T')[0],
    });
    return reply.send({ ok: true, data: order });
  };

  fastify.post('/', { preHandler: [authenticateToken] }, handleCreateOrder);
  fastify.post('/create', { preHandler: [authenticateToken] }, handleCreateOrder);

  // Get active orders for current outlet
  fastify.get('/', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT o.*, t.table_number, u.full_name as created_by_name
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.created_by_user_id
       WHERE o.outlet_id = $1 AND o.status NOT IN ('closed', 'cancelled')
       ORDER BY o.created_at DESC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });

  // Get order details by ID
  fastify.get('/:id', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const order = await getOrderDetails(req.params.id);
    return reply.send({ ok: true, data: order });
  });

  // Add items to order
  fastify.post('/:id/items', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const result = await addItemsToOrder(req.params.id, req.body.items, req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Generate KOT tickets from order
  fastify.post('/:id/kot', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const kots = await sendKOT(req.params.id, req.user!.userId);
    return reply.send({ ok: true, data: kots });
  });

  // Void item from order
  fastify.post('/:id/void-item', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { order_item_id, reason, approval_id } = req.body;
    const result = await voidOrderItem(order_item_id, reason || 'Customer changed mind', approval_id || null, req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Mark item complimentary
  fastify.post('/:id/complimentary', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { order_item_id, reason } = req.body;
    const result = await markItemComplimentary(order_item_id, reason || 'Complimentary item', req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Fire course
  fastify.post('/:id/fire', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { course } = req.body;
    const result = await fireCourse(req.params.id, course || 'main', req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Cancel order
  fastify.post('/:id/cancel', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await withTransaction(async (client) => {
      const ordRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      if (ordRes.rows.length === 0) throw new Error('Order not found');
      const order = ordRes.rows[0];

      if (['billed', 'paid', 'closed'].includes(order.status)) {
        throw new Error(`Cannot cancel order in '${order.status}' status`);
      }

      const updatedRes = await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );

      // Release table if linked
      if (order.table_id) {
        await client.query(
          `UPDATE tables SET active_order_id = NULL, status = 'available', current_covers = 0 WHERE id = $1`,
          [order.table_id]
        );
      }

      return updatedRes.rows[0];
    });
    return reply.send({ ok: true, data: result });
  });
}
