import { FastifyInstance } from 'fastify';
import { syncOfflineBatch } from '../services/sync.js';
import { authenticateToken } from '../middleware/auth.js';

export async function syncRoutes(fastify: FastifyInstance) {
  // Offline-first sync push endpoint
  fastify.post('/push', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { terminal_id, batch } = req.body;
    const result = await syncOfflineBatch(
      terminal_id || req.outletId!,
      batch || [],
      req.user!.userId
    );
    return reply.send({ ok: true, data: result });
  });

  // Client sync status check
  fastify.get('/status', { preHandler: [authenticateToken] }, async (req, reply) => {
    return reply.send({
      ok: true,
      data: {
        server_time: new Date().toISOString(),
        outlet_id: req.outletId,
        sync_supported: true,
      },
    });
  });
}
