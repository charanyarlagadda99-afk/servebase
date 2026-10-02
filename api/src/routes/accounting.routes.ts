import { FastifyInstance } from 'fastify';
import {
  initStandardChartOfAccounts,
  getTrialBalance,
  getFlashPL,
  createJournalEntry,
} from '../services/accounting.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function accountingRoutes(fastify: FastifyInstance) {
  // Get chart of accounts
  fastify.get('/accounts', { preHandler: [authenticateToken] }, async (_req, reply) => {
    const res = await query('SELECT * FROM chart_of_accounts ORDER BY account_code ASC');
    return reply.send({ ok: true, data: res.rows });
  });

  // Get journal entries
  fastify.get('/journals', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT je.*, u.full_name as created_by_name,
              json_agg(json_build_object(
                'account_id', jl.account_id,
                'debit_paise', jl.debit_paise,
                'credit_paise', jl.credit_paise,
                'narration', jl.narration
              )) as lines
       FROM journal_entries je
       LEFT JOIN users u ON u.id = je.created_by_user_id
       LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.outlet_id = $1
       GROUP BY je.id, u.full_name
       ORDER BY je.created_at DESC LIMIT 50`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });

  // Create manual balanced journal entry
  fastify.post('/journals', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const entry = await createJournalEntry({
      ...req.body,
      outlet_id: req.outletId!,
      created_by_user_id: req.user!.userId,
    });
    return reply.send({ ok: true, data: entry });
  });

  // Trial Balance report enforcing Debits == Credits
  fastify.get('/trial-balance', { preHandler: [authenticateToken] }, async (req, reply) => {
    const orgRes = await query('SELECT b.organization_id FROM outlets o JOIN brands b ON b.id = o.brand_id WHERE o.id = $1', [req.outletId!]);
    const orgId = orgRes.rows[0]?.organization_id;
    const tb = await getTrialBalance(orgId);
    return reply.send({ ok: true, data: tb });
  });

  // Daily Flash P&L statement
  fastify.get('/flash-pnl', { preHandler: [authenticateToken] }, async (req, reply) => {
    const orgRes = await query('SELECT b.organization_id FROM outlets o JOIN brands b ON b.id = o.brand_id WHERE o.id = $1', [req.outletId!]);
    const orgId = orgRes.rows[0]?.organization_id;
    const pnl = await getFlashPL(orgId);
    return reply.send({ ok: true, data: pnl });
  });
}
