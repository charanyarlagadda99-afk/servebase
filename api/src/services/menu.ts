import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export interface CreateMenuItemInput {
  outlet_id: string;
  category_id: string;
  station_id?: string;
  name: string;
  short_name?: string;
  description?: string;
  dietary_type?: 'veg' | 'non_veg' | 'egg';
  sac_hsn_code?: string;
  tax_rate_percent?: number;
  base_price_paise: number;
  prep_time_minutes?: number;
  default_course?: string;
  is_open_item?: boolean;
  is_combo?: boolean;
  allergens?: string[];
  variants?: Array<{ name: string; price_paise: number; is_default?: boolean }>;
  modifier_group_ids?: string[];
  channel_pricing?: Array<{ channel: string; price_paise: number; variant_name?: string }>;
}

export async function createCategory(outletId: string, name: string, sortOrder = 0, parentId?: string) {
  const res = await query(
    `INSERT INTO categories (outlet_id, name, sort_order, parent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [outletId, name, sortOrder, parentId || null]
  );
  return res.rows[0];
}

export async function getCategories(outletId: string) {
  const res = await query(
    `SELECT * FROM categories WHERE outlet_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`,
    [outletId]
  );
  return res.rows;
}

export async function createModifierGroup(
  outletId: string,
  name: string,
  minSelection = 0,
  maxSelection = 1,
  modifiers: Array<{ name: string; price_paise: number }> = []
) {
  return withTransaction(async (client) => {
    const grpRes = await client.query(
      `INSERT INTO modifier_groups (outlet_id, name, min_selection, max_selection)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [outletId, name, minSelection, maxSelection]
    );
    const group = grpRes.rows[0];

    const createdModifiers = [];
    for (const mod of modifiers) {
      const modRes = await client.query(
        `INSERT INTO modifiers (group_id, name, price_paise)
         VALUES ($1, $2, $3) RETURNING *`,
        [group.id, mod.name, mod.price_paise]
      );
      createdModifiers.push(modRes.rows[0]);
    }

    return { ...group, modifiers: createdModifiers };
  });
}

export async function createMenuItem(input: CreateMenuItemInput, userId?: string) {
  return withTransaction(async (client) => {
    const itemRes = await client.query(
      `INSERT INTO menu_items (
        outlet_id, category_id, station_id, name, short_name, description,
        dietary_type, sac_hsn_code, tax_rate_percent, base_price_paise,
        prep_time_minutes, default_course, is_open_item, is_combo, allergens
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        input.outlet_id,
        input.category_id,
        input.station_id || null,
        input.name,
        input.short_name || input.name.slice(0, 10),
        input.description || null,
        input.dietary_type || 'veg',
        input.sac_hsn_code || '996331',
        input.tax_rate_percent !== undefined ? input.tax_rate_percent : 5.0,
        input.base_price_paise,
        input.prep_time_minutes || 15,
        input.default_course || 'mains',
        input.is_open_item || false,
        input.is_combo || false,
        input.allergens || [],
      ]
    );

    const item = itemRes.rows[0];

    // Variants
    const variants = [];
    if (input.variants && input.variants.length > 0) {
      for (const v of input.variants) {
        const vRes = await client.query(
          `INSERT INTO item_variants (menu_item_id, name, price_paise, is_default)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [item.id, v.name, v.price_paise, v.is_default || false]
        );
        variants.push(vRes.rows[0]);
      }
    }

    // Modifier Groups link
    if (input.modifier_group_ids && input.modifier_group_ids.length > 0) {
      for (const grpId of input.modifier_group_ids) {
        await client.query(
          `INSERT INTO item_modifier_groups (menu_item_id, modifier_group_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [item.id, grpId]
        );
      }
    }

    // Channel pricing
    if (input.channel_pricing && input.channel_pricing.length > 0) {
      for (const cp of input.channel_pricing) {
        let variantId = null;
        if (cp.variant_name) {
          const matchedVariant = variants.find((v) => v.name === cp.variant_name);
          if (matchedVariant) variantId = matchedVariant.id;
        }
        await client.query(
          `INSERT INTO channel_pricing (menu_item_id, variant_id, channel, price_paise)
           VALUES ($1, $2, $3, $4)`,
          [item.id, variantId, cp.channel, cp.price_paise]
        );
      }
    }

    await recordAudit({
      outlet_id: input.outlet_id,
      user_id: userId,
      action: 'MENU_ITEM_CREATE',
      entity_type: 'MENU_ITEM',
      entity_id: item.id,
      after_state: { name: item.name, base_price_paise: item.base_price_paise },
    });

    return { ...item, variants };
  });
}

export async function toggleItemAvailability(itemId: string, isAvailable: boolean, userId?: string) {
  const res = await query(
    `UPDATE menu_items 
     SET is_available = $1 
     WHERE id = $2 
     RETURNING id, outlet_id, name, is_available`,
    [isAvailable, itemId]
  );
  if (res.rows.length === 0) throw new Error('Menu item not found');

  const item = res.rows[0];
  await recordAudit({
    outlet_id: item.outlet_id,
    user_id: userId,
    action: 'MENU_ITEM_AVAILABILITY_TOGGLE',
    entity_type: 'MENU_ITEM',
    entity_id: item.id,
    after_state: { is_available: isAvailable },
  });

  return item;
}

export async function getFullMenu(outletId: string, channel = 'dine_in') {
  // Query all active categories, items with variants, modifiers, and channel pricing
  const itemsRes = await query(
    `SELECT m.*, 
            c.name as category_name,
            ks.name as station_name,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('id', v.id, 'name', v.name, 'price_paise', v.price_paise, 'is_default', v.is_default))
              FILTER (WHERE v.id IS NOT NULL), '[]'::json
            ) as variants,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('channel', cp.channel, 'price_paise', cp.price_paise, 'variant_id', cp.variant_id))
              FILTER (WHERE cp.id IS NOT NULL), '[]'::json
            ) as channel_prices
     FROM menu_items m
     JOIN categories c ON c.id = m.category_id
     LEFT JOIN kitchen_stations ks ON ks.id = m.station_id
     LEFT JOIN item_variants v ON v.menu_item_id = m.id AND v.deleted_at IS NULL
     LEFT JOIN channel_pricing cp ON cp.menu_item_id = m.id
     WHERE m.outlet_id = $1 AND m.deleted_at IS NULL
     GROUP BY m.id, c.name, c.sort_order, ks.name
     ORDER BY c.sort_order ASC, m.name ASC`,
    [outletId]
  );

  return itemsRes.rows.map((row) => {
    // Resolve price for requested channel
    const cp = row.channel_prices.find((p: any) => p.channel === channel && !p.variant_id);
    const effectivePrice = cp ? Number(cp.price_paise) : Number(row.base_price_paise);

    return {
      ...row,
      effective_price_paise: effectivePrice,
    };
  });
}
