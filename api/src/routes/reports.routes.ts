import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { corePool } from '../services/core-pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function reportRoutes(fastify: FastifyInstance) {
  // Daily Flash report: sales, covers, average check, target cost comparisons
  fastify.get('/daily-flash', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const businessDate = req.query.business_date || new Date().toISOString().split('T')[0];
    const outletId = req.outletId!;

    const salesRes = await query(
      `SELECT 
         COALESCE(SUM(total_paise), 0) as total_sales_paise,
         COALESCE(SUM(taxable_value_paise), 0) as taxable_sales_paise,
         COALESCE(SUM(cgst_paise + sgst_paise + igst_paise), 0) as total_tax_paise,
         COUNT(id) as total_invoices
       FROM invoices
       WHERE outlet_id = $1 AND business_date = $2 AND invoice_type IN ('tax_invoice', 'bill_of_supply')`,
      [outletId, businessDate]
    );

    const coversRes = await query(
      `SELECT COALESCE(SUM(covers), 0) as total_covers
       FROM orders
       WHERE outlet_id = $1 AND business_date = $2 AND status IN ('billed', 'paid', 'closed')`,
      [outletId, businessDate]
    );

    const settingsRes = await query('SELECT * FROM outlet_settings WHERE outlet_id = $1', [outletId]);
    const settings = settingsRes.rows[0] || {};

    const totalSales = Number(salesRes.rows[0].total_sales_paise);
    const totalCovers = Number(coversRes.rows[0].total_covers) || 1;
    const avgCheckPaise = Math.round(totalSales / totalCovers);

    return reply.send({
      ok: true,
      data: {
        business_date: businessDate,
        total_sales_paise: totalSales,
        taxable_sales_paise: Number(salesRes.rows[0].taxable_sales_paise),
        total_tax_paise: Number(salesRes.rows[0].total_tax_paise),
        total_invoices: Number(salesRes.rows[0].total_invoices),
        total_covers: totalCovers,
        average_check_paise: avgCheckPaise,
        target_food_cost_pct: Number(settings.target_food_cost_pct || 32.0),
        target_labor_cost_pct: Number(settings.target_labor_cost_pct || 28.0),
        target_prime_cost_pct: Number(settings.target_prime_cost_pct || 60.0),
      },
    });
  });

  // Hourly Sales heatmap matrix (Hour x Weekday) using C++ aggregate_sales engine
  fastify.get('/hourly-matrix', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const outletId = req.outletId!;
    const invoicesRes = await query(
      `SELECT total_paise, created_at FROM invoices
       WHERE outlet_id = $1 AND invoice_type IN ('tax_invoice', 'bill_of_supply')
       ORDER BY created_at DESC LIMIT 500`,
      [outletId]
    );

    const records = invoicesRes.rows.map((inv) => {
      const d = new Date(inv.created_at);
      return {
        timestamp_iso: d.toISOString(),
        total_paise: Number(inv.total_paise),
        hour: d.getHours(),
        day_of_week: d.getDay(),
      };
    });

    const matrix = await corePool.execute('aggregate_sales', {
      sales_records: records,
    });

    return reply.send({ ok: true, data: matrix });
  });

  // Kasavana & Smith BCG Menu Engineering matrix using C++ menu_engineering engine
  fastify.get('/menu-engineering', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const outletId = req.outletId!;
    const itemsRes = await query(
      `SELECT m.id, m.name, m.base_price_paise,
              COALESCE(SUM(ii.quantity), 0) as quantity_sold,
              COALESCE(SUM(ii.total_paise), 0) as total_revenue_paise,
              COALESCE(AVG(r.food_cost_paise), m.base_price_paise * 0.3) as unit_food_cost_paise
       FROM menu_items m
       LEFT JOIN invoice_items ii ON ii.menu_item_id = m.id
       LEFT JOIN (
         SELECT menu_item_id, SUM(ri.quantity * rm.current_cost_paise) as food_cost_paise
         FROM recipes rec
         JOIN recipe_ingredients ri ON ri.recipe_id = rec.id
         JOIN raw_materials rm ON rm.id = ri.raw_material_id
         GROUP BY menu_item_id
       ) r ON r.menu_item_id = m.id
       WHERE m.outlet_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.id
       ORDER BY total_revenue_paise DESC`,
      [outletId]
    );

    const payloadItems = itemsRes.rows.map((row) => ({
      item_id: row.id,
      name: row.name,
      quantity_sold: Math.max(1, Number(row.quantity_sold)),
      unit_price_paise: Number(row.base_price_paise),
      unit_food_cost_paise: Math.round(Number(row.unit_food_cost_paise)),
      total_revenue_paise: Number(row.total_revenue_paise) || Number(row.base_price_paise),
    }));

    const result = await corePool.execute('menu_engineering', {
      items: payloadItems,
    });

    return reply.send({ ok: true, data: result });
  });

  // Leakage report: voids, discounts, comps grouped by user
  fastify.get('/leakage', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const outletId = req.outletId!;
    const voids = await query(
      `SELECT u.full_name as user_name, COUNT(oi.id) as void_count, COALESCE(SUM(oi.price_paise), 0) as void_total_paise
       FROM order_items oi
       JOIN users u ON u.id = oi.voided_by_user_id
       WHERE oi.is_voided = TRUE
       GROUP BY u.full_name`,
      []
    );

    const discounts = await query(
      `SELECT u.full_name as user_name, COUNT(i.id) as discount_count, COALESCE(SUM(i.bill_discount_paise), 0) as discount_total_paise
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN users u ON u.id = o.created_by_user_id
       WHERE i.outlet_id = $1 AND i.bill_discount_paise > 0
       GROUP BY u.full_name`,
      [outletId]
    );

    return reply.send({
      ok: true,
      data: {
        voids: voids.rows,
        discounts: discounts.rows,
      },
    });
  });
}
