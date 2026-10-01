import { query, withTransaction } from '../db/pool.js';
import { corePool } from './core-pool.js';

export interface RecipeIngredientInput {
  raw_material_id: string;
  quantity: number; // in recipe UOM
  uom_id: string;
  wastage_percent?: number; // e.g. 5.0 for 5% trimming loss
}

export interface CreateRecipeInput {
  menu_item_id: string;
  variant_id?: string;
  yield_portions?: number;
  ingredients: RecipeIngredientInput[];
}

export async function createRecipe(input: CreateRecipeInput) {
  return withTransaction(async (client) => {
    // 1. Create recipe header
    const rRes = await client.query(
      `INSERT INTO recipes (menu_item_id, variant_id, yield_portions)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.menu_item_id, input.variant_id || null, input.yield_portions || 1.0]
    );
    const recipe = rRes.rows[0];

    // 2. Insert ingredients
    const createdIngredients = [];
    for (const ing of input.ingredients) {
      const ingRes = await client.query(
        `INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity, uom_id, wastage_percent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          recipe.id,
          ing.raw_material_id,
          ing.quantity,
          ing.uom_id,
          ing.wastage_percent || 0.0,
        ]
      );
      createdIngredients.push({
        ...ingRes.rows[0],
        quantity: Number(ingRes.rows[0].quantity),
        wastage_percent: Number(ingRes.rows[0].wastage_percent),
      });
    }

    return {
      ...recipe,
      yield_portions: Number(recipe.yield_portions),
      ingredients: createdIngredients,
    };
  });
}

export async function getRecipeForMenuItem(menuItemId: string, variantId?: string) {
  let sql = `SELECT * FROM recipes WHERE menu_item_id = $1 AND is_active = TRUE`;
  const params: any[] = [menuItemId];
  if (variantId) {
    sql += ` AND variant_id = $2`;
    params.push(variantId);
  } else {
    sql += ` AND variant_id IS NULL`;
  }

  const rRes = await query(sql, params);
  if (rRes.rows.length === 0) return null;
  const recipe = rRes.rows[0];

  const ingRes = await query(
    `SELECT ri.*, rm.name as raw_material_name, rm.current_cost_paise, u.symbol as uom_symbol
     FROM recipe_ingredients ri
     JOIN raw_materials rm ON rm.id = ri.raw_material_id
     JOIN uoms u ON u.id = ri.uom_id
     WHERE ri.recipe_id = $1`,
    [recipe.id]
  );

  return {
    ...recipe,
    yield_portions: Number(recipe.yield_portions),
    ingredients: ingRes.rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      wastage_percent: Number(r.wastage_percent),
      current_cost_paise: Number(r.current_cost_paise),
    })),
  };
}

export async function deductSalesInventory(orderId: string, businessDate: string) {
  return withTransaction(async (client) => {
    // 1. Fetch non-voided order items
    const itemsRes = await client.query(
      `SELECT oi.id, oi.menu_item_id, oi.variant_id, oi.item_name, oi.quantity, o.outlet_id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.order_id = $1 AND oi.is_voided = FALSE`,
      [orderId]
    );

    if (itemsRes.rows.length === 0) return { consumed: [] };
    const outletId = itemsRes.rows[0].outlet_id;

    // 2. Fetch recipes for these items
    const orderedItems = itemsRes.rows.map((item) => ({
      menu_item_id: item.menu_item_id,
      variant_id: item.variant_id || '',
      quantity: Number(item.quantity),
    }));

    const recipesList = [];
    for (const item of itemsRes.rows) {
      let rSql = `SELECT * FROM recipes WHERE menu_item_id = $1 AND is_active = TRUE`;
      const rParams: any[] = [item.menu_item_id];
      if (item.variant_id) {
        rSql += ` AND variant_id = $2`;
        rParams.push(item.variant_id);
      } else {
        rSql += ` AND variant_id IS NULL`;
      }

      const rRes = await client.query(rSql, rParams);
      if (rRes.rows.length === 0) continue; // Item without recipe

      const recipe = rRes.rows[0];
      const ingsRes = await client.query(
        `SELECT ri.* FROM recipe_ingredients ri WHERE ri.recipe_id = $1`,
        [recipe.id]
      );

      recipesList.push({
        menu_item_id: recipe.menu_item_id,
        variant_id: recipe.variant_id || '',
        yield_portions: Number(recipe.yield_portions || 1.0),
        ingredients: ingsRes.rows.map((ing) => ({
          raw_material_id: ing.raw_material_id,
          quantity: Number(ing.quantity),
          wastage_percent: Number(ing.wastage_percent),
        })),
      });
    }

    if (recipesList.length === 0) return { consumed: [] };

    // 3. Call C++ explode_recipe engine
    const explosionResult = await corePool.execute('explode_recipe', {
      ordered_items: orderedItems,
      recipes: recipesList,
    });

    // 4. Post deductions to stock ledger
    const deductions = [];
    for (const req of explosionResult.consumptions) {
      const matRes = await client.query(
        `SELECT name, current_cost_paise FROM raw_materials WHERE id = $1`,
        [req.raw_material_id]
      );
      const mat = matRes.rows[0];
      const unitCost = mat ? Number(mat.current_cost_paise) : 0;
      const totalVal = Math.round(req.total_quantity_required * unitCost);

      await client.query(
        `INSERT INTO stock_ledger (
          outlet_id, raw_material_id, movement_type, quantity,
          unit_cost_paise, total_value_paise, reference_id, notes, business_date
        ) VALUES ($1, $2, 'sale_consumption', $3, $4, $5, $6, $7, $8)`,
        [
          outletId,
          req.raw_material_id,
          -req.total_quantity_required,
          unitCost,
          totalVal,
          orderId,
          `Sale consumption for Order: ${orderId}`,
          businessDate,
        ]
      );

      deductions.push({
        raw_material_id: req.raw_material_id,
        name: mat?.name || 'Raw Material',
        quantity_consumed: req.total_quantity_required,
        unit_cost_paise: unitCost,
        total_cost_paise: totalVal,
      });
    }

    return { orderId, consumed: deductions };
  });
}
