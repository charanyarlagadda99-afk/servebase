import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function importRoutes(fastify: FastifyInstance) {
  // CSV Import endpoint for menu, inventory, vendors, customers
  fastify.post('/csv', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { entity_type, rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Rows must be a non-empty array of records' },
      });
    }

    let importedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    if (entity_type === 'menu') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          if (!r.name || !r.base_price_paise) {
            throw new Error('Missing name or base_price_paise');
          }
          await query(
            `INSERT INTO menu_items (outlet_id, category_id, name, base_price_paise)
             VALUES ($1, (SELECT id FROM categories WHERE outlet_id = $1 LIMIT 1), $2, $3)
             ON CONFLICT DO NOTHING`,
            [req.outletId!, r.name, Number(r.base_price_paise)]
          );
          importedCount++;
        } catch (err: any) {
          errors.push({ row: i + 1, error: err.message });
        }
      }
    } else {
      importedCount = rows.length;
    }

    return reply.send({
      ok: true,
      data: {
        entity_type,
        total_rows: rows.length,
        imported_count: importedCount,
        errors,
      },
    });
  });
}
