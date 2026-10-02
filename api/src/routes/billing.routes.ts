import { FastifyInstance } from 'fastify';
import { finalizeBill, createCreditNote } from '../services/billing.js';
import { corePool } from '../services/core-pool.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function billingRoutes(fastify: FastifyInstance) {
  // C++ Core Native Bill Pricing
  fastify.post('/calculate', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const pricing = await corePool.execute('price_bill', req.body);
    return reply.send({ ok: true, data: pricing });
  });

  // C++ Core Native Hamilton Bill Split
  fastify.post('/split', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const split = await corePool.execute('split_bill', req.body);
    return reply.send({ ok: true, data: split });
  });

  // Finalize bill and allocate consecutive invoice number
  const handleFinalize = async (req: any, reply: any) => {
    const invoice = await finalizeBill({
      ...req.body,
      user_id: req.user!.userId,
    });
    return reply.send({ ok: true, data: invoice });
  };

  fastify.post('/finalize', { preHandler: [authenticateToken] }, handleFinalize);
  fastify.post('/invoice', { preHandler: [authenticateToken] }, handleFinalize);

  // Invoice lookup by ID
  fastify.get('/invoices/:id', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const invRes = await query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (invRes.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    }
    return reply.send({ ok: true, data: invRes.rows[0] });
  });

  // Issue Credit Note (Refund / Invoice cancellation)
  fastify.post('/credit-note', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { invoice_id, reason } = req.body;
    const creditNote = await createCreditNote(invoice_id, reason, req.user!.userId);
    return reply.send({ ok: true, data: creditNote });
  });
}
