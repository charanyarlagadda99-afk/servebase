import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginWithPassword, loginWithTerminalPin, authorizeApproval, verifyToken, generateToken } from '../services/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../db/pool.js';

const loginPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const terminalPinSchema = z.object({
  pin: z.string().min(4).max(6),
  outlet_id: z.string().uuid().optional(),
  terminal_id: z.string().uuid().optional(),
});

const approvalSchema = z.object({
  approver_pin: z.string().min(4).max(6),
  outlet_id: z.string().uuid().optional(),
  action_type: z.string().min(1),
  reference_id: z.string().nullable().optional(),
  reason: z.string().min(1),
  metadata: z.any().optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Back-office email + password login
  fastify.post('/login', async (req, reply) => {
    const body = loginPasswordSchema.parse(req.body);
    const result = await loginWithPassword(body.email, body.password);
    return reply.send({ ok: true, data: result });
  });

  // Terminal 4-digit PIN login
  const handlePinLogin = async (req: any, reply: any) => {
    const body = terminalPinSchema.parse(req.body);
    let outId = body.outlet_id;
    if (!outId && body.terminal_id) {
      const tRes = await query('SELECT outlet_id FROM terminals WHERE id = $1', [body.terminal_id]);
      outId = tRes.rows[0]?.outlet_id;
    }
    if (!outId) {
      const oRes = await query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
      outId = oRes.rows[0]?.id;
    }
    const result = await loginWithTerminalPin(body.pin, outId, body.terminal_id);
    return reply.send({ ok: true, data: result });
  };

  fastify.post('/terminal-pin', handlePinLogin);
  fastify.post('/pin-login', handlePinLogin);

  // Token refresh
  fastify.post('/refresh', { preHandler: [authenticateToken] }, async (req, reply) => {
    if (!req.user) throw new Error('Unauthenticated');
    const newToken = generateToken(req.user);
    return reply.send({ ok: true, data: { token: newToken } });
  });

  // Current authenticated user profile
  fastify.get('/me', { preHandler: [authenticateToken] }, async (req, reply) => {
    return reply.send({ ok: true, data: { user: req.user, outletId: req.outletId } });
  });

  // Manager Approval workflow (verified on server)
  fastify.post('/approve', async (req: any, reply) => {
    const body = approvalSchema.parse(req.body);
    let outId = body.outlet_id || (req.headers['x-outlet-id'] as string);
    if (!outId) {
      const oRes = await query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
      outId = oRes.rows[0]?.id;
    }
    const result = await authorizeApproval(
      body.approver_pin,
      outId,
      body.action_type,
      body.reference_id || null,
      body.reason,
      body.metadata
    );
    return reply.send({ ok: true, data: result });
  });
}
