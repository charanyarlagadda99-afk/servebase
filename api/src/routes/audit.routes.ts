import { FastifyInstance } from 'fastify';
import { verifyAuditChain } from '../services/audit.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function auditRoutes(fastify: FastifyInstance) {
  // Cryptographic audit chain verification proving zero tampering
  const handleVerify = async (req: any, reply: any) => {
    const result = await verifyAuditChain(req.outletId!);
    return reply.send({ ok: true, data: result });
  };

  fastify.get('/verify', { preHandler: [authenticateToken] }, handleVerify);
  fastify.get('/verify-chain', { preHandler: [authenticateToken] }, handleVerify);

  // Query audit events with filters
  const handleEvents = async (req: any, reply: any) => {
    const { action, entity_type, limit } = req.query;
    let sql = `SELECT * FROM audit_log WHERE (outlet_id = $1 OR outlet_id IS NULL)`;
    const params: any[] = [req.outletId!];

    if (action) {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }
    if (entity_type) {
      params.push(entity_type);
      sql += ` AND entity_type = $${params.length}`;
    }

    params.push(limit ? Math.min(Number(limit), 100) : 50);
    sql += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

    const res = await query(sql, params);
    return reply.send({ ok: true, data: res.rows });
  };

  fastify.get('/events', { preHandler: [authenticateToken] }, handleEvents);
  fastify.get('/logs', { preHandler: [authenticateToken] }, handleEvents);
}
