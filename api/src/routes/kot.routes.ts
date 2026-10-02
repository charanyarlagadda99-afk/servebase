import { FastifyInstance } from 'fastify';
import { sendKOT } from '../services/orders.js';
import { getStationQueue } from '../services/kds.js';
import { authenticateToken } from '../middleware/auth.js';

export async function kotRoutes(fastify: FastifyInstance) {
  // Generate KOT tickets from active order and dispatch to stations
  fastify.post('/generate', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { order_id } = req.body;
    const kots = await sendKOT(order_id, req.user!.userId);
    return reply.send({ ok: true, data: kots });
  });

  // Get KOT tickets list
  fastify.get('/tickets', { preHandler: [authenticateToken] }, async (req, reply) => {
    const tickets = await getStationQueue(req.outletId!);
    return reply.send({ ok: true, data: tickets });
  });
}
