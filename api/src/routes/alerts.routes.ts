import { FastifyInstance } from 'fastify';
import { getAlerts, markAlertRead, createAlert } from '../services/alerts.js';
import { authenticateToken } from '../middleware/auth.js';

export async function alertRoutes(fastify: FastifyInstance) {
  // Get active system alerts
  const handleGetAlerts = async (req: any, reply: any) => {
    const unreadOnly = req.query.unread_only === 'true';
    const alerts = await getAlerts(req.outletId!, unreadOnly);
    return reply.send({ ok: true, data: alerts });
  };

  fastify.get('/', { preHandler: [authenticateToken] }, handleGetAlerts);
  fastify.get('/active', { preHandler: [authenticateToken] }, handleGetAlerts);

  // Create alert
  fastify.post('/', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const alert = await createAlert({
      ...req.body,
      outlet_id: req.outletId!,
    });
    return reply.send({ ok: true, data: alert });
  });

  // Acknowledge / mark alert as read
  fastify.post('/:id/acknowledge', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const updated = await markAlertRead(req.params.id);
    return reply.send({ ok: true, data: updated });
  });
}
