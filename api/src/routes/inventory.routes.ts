import { FastifyInstance } from 'fastify';
import {
  getAllStockOnHand,
  createRawMaterial,
  recordStockMovement,
  executeStockCount,
  getUOMs,
} from '../services/inventory.js';
import { query } from '../db/pool.js';
import { corePool } from '../services/core-pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
  // Get active inventory stock on hand
  fastify.get('/items', { preHandler: [authenticateToken] }, async (req, reply) => {
    const stock = await getAllStockOnHand(req.outletId!);
    return reply.send({ ok: true, data: stock });
  });

  // Create raw material
  fastify.post('/items', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const item = await createRawMaterial({
      ...req.body,
      outlet_id: req.outletId!,
    });
    return reply.send({ ok: true, data: item });
  });

  // Get units of measure
  fastify.get('/uoms', { preHandler: [authenticateToken] }, async (_req, reply) => {
    const uoms = await getUOMs();
    return reply.send({ ok: true, data: uoms });
  });

  // Stock movement / adjustment
  fastify.post('/adjust', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { raw_material_id, quantity, movement_type, unit_cost_paise, business_date } = req.body;
    const movement = await recordStockMovement({
      outlet_id: req.outletId!,
      raw_material_id,
      movement_type: movement_type || 'adjustment',
      quantity,
      unit_cost_paise: unit_cost_paise || 0,
      business_date: business_date || new Date().toISOString().split('T')[0],
      user_id: req.user?.userId,
    });
    return reply.send({ ok: true, data: movement });
  });

  // Get stock ledger
  fastify.get('/ledger', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { raw_material_id, movement_type } = req.query;
    let sql = `SELECT sm.*, rm.name as item_name, u.symbol as uom_symbol
               FROM stock_movements sm
               JOIN raw_materials rm ON rm.id = sm.raw_material_id
               JOIN uoms u ON u.id = rm.uom_id
               WHERE sm.outlet_id = $1`;
    const params: any[] = [req.outletId!];
    if (raw_material_id) {
      params.push(raw_material_id);
      sql += ` AND sm.raw_material_id = $${params.length}`;
    }
    if (movement_type) {
      params.push(movement_type);
      sql += ` AND sm.movement_type = $${params.length}`;
    }
    sql += ` ORDER BY sm.created_at DESC LIMIT 100`;

    const res = await query(sql, params);
    return reply.send({ ok: true, data: res.rows });
  });

  // Compute inventory cycle-count variance via C++ core engine
  fastify.post('/variance', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { physical_counts } = req.body;
    const stockOnHand = await getAllStockOnHand(req.outletId!);

    const payload = {
      theoretical_items: stockOnHand.map((s: any) => ({
        raw_material_id: s.id,
        name: s.name,
        theoretical_quantity: Number(s.current_stock || 0),
        unit_cost_paise: Number(s.current_cost_paise || 0),
      })),
      physical_items: physical_counts || [],
    };

    const variance = await corePool.execute('compute_variance', payload);
    return reply.send({ ok: true, data: variance });
  });
}
