import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export async function closeBusinessDay(outletId: string, businessDate: string, userId: string) {
  return withTransaction(async (client) => {
    // 1. Idempotency Check: if already closed, return existing summary
    const existingRes = await client.query(
      `SELECT * FROM day_closes WHERE outlet_id = $1 AND business_date = $2`,
      [outletId, businessDate]
    );

    if (existingRes.rows.length > 0) {
      return { day_close: existingRes.rows[0], is_already_closed: true };
    }

    // 2. Precondition 1: Check for open or unbilled orders
    const openOrdersRes = await client.query(
      `SELECT id, order_type, status FROM orders 
       WHERE outlet_id = $1 AND business_date = $2 AND status IN ('open', 'kot_sent', 'preparing', 'ready')`,
      [outletId, businessDate]
    );
    if (openOrdersRes.rows.length > 0) {
      throw new Error(`Cannot close day: ${openOrdersRes.rows.length} order(s) are still active or unbilled`);
    }

    // 3. Precondition 2: Check for unsettled bills
    const unsettledBillsRes = await client.query(
      `SELECT id, status FROM orders 
       WHERE outlet_id = $1 AND business_date = $2 AND status = 'billed'`,
      [outletId, businessDate]
    );
    if (unsettledBillsRes.rows.length > 0) {
      throw new Error(`Cannot close day: ${unsettledBillsRes.rows.length} bill(s) are printed but unpaid`);
    }

    // 4. Precondition 3: Check for open shifts
    const openShiftsRes = await client.query(
      `SELECT id FROM shifts WHERE outlet_id = $1 AND business_date = $2 AND status = 'open'`,
      [outletId, businessDate]
    );
    if (openShiftsRes.rows.length > 0) {
      throw new Error(`Cannot close day: ${openShiftsRes.rows.length} terminal shift(s) are still open`);
    }

    // 5. Generate Z-Report metrics:
    // Sales by Category (from sales invoices)
    const catSalesRes = await client.query(
      `SELECT c.name as category_name, 
              COUNT(ii.id) as item_count, 
              COALESCE(SUM(ii.quantity), 0) as quantity_sold,
              COALESCE(SUM(ii.total_paise), 0) as total_paise
       FROM invoice_items ii
       JOIN invoices inv ON inv.id = ii.invoice_id
       JOIN menu_items m ON m.id = ii.menu_item_id
       JOIN categories c ON c.id = m.category_id
       WHERE inv.outlet_id = $1 AND inv.business_date = $2 AND inv.invoice_type IN ('tax_invoice', 'bill_of_supply')
       GROUP BY c.name`,
      [outletId, businessDate]
    );

    // Sales by Payment Mode
    const pmtModeRes = await client.query(
      `SELECT p.payment_method, 
              COUNT(p.id) as payment_count, 
              COALESCE(SUM(p.amount_paise), 0) as total_paise
       FROM payments p
       JOIN invoices inv ON inv.id = p.invoice_id
       WHERE p.outlet_id = $1 AND inv.business_date = $2 AND p.status = 'completed'
       GROUP BY p.payment_method`,
      [outletId, businessDate]
    );

    // Tax by slab
    const taxSlabRes = await client.query(
      `SELECT ii.tax_rate_percent,
              COALESCE(SUM(ii.taxable_value_paise), 0) as taxable_value_paise,
              COALESCE(SUM(ii.cgst_paise), 0) as cgst_paise,
              COALESCE(SUM(ii.sgst_paise), 0) as sgst_paise,
              COALESCE(SUM(ii.igst_paise), 0) as igst_paise
       FROM invoice_items ii
       JOIN invoices inv ON inv.id = ii.invoice_id
       WHERE inv.outlet_id = $1 AND inv.business_date = $2 AND inv.invoice_type IN ('tax_invoice', 'bill_of_supply')
       GROUP BY ii.tax_rate_percent`,
      [outletId, businessDate]
    );

    // Aggregates: Totals, Discounts, Comps, Voids, Tips, Service Charge, Covers
    const totalsRes = await client.query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.id END) as total_invoices,
        COALESCE(SUM(CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.total_paise ELSE 0 END), 0) as gross_sales_paise,
        COALESCE(SUM(CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.taxable_value_paise ELSE 0 END), 0) as taxable_sales_paise,
        COALESCE(SUM(CASE WHEN inv.invoice_type = 'credit_note' THEN ABS(inv.total_paise) ELSE 0 END), 0) as total_credit_notes_paise,
        COALESCE(SUM(inv.total_paise), 0) as net_sales_paise,
        COALESCE(SUM(CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.bill_discount_paise + inv.item_discount_paise ELSE 0 END), 0) as total_discounts_paise,
        COALESCE(SUM(CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.service_charge_paise ELSE 0 END), 0) as total_service_charge_paise,
        COALESCE(SUM(CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.tip_paise ELSE 0 END), 0) as total_tips_paise,
        COALESCE(SUM(CASE WHEN inv.invoice_type IN ('tax_invoice', 'bill_of_supply') THEN inv.round_off_paise ELSE 0 END), 0) as total_round_off_paise
       FROM invoices inv
       WHERE inv.outlet_id = $1 AND inv.business_date = $2`,
      [outletId, businessDate]
    );
    const totals = totalsRes.rows[0];

    // Total covers
    const coversRes = await client.query(
      `SELECT COALESCE(SUM(covers), 0) as total_covers, COUNT(id) as total_orders
       FROM orders
       WHERE outlet_id = $1 AND business_date = $2 AND status = 'paid'`,
      [outletId, businessDate]
    );
    const totalCovers = Number(coversRes.rows[0].total_covers) || 1;
    const grossSales = Number(totals.gross_sales_paise);
    const avgCheckPaise = Math.round(grossSales / totalCovers);

    // Voids summary
    const voidsRes = await client.query(
      `SELECT COUNT(oi.id) as void_count, COALESCE(SUM(oi.quantity * oi.unit_price_paise), 0) as void_value_paise
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.outlet_id = $1 AND o.business_date = $2 AND oi.is_voided = TRUE`,
      [outletId, businessDate]
    );

    // Complimentary summary
    const compsRes = await client.query(
      `SELECT COUNT(oi.id) as comp_count, COALESCE(SUM(oi.quantity * oi.unit_price_paise), 0) as comp_value_paise
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.outlet_id = $1 AND o.business_date = $2 AND oi.is_complimentary = TRUE`,
      [outletId, businessDate]
    );

    const zReport = {
      business_date: businessDate,
      gross_sales_paise: grossSales,
      net_sales_paise: Number(totals.net_sales_paise),
      taxable_sales_paise: Number(totals.taxable_sales_paise),
      total_credit_notes_paise: Number(totals.total_credit_notes_paise),
      total_invoices: Number(totals.total_invoices),
      total_covers: totalCovers,
      average_check_paise: avgCheckPaise,
      total_discounts_paise: Number(totals.total_discounts_paise),
      total_service_charge_paise: Number(totals.total_service_charge_paise),
      total_tips_paise: Number(totals.total_tips_paise),
      total_round_off_paise: Number(totals.total_round_off_paise),
      sales_by_category: catSalesRes.rows,
      sales_by_payment_mode: pmtModeRes.rows,
      tax_by_slab: taxSlabRes.rows,
      voids_summary: voidsRes.rows[0],
      comps_summary: compsRes.rows[0],
    };

    // 6. Record day close
    const dayCloseRes = await client.query(
      `INSERT INTO day_closes (outlet_id, business_date, closed_by_user_id, summary_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [outletId, businessDate, userId, JSON.stringify(zReport)]
    );

    // 7. Advance outlet business date to next calendar day
    await client.query(
      `UPDATE outlets 
       SET current_business_date = current_business_date + INTERVAL '1 day'
       WHERE id = $1`,
      [outletId]
    );

    await recordAudit({
      outlet_id: outletId,
      user_id: userId,
      action: 'DAY_CLOSE_Z_REPORT',
      entity_type: 'DAY_CLOSE',
      entity_id: dayCloseRes.rows[0].id,
      after_state: {
        business_date: businessDate,
        gross_sales_paise: grossSales,
        total_invoices: totals.total_invoices,
        total_covers: totalCovers,
      },
    }, client);

    return { day_close: dayCloseRes.rows[0], z_report: zReport, is_already_closed: false };
  });
}
