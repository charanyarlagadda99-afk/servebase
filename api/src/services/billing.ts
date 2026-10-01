import { query, withTransaction } from '../db/pool.js';
import { corePool } from './core-pool.js';
import { recordAudit } from './audit.js';

export interface FinalizeBillInput {
  order_id: string;
  terminal_id?: string;
  recipient_gstin?: string;
  recipient_name?: string;
  is_inter_state?: boolean;
  service_charge_enabled?: boolean;
  tip_paise?: number;
  bill_discount_percent?: number;
  bill_discount_flat_paise?: number;
  user_id: string;
}

export function getFinancialYearCode(date: Date, startMonth = 4): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const fyStart = month >= startMonth ? year : year - 1;
  const fyEnd = fyStart + 1;
  const s2 = String(fyStart).slice(2);
  const e2 = String(fyEnd).slice(2);
  return `${s2}-${e2}`; // e.g. "26-27"
}

export async function allocateNextInvoiceNumber(
  client: any,
  outletId: string,
  seriesCode: string,
  financialYear: string
): Promise<string> {
  // Concurrency-safe counter row lock: prevents any race conditions or gaps
  await client.query(
    `INSERT INTO invoice_counters (outlet_id, series_code, financial_year, last_number)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (outlet_id, series_code, financial_year) DO NOTHING`,
    [outletId, seriesCode, financialYear]
  );

  const counterRes = await client.query(
    `SELECT last_number FROM invoice_counters
     WHERE outlet_id = $1 AND series_code = $2 AND financial_year = $3
     FOR UPDATE`,
    [outletId, seriesCode, financialYear]
  );

  const nextNum = counterRes.rows[0].last_number + 1;

  await client.query(
    `UPDATE invoice_counters
     SET last_number = $1
     WHERE outlet_id = $2 AND series_code = $3 AND financial_year = $4`,
    [nextNum, outletId, seriesCode, financialYear]
  );

  // Formatted consecutive number (Max 16 chars as per GST rule, e.g. "T1/26-27/00001")
  const padded = String(nextNum).padStart(5, '0');
  const invoiceNumber = `${seriesCode}/${financialYear}/${padded}`;
  return invoiceNumber;
}

export async function finalizeBill(input: FinalizeBillInput) {
  return withTransaction(async (client) => {
    // 1. Fetch order and outlet
    const orderRes = await client.query(
      `SELECT o.*, out.gstin as supplier_gstin, out.tax_mode, out.service_charge_percent, 
              out.service_charge_enabled as outlet_sc_enabled, out.price_tax_inclusive,
              out.financial_year_start_month, out.state_code
       FROM orders o
       JOIN outlets out ON out.id = o.outlet_id
       WHERE o.id = $1 FOR UPDATE`,
      [input.order_id]
    );

    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    if (['paid', 'closed', 'cancelled'].includes(order.status)) {
      throw new Error(`Cannot finalize bill for order with status '${order.status}'`);
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      `SELECT oi.*, m.sac_hsn_code, m.tax_rate_percent, m.name as raw_item_name
       FROM order_items oi
       JOIN menu_items m ON m.id = oi.menu_item_id
       WHERE oi.order_id = $1 AND oi.is_voided = FALSE`,
      [input.order_id]
    );

    if (itemsRes.rows.length === 0) {
      throw new Error('Order has no billable items');
    }

    // 3. Prepare payload for C++ Core Pricing Engine
    const corePricingPayload = {
      tax_mode: order.tax_mode,
      is_inter_state: input.is_inter_state || false,
      price_tax_inclusive: order.price_tax_inclusive || false,
      service_charge_percent: Number(order.service_charge_percent || 0.0),
      service_charge_enabled: input.service_charge_enabled !== undefined ? input.service_charge_enabled : false,
      tip_paise: input.tip_paise || 0,
      bill_discount_percent: input.bill_discount_percent || 0.0,
      bill_discount_flat_paise: input.bill_discount_flat_paise || 0,
      items: itemsRes.rows.map((row) => ({
        item_id: row.menu_item_id,
        name: row.item_name,
        quantity: row.quantity,
        unit_price_paise: Number(row.unit_price_paise),
        tax_rate_percent: Number(row.tax_rate_percent),
        sac_code: row.sac_hsn_code || '996331',
        is_complimentary: row.is_complimentary,
        discount_paise: 0,
      })),
    };

    // 4. Call C++ pricing engine
    const pricing = await corePool.execute('price_bill', corePricingPayload);

    // 5. Allocate consecutive invoice number
    const seriesCode = 'T1';
    const fyCode = getFinancialYearCode(new Date(order.business_date), order.financial_year_start_month || 4);
    const invoiceNumber = await allocateNextInvoiceNumber(client, order.outlet_id, seriesCode, fyCode);

    const invoiceType = order.tax_mode === 'composition' ? 'bill_of_supply' : 'tax_invoice';

    // 6. Insert invoice record
    const invRes = await client.query(
      `INSERT INTO invoices (
        outlet_id, terminal_id, order_id, invoice_number, financial_year,
        business_date, invoice_type, supplier_gstin, recipient_gstin,
        recipient_name, place_of_supply, subtotal_paise, item_discount_paise,
        bill_discount_paise, taxable_value_paise, cgst_paise, sgst_paise,
        igst_paise, service_charge_paise, tip_paise, round_off_paise,
        total_paise, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'issued')
      RETURNING *`,
      [
        order.outlet_id,
        input.terminal_id || null,
        order.id,
        invoiceNumber,
        fyCode,
        order.business_date,
        invoiceType,
        order.supplier_gstin,
        input.recipient_gstin || null,
        input.recipient_name || null,
        order.state_code || '07-Delhi',
        pricing.subtotal_paise,
        pricing.item_discount_paise,
        pricing.bill_discount_paise,
        pricing.taxable_value_paise,
        pricing.cgst_paise,
        pricing.sgst_paise,
        pricing.igst_paise,
        pricing.service_charge_paise,
        pricing.tip_paise,
        pricing.round_off_paise,
        pricing.total_paise,
      ]
    );

    const invoice = invRes.rows[0];

    // 7. Insert invoice items
    for (const item of pricing.items) {
      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, menu_item_id, item_name, sac_code, quantity,
          unit_price_paise, discount_paise, taxable_value_paise, tax_rate_percent,
          cgst_paise, sgst_paise, igst_paise, total_paise
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          invoice.id,
          item.item_id,
          item.name,
          item.sac_code,
          item.quantity,
          item.unit_price_paise,
          item.item_discount_paise + item.allocated_bill_discount_paise,
          item.taxable_value_paise,
          item.tax_rate_percent,
          item.cgst_paise,
          item.sgst_paise,
          item.igst_paise,
          item.total_paise,
        ]
      );
    }

    // 8. Update order and table status to billed
    await client.query(
      `UPDATE orders SET status = 'billed', updated_at = NOW(), version = version + 1 WHERE id = $1`,
      [order.id]
    );

    if (order.table_id) {
      await client.query(
        `UPDATE tables SET status = 'bill_printed', status_updated_at = NOW(), version = version + 1 WHERE id = $1`,
        [order.table_id]
      );
    }

    await recordAudit({
      outlet_id: order.outlet_id,
      user_id: input.user_id,
      action: 'INVOICE_GENERATE',
      entity_type: 'INVOICE',
      entity_id: invoice.id,
      after_state: {
        invoice_number: invoice.invoice_number,
        total_paise: invoice.total_paise,
        taxable_value_paise: invoice.taxable_value_paise,
      },
    }, client);

    return {
      ...invoice,
      subtotal_paise: Number(invoice.subtotal_paise),
      taxable_value_paise: Number(invoice.taxable_value_paise),
      cgst_paise: Number(invoice.cgst_paise),
      sgst_paise: Number(invoice.sgst_paise),
      igst_paise: Number(invoice.igst_paise),
      service_charge_paise: Number(invoice.service_charge_paise),
      tip_paise: Number(invoice.tip_paise),
      round_off_paise: Number(invoice.round_off_paise),
      total_paise: Number(invoice.total_paise),
      items: pricing.items,
    };
  });
}

export async function createCreditNote(invoiceId: string, reason: string, approvedByUserId: string) {
  return withTransaction(async (client) => {
    const invRes = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [invoiceId]);
    if (invRes.rows.length === 0) throw new Error('Invoice not found');

    const inv = invRes.rows[0];
    if (inv.status === 'credit_noted') throw new Error('Invoice is already credit noted');

    const seriesCode = 'CN';
    const cnNumber = await allocateNextInvoiceNumber(client, inv.outlet_id, seriesCode, inv.financial_year);

    // Negative amounts for Credit Note
    const cnRes = await client.query(
      `INSERT INTO invoices (
        outlet_id, terminal_id, order_id, invoice_number, financial_year,
        business_date, invoice_type, related_invoice_id, supplier_gstin,
        recipient_gstin, recipient_name, place_of_supply, subtotal_paise,
        item_discount_paise, bill_discount_paise, taxable_value_paise,
        cgst_paise, sgst_paise, igst_paise, service_charge_paise, tip_paise,
        round_off_paise, total_paise, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'credit_note', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'issued')
      RETURNING *`,
      [
        inv.outlet_id,
        inv.terminal_id,
        inv.order_id,
        cnNumber,
        inv.financial_year,
        inv.business_date,
        inv.id,
        inv.supplier_gstin,
        inv.recipient_gstin,
        inv.recipient_name,
        inv.place_of_supply,
        -Number(inv.subtotal_paise),
        -Number(inv.item_discount_paise),
        -Number(inv.bill_discount_paise),
        -Number(inv.taxable_value_paise),
        -Number(inv.cgst_paise),
        -Number(inv.sgst_paise),
        -Number(inv.igst_paise),
        -Number(inv.service_charge_paise),
        -Number(inv.tip_paise),
        -Number(inv.round_off_paise),
        -Number(inv.total_paise),
      ]
    );

    // Mark original invoice status as credit_noted
    await client.query(`UPDATE invoices SET status = 'credit_noted' WHERE id = $1`, [invoiceId]);

    // Check if charged to room -> Reverse folio charge!
    const folioChargeRes = await client.query(
      `SELECT * FROM folio_charges WHERE reference_invoice_id = $1 AND is_reversed = FALSE`,
      [invoiceId]
    );

    for (const charge of folioChargeRes.rows) {
      await client.query(
        `UPDATE folio_charges 
         SET is_reversed = TRUE, reversed_at = NOW(), reversal_reason = $1
         WHERE id = $2`,
        [`Invoice credit note: ${cnNumber} (${reason})`, charge.id]
      );

      // Decrement hotel folio total
      await client.query(
        `UPDATE hotel_folios 
         SET total_posted_paise = total_posted_paise - $1
         WHERE id = $2`,
        [charge.amount_paise, charge.folio_id]
      );
    }

    await recordAudit({
      outlet_id: inv.outlet_id,
      user_id: approvedByUserId,
      action: 'INVOICE_CREDIT_NOTE',
      entity_type: 'INVOICE',
      entity_id: cnRes.rows[0].id,
      after_state: { credit_note_number: cnNumber, original_invoice: inv.invoice_number, reason },
    }, client);

    return cnRes.rows[0];
  });
}
