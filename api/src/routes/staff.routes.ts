import { FastifyInstance } from 'fastify';
import { getEmployees, createEmployee, clockIn, clockOut } from '../services/staff.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function staffRoutes(fastify: FastifyInstance) {
  // Get employees list
  fastify.get('/employees', { preHandler: [authenticateToken] }, async (req, reply) => {
    const employees = await getEmployees(req.outletId!);
    return reply.send({ ok: true, data: employees });
  });

  // Create employee
  fastify.post('/employees', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const emp = await createEmployee({
      ...req.body,
      outlet_id: req.outletId!,
    });
    return reply.send({ ok: true, data: emp });
  });

  // PIN Time Clock - Clock In
  fastify.post('/clock-in', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { employee_id, work_date, timestamp } = req.body;
    const workDate = work_date || new Date().toISOString().split('T')[0];
    const result = await clockIn(req.outletId!, employee_id, workDate, timestamp ? new Date(timestamp) : new Date());
    return reply.send({ ok: true, data: result });
  });

  // PIN Time Clock - Clock Out
  fastify.post('/clock-out', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { employee_id, work_date, timestamp, break_minutes } = req.body;
    const workDate = work_date || new Date().toISOString().split('T')[0];
    const result = await clockOut(req.outletId!, employee_id, workDate, timestamp ? new Date(timestamp) : new Date(), break_minutes || 0);
    return reply.send({ ok: true, data: result });
  });

  // Get active roster / attendance records
  fastify.get('/roster', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT a.*, e.first_name, e.last_name, e.employee_code, e.role
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE e.outlet_id = $1
       ORDER BY a.clock_in DESC LIMIT 50`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });
}
