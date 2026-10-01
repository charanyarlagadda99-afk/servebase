import { query, withTransaction } from '../db/pool.js';
import { recordStockMovement } from './inventory.js';

export interface CreateVendorInput {
  name: string;
  gstin: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  payment_terms_days?: number;
}

export async function createVendor(input: CreateVendorInput) {
  const res = await query(
    `INSERT INTO vendors (name, gstin, contact_name, phone, email, payment_terms_days)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.name,
      input.gstin,
      input.contact_name || null,
      input.phone || null,
      input.email || null,
      input.payment_terms_days || 30,
    ]
  );
  return res.rows[0];
}

export async function getVendors() {
  const res = await query(`SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name ASC`);
  return res.rows;
}

export interface PurchaseOrderItemInput {
  raw_material_id: string;
  quantity: number;
  unit_price_paise: number;
  tax_rate_percent?: number;
}

export interface CreatePurchaseOrderInput {
  outlet_id: string;
  vendor_id: string;
  created_by: string;
  items: PurchaseOrderItemInput[];
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  return withTransaction(async (client) => {
    // 1. Generate PO number
    const countRes = await client.query(
      `SELECT COUNT(id) as count FROM purchase_orders WHERE outlet_id = $1`,
      [input.outlet_id]
    );
    const seq = Number(countRes.rows[0].count) + 1;
    const poNumber = `PO-${String(seq).padStart(5, '0')}`;

    // 2. Calculate totals
    let subtotalPaise = 0;
    let taxPaise = 0;

    const itemDetails = input.items.map((i) => {
      const lineSubtotal = Math.round(i.quantity * i.unit_price_paise);
      const taxRate = i.tax_rate_percent || 0.0;
      const lineTax = Math.round(lineSubtotal * (taxRate / 100));
      const lineTotal = lineSubtotal + lineTax;

      subtotalPaise += lineSubtotal;
      taxPaise += lineTax;

      return {
        ...i,
        tax_rate_percent: taxRate,
        line_subtotal: lineSubtotal,
        line_tax: lineTax,
        line_total: lineTotal,
      };
    });

    const totalPaise = subtotalPaise + taxPaise;

    // 3. Create PO header
    const poRes = await client.query(
      `INSERT INTO purchase_orders (
        outlet_id, vendor_id, po_number, status, subtotal_paise,
        tax_paise, total_paise, created_by
      ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7)
      RETURNING *`,
      [input.outlet_id, input.vendor_id, poNumber, subtotalPaise, taxPaise, totalPaise, input.created_by]
    );
    const po = poRes.rows[0];

    // 4. Create PO items
    const createdItems = [];
    for (const item of itemDetails) {
      const itemRes = await client.query(
        `INSERT INTO po_items (
          purchase_order_id, raw_material_id, quantity, unit_price_paise,
          tax_rate_percent, total_paise
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [po.id, item.raw_material_id, item.quantity, item.unit_price_paise, item.tax_rate_percent, item.line_total]
      );
      createdItems.push({
        ...itemRes.rows[0],
        quantity: Number(itemRes.rows[0].quantity),
        unit_price_paise: Number(itemRes.rows[0].unit_price_paise),
        total_paise: Number(itemRes.rows[0].total_paise),
      });
    }

    return {
      ...po,
      subtotal_paise: Number(po.subtotal_paise),
      tax_paise: Number(po.tax_paise),
      total_paise: Number(po.total_paise),
      items: createdItems,
    };
  });
}

export async function approvePurchaseOrder(poId: string, approvedByUserId: string) {
  const res = await query(
    `UPDATE purchase_orders 
     SET status = 'approved', approved_by = $1 
     WHERE id = $2 AND status = 'draft' 
     RETURNING *`,
    [approvedByUserId, poId]
  );
  if (res.rows.length === 0) throw new Error('Purchase order not found or not in draft status');
  return {
    ...res.rows[0],
    subtotal_paise: Number(res.rows[0].subtotal_paise),
    tax_paise: Number(res.rows[0].tax_paise),
    total_paise: Number(res.rows[0].total_paise),
  };
}

export interface GoodsReceiptItemInput {
  raw_material_id: string;
  po_qty: number;
  received_qty: number;
  unit_price_paise: number;
  tax_rate_percent?: number;
  batch_number?: string;
  expiry_date?: string;
}

export interface CreateGoodsReceiptNoteInput {
  outlet_id: string;
  vendor_id: string;
  purchase_order_id?: string;
  vendor_invoice_number: string;
  received_date: string;
  received_by: string;
  items: GoodsReceiptItemInput[];
}

export async function createGoodsReceiptNote(input: CreateGoodsReceiptNoteInput) {
  return withTransaction(async (client) => {
    // 1. Generate GRN number
    const countRes = await client.query(
      `SELECT COUNT(id) as count FROM goods_receipt_notes WHERE outlet_id = $1`,
      [input.outlet_id]
    );
    const seq = Number(countRes.rows[0].count) + 1;
    const grnNumber = `GRN-${String(seq).padStart(5, '0')}`;

    // 2. Calculate totals
    let subtotalPaise = 0;
    let taxPaise = 0;

    const itemDetails = input.items.map((i) => {
      const lineSubtotal = Math.round(i.received_qty * i.unit_price_paise);
      const taxRate = i.tax_rate_percent || 0.0;
      const lineTax = Math.round(lineSubtotal * (taxRate / 100));
      const lineTotal = lineSubtotal + lineTax;

      subtotalPaise += lineSubtotal;
      taxPaise += lineTax;

      return {
        ...i,
        tax_rate_percent: taxRate,
        line_subtotal: lineSubtotal,
        line_tax: lineTax,
        line_total: lineTotal,
      };
    });

    const totalPaise = subtotalPaise + taxPaise;

    // 3. Create GRN header
    const grnRes = await client.query(
      `INSERT INTO goods_receipt_notes (
        outlet_id, vendor_id, purchase_order_id, grn_number,
        vendor_invoice_number, received_date, subtotal_paise, tax_paise,
        total_paise, status, received_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'verified', $10)
      RETURNING *`,
      [
        input.outlet_id,
        input.vendor_id,
        input.purchase_order_id || null,
        grnNumber,
        input.vendor_invoice_number,
        input.received_date,
        subtotalPaise,
        taxPaise,
        totalPaise,
        input.received_by,
      ]
    );
    const grn = grnRes.rows[0];

    // 4. Create GRN items and record stock movement for each
    const createdItems = [];
    for (const item of itemDetails) {
      const itemRes = await client.query(
        `INSERT INTO grn_items (
          grn_id, raw_material_id, po_qty, received_qty,
          unit_price_paise, tax_rate_percent, total_paise,
          batch_number, expiry_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          grn.id,
          item.raw_material_id,
          item.po_qty,
          item.received_qty,
          item.unit_price_paise,
          item.tax_rate_percent,
          item.line_total,
          item.batch_number || null,
          item.expiry_date || null,
        ]
      );

      // Post purchase movement to stock ledger (recalculates WAC)
      await recordStockMovement({
        outlet_id: input.outlet_id,
        raw_material_id: item.raw_material_id,
        movement_type: 'purchase',
        quantity: item.received_qty,
        unit_cost_paise: item.unit_price_paise,
        business_date: input.received_date,
        reference_id: grn.id,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        notes: `GRN: ${grnNumber} from vendor inv ${input.vendor_invoice_number}`,
        user_id: input.received_by,
      }, client);

      createdItems.push({
        ...itemRes.rows[0],
        po_qty: Number(itemRes.rows[0].po_qty),
        received_qty: Number(itemRes.rows[0].received_qty),
        unit_price_paise: Number(itemRes.rows[0].unit_price_paise),
        total_paise: Number(itemRes.rows[0].total_paise),
      });
    }

    // 5. If PO specified, update PO status
    if (input.purchase_order_id) {
      await client.query(
        `UPDATE purchase_orders SET status = 'closed' WHERE id = $1`,
        [input.purchase_order_id]
      );
    }

    return {
      ...grn,
      subtotal_paise: Number(grn.subtotal_paise),
      tax_paise: Number(grn.tax_paise),
      total_paise: Number(grn.total_paise),
      items: createdItems,
    };
  });
}

export interface VendorBillItemInput {
  raw_material_id: string;
  billed_qty: number;
  unit_price_paise: number;
}

export interface ThreeWayMatchInput {
  outlet_id: string;
  vendor_id: string;
  po_id: string;
  grn_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  items: VendorBillItemInput[];
}

export interface MatchDiscrepancy {
  type: 'quantity_mismatch' | 'price_mismatch' | 'total_mismatch';
  raw_material_id?: string;
  expected: number;
  actual: number;
  difference: number;
  message: string;
}

export async function validateThreeWayMatch(input: ThreeWayMatchInput) {
  return withTransaction(async (client) => {
    // 1. Load PO items
    const poItemsRes = await client.query(
      `SELECT * FROM po_items WHERE purchase_order_id = $1`,
      [input.po_id]
    );
    const poMap = new Map(poItemsRes.rows.map((r) => [r.raw_material_id, r]));

    // 2. Load GRN items
    const grnItemsRes = await client.query(
      `SELECT * FROM grn_items WHERE grn_id = $1`,
      [input.grn_id]
    );
    const grnMap = new Map(grnItemsRes.rows.map((r) => [r.raw_material_id, r]));

    const discrepancies: MatchDiscrepancy[] = [];

    // 3. Compare each billed line
    for (const bItem of input.items) {
      const poItem = poMap.get(bItem.raw_material_id);
      const grnItem = grnMap.get(bItem.raw_material_id);

      if (!grnItem) {
        discrepancies.push({
          type: 'quantity_mismatch',
          raw_material_id: bItem.raw_material_id,
          expected: 0,
          actual: bItem.billed_qty,
          difference: bItem.billed_qty,
          message: `Item was billed but never received on GRN`,
        });
        continue;
      }

      // Quantity Check: Billed quantity cannot exceed received quantity on GRN
      const receivedQty = Number(grnItem.received_qty);
      if (bItem.billed_qty > receivedQty) {
        discrepancies.push({
          type: 'quantity_mismatch',
          raw_material_id: bItem.raw_material_id,
          expected: receivedQty,
          actual: bItem.billed_qty,
          difference: bItem.billed_qty - receivedQty,
          message: `Billed qty (${bItem.billed_qty}) exceeds GRN received qty (${receivedQty})`,
        });
      }

      // Price Check: Billed unit price cannot exceed negotiated PO unit price
      if (poItem) {
        const poPrice = Number(poItem.unit_price_paise);
        if (bItem.unit_price_paise > poPrice) {
          discrepancies.push({
            type: 'price_mismatch',
            raw_material_id: bItem.raw_material_id,
            expected: poPrice,
            actual: bItem.unit_price_paise,
            difference: bItem.unit_price_paise - poPrice,
            message: `Billed unit price (${bItem.unit_price_paise} paise) exceeds PO agreed price (${poPrice} paise)`,
          });
        }
      }
    }

    const isMatched = discrepancies.length === 0;
    const billStatus = isMatched ? 'verified' : 'discrepancy';

    // 4. Record vendor bill
    const billRes = await client.query(
      `INSERT INTO vendor_bills (
        outlet_id, vendor_id, grn_id, bill_number,
        bill_date, due_date, subtotal_paise, tax_paise,
        total_paise, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.outlet_id,
        input.vendor_id,
        input.grn_id,
        input.bill_number,
        input.bill_date,
        input.due_date,
        input.subtotal_paise,
        input.tax_paise,
        input.total_paise,
        billStatus,
      ]
    );

    const bill = billRes.rows[0];

    return {
      is_matched: isMatched,
      status: billStatus,
      discrepancies,
      bill: {
        ...bill,
        subtotal_paise: Number(bill.subtotal_paise),
        tax_paise: Number(bill.tax_paise),
        total_paise: Number(bill.total_paise),
      },
    };
  });
}
