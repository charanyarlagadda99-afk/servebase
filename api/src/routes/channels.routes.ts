import { FastifyInstance } from 'fastify';
import {
  getChannels,
  simulateAggregatorOrderWebhook,
  updateRiderStatus,
} from '../services/channels.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function channelRoutes(fastify: FastifyInstance) {
  // Get active channels (Zomato, Swiggy, Direct Web)
  fastify.get('/', { preHandler: [authenticateToken] }, async (req, reply) => {
    const channels = await getChannels(req.outletId!);
    return reply.send({ ok: true, data: channels });
  });

  // Simulated aggregator webhook intake
  fastify.post('/simulate-order', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const result = await simulateAggregatorOrderWebhook({
      ...req.body,
      outlet_id: req.outletId!,
      business_date: req.body.business_date || new Date().toISOString().split('T')[0],
      system_user_id: req.user!.userId,
    });
    return reply.send({ ok: true, data: result, simulated: true });
  });

  // Update online rider delivery status
  fastify.post('/rider-status', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { order_id, status } = req.body;
    const result = await updateRiderStatus(order_id, status);
    return reply.send({ ok: true, data: result });
  });

  // Channel payout reconciliation report (Gross - Commission - GST = Net Payout)
  fastify.get('/payout-reconciliation', { preHandler: [authenticateToken] }, async (req, reply) => {
    const ordersRes = await query(
      `SELECT o.*, c.name as channel_name, c.commission_percent, i.total_paise
       FROM orders o
       JOIN channels c ON c.id = o.channel_id
       LEFT JOIN invoices i ON i.order_id = o.id
       WHERE o.outlet_id = $1 AND o.order_type = 'aggregator'
       ORDER BY o.created_at DESC LIMIT 50`,
      [req.outletId!]
    );

    const reconciliation = ordersRes.rows.map((row) => {
      const grossPaise = Number(row.total_paise || 0);
      const commissionPct = Number(row.commission_percent || 20.0);
      const commissionPaise = Math.round(grossPaise * (commissionPct / 100.0));
      const netPayoutPaise = grossPaise - commissionPaise;
      return {
        order_id: row.id,
        channel: row.channel_name,
        gross_paise: grossPaise,
        commission_percent: commissionPct,
        commission_paise: commissionPaise,
        net_payout_paise: netPayoutPaise,
        status: row.status,
      };
    });

    return reply.send({ ok: true, data: reconciliation });
  });
}
