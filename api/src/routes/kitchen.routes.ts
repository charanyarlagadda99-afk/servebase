import { FastifyInstance } from 'fastify';
import {
  getStationQueue,
  bumpKotItem,
  bumpKot,
  recallKot,
  getExpediterSummary,
} from '../services/kds.js';
import { authenticateToken } from '../middleware/auth.js';

export async function kitchenRoutes(fastify: FastifyInstance) {
  // Get active tickets for station
  const handleTickets = async (req: any, reply: any) => {
    const { station_id, station, show_bumped } = req.query;
    const tickets = await getStationQueue(req.outletId!, station_id || station, {
      showBumped: show_bumped === 'true',
    });
    return reply.send({ ok: true, data: tickets });
  };

  fastify.get('/tickets', { preHandler: [authenticateToken] }, handleTickets);
  fastify.get('/queue', { preHandler: [authenticateToken] }, handleTickets);

  // Bump individual line item
  fastify.post('/bump-item', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { kot_item_id } = req.body;
    const result = await bumpKotItem(kot_item_id, req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Bump entire ticket
  const handleBump = async (req: any, reply: any) => {
    const { kot_id } = req.body;
    const result = await bumpKot(kot_id, req.user!.userId);
    return reply.send({ ok: true, data: result });
  };

  fastify.post('/bump-ticket', { preHandler: [authenticateToken] }, handleBump);
  fastify.post('/bump', { preHandler: [authenticateToken] }, handleBump);

  // Recall bumped ticket
  fastify.post('/recall', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { kot_id } = req.body;
    const result = await recallKot(kot_id, req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Expediter pass summary / all-day counts
  fastify.get('/all-day', { preHandler: [authenticateToken] }, async (req, reply) => {
    const counts = await getExpediterSummary(req.outletId!);
    return reply.send({ ok: true, data: counts });
  });
}
