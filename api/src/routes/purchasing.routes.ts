import { FastifyInstance } from 'fastify';
import {
  createVendor,
  getVendors,
  createPurchaseOrder,
  createGoodsReceiptNote,
  validateThreeWayMatch,
} from '../services/purchasing.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function purchasingRoutes(fastify: FastifyInstance) {
  // Get vendors
  fastify.get('/vendors', { preHandler: [authenticateToken] }, async (_req, reply) => {
    const vendors = await getVendors();
    return reply.send({ ok: true, data: vendors });
  });

  // Create vendor
  fastify.post('/vendors', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const vendor = await createVendor(req.body);
    return reply.send({ ok: true, data: vendor });
  });

  // Get purchase orders
  fastify.get('/orders', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT po.*, v.name as vendor_name, u.full_name as created_by_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.created_by_user_id
       WHERE po.outlet_id = $1
       ORDER BY po.created_at DESC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });

  // Create purchase order
  fastify.post('/orders', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const po = await createPurchaseOrder({
      ...req.body,
      outlet_id: req.outletId!,
      created_by: req.user!.userId,
    });
    return reply.send({ ok: true, data: po });
  });

  // Goods Receipt Note (GRN)
  fastify.post('/goods-receipts', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const grn = await createGoodsReceiptNote({
      ...req.body,
      outlet_id: req.outletId!,
      received_by: req.user!.userId,
    });
    return reply.send({ ok: true, data: grn });
  });

  // Three-Way Match Reconciliation (PO vs GRN vs Vendor Invoice)
  fastify.post('/three-way-match', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const match = await validateThreeWayMatch(req.body);
    return reply.send({ ok: true, data: match });
  });

  // Accounts Payable Ageing report
  fastify.get('/payable-ageing', { preHandler: [authenticateToken] }, async (req, reply) => {
    const res = await query(
      `SELECT v.id as vendor_id, v.name as vendor_name,
              COALESCE(SUM(po.total_paise), 0) as total_payable_paise,
              COUNT(po.id) as pending_invoices
       FROM vendors v
       LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.outlet_id = $1 AND po.status != 'cancelled'
       GROUP BY v.id, v.name
       ORDER BY total_payable_paise DESC`,
      [req.outletId!]
    );
    return reply.send({ ok: true, data: res.rows });
  });
}
