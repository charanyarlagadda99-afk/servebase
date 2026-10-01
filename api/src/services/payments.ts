import crypto from 'crypto';
import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export interface ProcessPaymentInput {
  outlet_id: string;
  invoice_id: string;
  order_id: string;
  payment_method: 'cash' | 'card' | 'upi' | 'wallet' | 'voucher' | 'house_account' | 'charge_to_room';
  amount_paise: number;
  idempotency_key: string;
  gateway_ref?: string;
  room_number?: string;
  user_id: string;
}

export async function processPayment(input: ProcessPaymentInput) {
  return withTransaction(async (client) => {
    // 1. Idempotency Check: if key already exists, return existing record safely
    const existingRes = await client.query(
      `SELECT * FROM payments WHERE idempotency_key = $1`,
      [input.idempotency_key]
    );

    if (existingRes.rows.length > 0) {
      return { payment: existingRes.rows[0], is_idempotent_replay: true };
    }

    // 2. Fetch invoice and order
    const invRes = await client.query(
      `SELECT i.*, o.table_id FROM invoices i
       JOIN orders o ON o.id = i.order_id
       WHERE i.id = $1 FOR UPDATE`,
      [input.invoice_id]
    );

    if (invRes.rows.length === 0) throw new Error('Invoice not found');
    const invoice = invRes.rows[0];

    // 3. Handle 'charge_to_room' hotel extension logic
    if (input.payment_method === 'charge_to_room') {
      const roomNum = input.room_number || invoice.room_number;
      if (!roomNum) throw new Error('Room number required for charge_to_room payment');

      // Look up active in-house folio
      const folioRes = await client.query(
        `SELECT f.*, r.room_number FROM hotel_folios f
         JOIN rooms r ON r.id = f.room_id
         WHERE r.room_number = $1 AND f.status = 'active'
         ORDER BY f.check_in_date DESC LIMIT 1 FOR UPDATE`,
        [roomNum]
      );

      if (folioRes.rows.length === 0) {
        throw new Error(`No active in-house folio found for room ${roomNum}`);
      }

      const folio = folioRes.rows[0];
      const newTotal = Number(folio.total_posted_paise) + input.amount_paise;
      if (newTotal > Number(folio.credit_limit_paise)) {
        throw new Error(`Charge exceeds guest credit limit of Rs ${folio.credit_limit_paise / 100}`);
      }

      // Insert folio charge line
      await client.query(
        `INSERT INTO folio_charges (
          folio_id, outlet_id, charge_type, description, amount_paise, reference_invoice_id
        ) VALUES ($1, $2, 'restaurant_charge', $3, $4, $5)`,
        [
          folio.id,
          input.outlet_id,
          `Restaurant bill: ${invoice.invoice_number}`,
          input.amount_paise,
          invoice.id,
        ]
      );

      // Update folio posted balance
      await client.query(
        `UPDATE hotel_folios SET total_posted_paise = $1 WHERE id = $2`,
        [newTotal, folio.id]
      );
    }

    // 4. Record payment
    const simulatedRef = input.gateway_ref || `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const pmtRes = await client.query(
      `INSERT INTO payments (
        outlet_id, invoice_id, order_id, payment_method, amount_paise,
        status, idempotency_key, gateway_ref, simulated
      ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, true)
      RETURNING *`,
      [
        input.outlet_id,
        input.invoice_id,
        input.order_id,
        input.payment_method,
        input.amount_paise,
        input.idempotency_key,
        simulatedRef,
      ]
    );

    const payment = pmtRes.rows[0];

    // 5. Check total payments for this invoice
    const totalPaidRes = await client.query(
      `SELECT COALESCE(SUM(amount_paise), 0) as total_paid
       FROM payments 
       WHERE invoice_id = $1 AND status = 'completed'`,
      [input.invoice_id]
    );
    const totalPaid = Number(totalPaidRes.rows[0].total_paid);
    const invoiceTotal = Number(invoice.total_paise);

    let isFullyPaid = totalPaid >= invoiceTotal;

    if (isFullyPaid) {
      // Mark order paid
      await client.query(
        `UPDATE orders SET status = 'paid', updated_at = NOW(), version = version + 1 WHERE id = $1`,
        [input.order_id]
      );

      // Free or clean table
      if (invoice.table_id) {
        await client.query(
          `UPDATE tables 
           SET status = 'available', active_order_id = NULL, current_covers = 0, assigned_waiter_id = NULL, status_updated_at = NOW(), version = version + 1
           WHERE id = $1`,
          [invoice.table_id]
        );
      }
    } else {
      // Partial payment
      if (invoice.table_id) {
        await client.query(
          `UPDATE tables SET status = 'partially_paid', status_updated_at = NOW(), version = version + 1 WHERE id = $1`,
          [invoice.table_id]
        );
      }
    }

    await recordAudit({
      outlet_id: input.outlet_id,
      user_id: input.user_id,
      action: 'PAYMENT_COLLECT',
      entity_type: 'PAYMENT',
      entity_id: payment.id,
      after_state: {
        payment_method: payment.payment_method,
        amount_paise: payment.amount_paise,
        is_fully_paid: isFullyPaid,
        total_paid: totalPaid,
        invoice_total: invoiceTotal,
      },
    }, client);

    return {
      payment,
      total_paid_paise: totalPaid,
      balance_remaining_paise: Math.max(0, invoiceTotal - totalPaid),
      is_fully_paid: isFullyPaid,
    };
  });
}

export async function refundPayment(
  paymentId: string,
  refundAmountPaise: number,
  reason: string,
  approvalId: string,
  userId: string
) {
  return withTransaction(async (client) => {
    const pmtRes = await client.query(
      `SELECT p.*, i.outlet_id FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (pmtRes.rows.length === 0) throw new Error('Payment not found');
    const payment = pmtRes.rows[0];

    if (refundAmountPaise > Number(payment.amount_paise)) {
      throw new Error('Refund amount exceeds original payment amount');
    }

    // Verify approval
    const appRes = await client.query(`SELECT approver_user_id FROM approvals WHERE id = $1`, [approvalId]);
    if (appRes.rows.length === 0) throw new Error('Manager approval required for refund');

    const refundRes = await client.query(
      `INSERT INTO payment_refunds (payment_id, amount_paise, reason, approved_by, status, simulated)
       VALUES ($1, $2, $3, $4, 'completed', true)
       RETURNING *`,
      [paymentId, refundAmountPaise, reason, appRes.rows[0].approver_user_id]
    );

    await client.query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [paymentId]);

    await recordAudit({
      outlet_id: payment.outlet_id,
      user_id: userId,
      action: 'PAYMENT_REFUND',
      entity_type: 'PAYMENT_REFUND',
      entity_id: refundRes.rows[0].id,
      after_state: { payment_id: paymentId, refund_amount_paise: refundAmountPaise, reason },
    }, client);

    return refundRes.rows[0];
  });
}
