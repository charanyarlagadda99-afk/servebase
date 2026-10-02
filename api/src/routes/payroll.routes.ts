import { FastifyInstance } from 'fastify';
import { runPayroll } from '../services/staff.js';
import { query } from '../db/pool.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

export async function payrollRoutes(fastify: FastifyInstance) {
  // Get salary structures
  fastify.get('/structures', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT e.id as employee_id, e.employee_code, e.first_name, e.last_name, e.role,
              e.salary_type, e.base_rate_paise
       FROM employees e
       WHERE e.outlet_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.first_name ASC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });

  // Run payroll for period using C++ compute_payroll calculation
  fastify.post('/run', { preHandler: [authenticateToken, requirePermission('payroll:run')] }, async (req: any, reply) => {
    const { month, year } = req.body || {};
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || (new Date().getMonth() + 1);
    const run = await runPayroll(
      req.outletId!,
      Number(currentMonth),
      Number(currentYear),
      req.user!.userId
    );
    return reply.send({ ok: true, data: run });
  });

  // Get payslips for payroll run
  fastify.get('/payslips/:runId', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const payslips = await query(
      `SELECT ps.*, e.first_name, e.last_name, e.employee_code, e.role
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
       WHERE ps.payroll_run_id = $1`,
      [req.params.runId]
    );
    return reply.send({ ok: true, data: payslips.rows });
  });
}
