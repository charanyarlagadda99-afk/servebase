import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { corePool } from './core-pool.js';
import { recordAudit } from './audit.js';

export interface CreateUOMInput {
  name: string;
  symbol: string;
}

export async function createUOM(input: CreateUOMInput) {
  const res = await query(
    `INSERT INTO uoms (name, symbol) VALUES ($1, $2) RETURNING *`,
    [input.name, input.symbol]
  );
  return res.rows[0];
}

export async function getUOMs() {
  const res = await query(`SELECT * FROM uoms ORDER BY name ASC`);
  return res.rows;
}

export interface CreateRawMaterialInput {
  outlet_id: string;
  name: string;
  sku: string;
  uom_id: string;
  category?: string;
  current_cost_paise?: number;
  par_level?: number;
  reorder_point?: number;
}

export async function createRawMaterial(input: CreateRawMaterialInput) {
  const res = await query(
    `INSERT INTO raw_materials (
      outlet_id, name, sku, uom_id, category, current_cost_paise, par_level, reorder_point
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      input.outlet_id,
      input.name,
      input.sku,
      input.uom_id,
      input.category || 'kitchen',
      input.current_cost_paise || 0,
      input.par_level || 10.0,
      input.reorder_point || 5.0,
    ]
  );
  return {
    ...res.rows[0],
    current_cost_paise: Number(res.rows[0].current_cost_paise),
    par_level: Number(res.rows[0].par_level),
    reorder_point: Number(res.rows[0].reorder_point),
  };
}

export async function getStockOnHand(outletId: string, rawMaterialId: string): Promise<number> {
  const res = await query(
    `SELECT COALESCE(SUM(quantity), 0) as on_hand 
     FROM stock_ledger 
     WHERE outlet_id = $1 AND raw_material_id = $2`,
    [outletId, rawMaterialId]
  );
  return Number(res.rows[0].on_hand);
}

export async function getAllStockOnHand(outletId: string) {
  const sql = `
    SELECT 
      rm.id as raw_material_id,
      rm.name,
      rm.sku,
      rm.category,
      u.symbol as uom,
      rm.current_cost_paise,
      rm.par_level,
      rm.reorder_point,
      COALESCE(SUM(sl.quantity), 0) as on_hand,
      (COALESCE(SUM(sl.quantity), 0) * rm.current_cost_paise)::bigint as total_value_paise
    FROM raw_materials rm
    JOIN uoms u ON u.id = rm.uom_id
    LEFT JOIN stock_ledger sl ON sl.raw_material_id = rm.id
    WHERE rm.outlet_id = $1 AND rm.deleted_at IS NULL
    GROUP BY rm.id, rm.name, rm.sku, rm.category, u.symbol, rm.current_cost_paise, rm.par_level, rm.reorder_point
    ORDER BY rm.name ASC
  `;
  const res = await query(sql, [outletId]);
  return res.rows.map((r) => ({
    raw_material_id: r.raw_material_id,
    name: r.name,
    sku: r.sku,
    category: r.category,
    uom: r.uom,
    current_cost_paise: Number(r.current_cost_paise),
    par_level: Number(r.par_level),
    reorder_point: Number(r.reorder_point),
    on_hand: Number(r.on_hand),
    total_value_paise: Number(r.total_value_paise),
    needs_reorder: Number(r.on_hand) <= Number(r.reorder_point),
  }));
}

export interface StockMovementInput {
  outlet_id: string;
  raw_material_id: string;
  location_id?: string;
  movement_type: 'purchase' | 'sale_consumption' | 'transfer_in' | 'transfer_out' | 'wastage' | 'adjustment' | 'production';
  quantity: number; // positive for additions, negative for deductions
  unit_cost_paise: number;
  business_date: string;
  reference_id?: string;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
  user_id?: string;
}

export async function recordStockMovement(input: StockMovementInput, existingClient?: pg.PoolClient) {
  const execute = async (client: pg.PoolClient) => {
    // 1. Fetch current raw material to compute Weighted Average Cost if it's a purchase
    const matRes = await client.query(
      `SELECT * FROM raw_materials WHERE id = $1 FOR UPDATE`,
      [input.raw_material_id]
    );
    if (matRes.rows.length === 0) throw new Error('Raw material not found');
    const material = matRes.rows[0];

    const totalValuePaise = Math.round(Math.abs(input.quantity) * input.unit_cost_paise);

    // 2. If purchase, update Weighted Average Cost
    if (input.movement_type === 'purchase' && input.quantity > 0) {
      const stockRes = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as current_qty FROM stock_ledger WHERE raw_material_id = $1`,
        [input.raw_material_id]
      );
      const currentQty = Math.max(0, Number(stockRes.rows[0].current_qty));
      const currentCost = Number(material.current_cost_paise);

      const newTotalQty = currentQty + input.quantity;
      const newTotalCostValue = (currentQty * currentCost) + (input.quantity * input.unit_cost_paise);
      const newWacPaise = Math.round(newTotalCostValue / newTotalQty);

      await client.query(
        `UPDATE raw_materials SET current_cost_paise = $1 WHERE id = $2`,
        [newWacPaise, input.raw_material_id]
      );
    }

    // 3. Insert stock ledger entry
    const entryRes = await client.query(
      `INSERT INTO stock_ledger (
        outlet_id, location_id, raw_material_id, movement_type,
        quantity, unit_cost_paise, total_value_paise, reference_id,
        batch_number, expiry_date, notes, business_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.outlet_id,
        input.location_id || null,
        input.raw_material_id,
        input.movement_type,
        input.quantity,
        input.unit_cost_paise,
        totalValuePaise,
        input.reference_id || null,
        input.batch_number || null,
        input.expiry_date || null,
        input.notes || null,
        input.business_date,
      ]
    );

    const entry = entryRes.rows[0];

    return {
      ...entry,
      quantity: Number(entry.quantity),
      unit_cost_paise: Number(entry.unit_cost_paise),
      total_value_paise: Number(entry.total_value_paise),
    };
  };

  if (existingClient) {
    return execute(existingClient);
  }
  return withTransaction(execute);
}

export async function recordWastage(input: {
  outlet_id: string;
  raw_material_id: string;
  quantity: number; // positive number representing wasted quantity
  reason: 'spoilage' | 'expired' | 'prep_waste' | 'spilled' | 'theft';
  business_date: string;
  notes?: string;
  user_id: string;
}) {
  const mat = await query(`SELECT current_cost_paise FROM raw_materials WHERE id = $1`, [input.raw_material_id]);
  const cost = Number(mat.rows[0].current_cost_paise);

  return recordStockMovement({
    outlet_id: input.outlet_id,
    raw_material_id: input.raw_material_id,
    movement_type: 'wastage',
    quantity: -Math.abs(input.quantity),
    unit_cost_paise: cost,
    business_date: input.business_date,
    notes: `Wastage: ${input.reason}. ${input.notes || ''}`,
    user_id: input.user_id,
  });
}

export interface StockCountItemInput {
  raw_material_id: string;
  actual_qty: number;
  variance_reason?: string;
}

export async function executeStockCount(
  outletId: string,
  businessDate: string,
  userId: string,
  items: StockCountItemInput[],
  countType: 'cycle' | 'full' = 'cycle'
) {
  return withTransaction(async (client) => {
    // 1. Gather theoretical usage / on-hand for each item
    const rawIds = items.map((i) => i.raw_material_id);
    const matsRes = await client.query(
      `SELECT id, name, current_cost_paise FROM raw_materials WHERE id = ANY($1)`,
      [rawIds]
    );
    const matMap = new Map(matsRes.rows.map((r) => [r.id, r]));

    const theoreticalMap = new Map<string, number>();
    for (const id of rawIds) {
      const stockRes = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as on_hand FROM stock_ledger WHERE outlet_id = $1 AND raw_material_id = $2`,
        [outletId, id]
      );
      theoreticalMap.set(id, Number(stockRes.rows[0].on_hand));
    }

    // 2. Prepare C++ variance engine payload
    const coreVariancePayload = {
      opening_stock: items.map((item) => {
        const mat = matMap.get(item.raw_material_id)!;
        const theoretical = theoreticalMap.get(item.raw_material_id) || 0;
        return {
          raw_material_id: item.raw_material_id,
          quantity: theoretical,
          unit_cost_paise: Number(mat.current_cost_paise),
        };
      }),
      purchases: [],
      closing_stock: items.map((item) => ({
        raw_material_id: item.raw_material_id,
        quantity: item.actual_qty,
      })),
      theoretical_usage: items.map((item) => ({
        raw_material_id: item.raw_material_id,
        quantity: 0.0,
      })),
    };

    // 3. Call C++ compute_variance
    const varianceResult = await corePool.execute('compute_variance', coreVariancePayload);

    // 4. Create stock count record
    const countRes = await client.query(
      `INSERT INTO stock_counts (outlet_id, count_type, business_date, status, created_by, approved_by)
       VALUES ($1, $2, $3, 'approved', $4, $4)
       RETURNING *`,
      [outletId, countType, businessDate, userId]
    );
    const stockCountId = countRes.rows[0].id;

    // 5. Insert count items and adjust stock ledger
    const recordedItems = [];
    for (const vItem of varianceResult.variances) {
      const inputItem = items.find((i) => i.raw_material_id === vItem.raw_material_id)!;
      const mat = matMap.get(vItem.raw_material_id)!;

      const diff = vItem.closing_qty - vItem.opening_qty; // Actual - Theoretical

      await client.query(
        `INSERT INTO stock_count_items (
          stock_count_id, raw_material_id, theoretical_qty, actual_qty,
          variance_qty, cost_paise, variance_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stockCountId,
          vItem.raw_material_id,
          vItem.opening_qty,
          vItem.closing_qty,
          diff,
          Math.abs(vItem.variance_cost_paise),
          inputItem.variance_reason || vItem.reason,
        ]
      );

      // Adjust stock ledger if there is a discrepancy
      if (Math.abs(diff) > 0.001) {
        await client.query(
          `INSERT INTO stock_ledger (
            outlet_id, raw_material_id, movement_type, quantity,
            unit_cost_paise, total_value_paise, reference_id, notes, business_date
          ) VALUES ($1, $2, 'adjustment', $3, $4, $5, $6, $7, $8)`,
          [
            outletId,
            vItem.raw_material_id,
            diff,
            Number(mat.current_cost_paise),
            Math.round(Math.abs(diff) * Number(mat.current_cost_paise)),
            stockCountId,
            `Stock Count Adj: ${vItem.flag} - ${vItem.reason}`,
            businessDate,
          ]
        );
      }

      recordedItems.push({
        raw_material_id: vItem.raw_material_id,
        name: mat.name,
        theoretical_qty: vItem.opening_qty,
        actual_qty: vItem.closing_qty,
        variance_qty: diff,
        variance_cost_paise: vItem.variance_cost_paise,
        classification: vItem.flag,
        reason: vItem.reason,
      });
    }

    return {
      stock_count_id: stockCountId,
      business_date: businessDate,
      status: 'approved',
      items: recordedItems,
    };
  });
}
