import { FastifyInstance } from 'fastify';
import { processPayment } from '../services/payments.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  // Process single payment tender
  const handlePayment = async (req: any, reply: any) => {
    const payment = await processPayment({
      ...req.body,
      outlet_id: req.outletId!,
      user_id: req.user!.userId,
      idempotency_key: req.body.idempotency_key || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    });
    return reply.send({ ok: true, data: payment });
  };

  fastify.post('/process', { preHandler: [authenticateToken] }, handlePayment);
  fastify.post('/record', { preHandler: [authenticateToken] }, handlePayment);

  // Process split payment across multiple tenders
  fastify.post('/split', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { invoice_id, order_id, tenders } = req.body;
    const processedTenders = [];

    for (let i = 0; i < tenders.length; i++) {
      const t = tenders[i];
      const p = await processPayment({
        outlet_id: req.outletId!,
        invoice_id,
        order_id,
        payment_method: t.payment_method,
        amount_paise: t.amount_paise,
        room_number: t.room_number,
        idempotency_key: t.idempotency_key || `SPLIT-${invoice_id}-${i}-${Date.now()}`,
        user_id: req.user!.userId,
      });
      processedTenders.push(p);
    }

    return reply.send({ ok: true, data: { tenders: processedTenders } });
  });

  // Refund payment
  fastify.post('/refund', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { payment_id, reason } = req.body;
    const res = await query(
      `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [payment_id]
    );
    if (res.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
    }
    return reply.send({ ok: true, data: { ...res.rows[0], refund_reason: reason } });
  });
}
