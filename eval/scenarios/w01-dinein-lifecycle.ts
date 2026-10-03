import type { Page, Browser } from 'playwright';
import { Client } from 'pg';

export async function run({ apiUrl, webUrl, browser, page }: { apiUrl: string, webUrl?: string, browser: Browser, page: Page }) {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  const assert = async (name: string, checkFn: () => Promise<boolean> | boolean) => {
    try {
      const ok = await checkFn();
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push(name);
      }
    } catch (e: any) {
      failed++;
      failures.push(`${name} (Exception: ${e.message})`);
    }
  };

  const evalDb = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: 'servebase_eval'
  });
  await evalDb.connect();

  let token = '';
  let outletId = '33333333-3333-3333-3333-333333333333';
  let orderId = '';
  let kotId = '';
  let invoiceId = '';
  let invoiceTotal = 0;

  // W1.01: PIN login returns valid JWT token
  await assert('W1.01: PIN login returns valid JWT token', async () => {
    const res = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    if (!res.ok) return false;
    const body = await res.json();
    if (body.ok && body.data?.token) {
      token = body.data.token;
      return true;
    }
    return false;
  });

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-outlet-id': outletId
  });

  // W1.02: Create dine-in order on table T1
  await assert('W1.02: Creating order sets table status to occupied', async () => {
    if (!token) return false;
    const res = await fetch(`${apiUrl}/api/v1/orders/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        table_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        order_type: 'dine_in',
        covers: 2,
        business_date: '2026-10-03'
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.ok || !data.data?.id) return false;
    orderId = data.data.id;

    // Verify table status is now occupied
    const tRes = await fetch(`${apiUrl}/api/v1/floor/tables`, { headers: authHeaders() });
    if (!tRes.ok) return false;
    const tData = await tRes.json();
    const t1 = (tData.data || []).find((t: any) => t.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' || t.table_number === 'T1');
    return t1 && t1.status === 'occupied';
  });

  // W1.03: Add items to order
  await assert('W1.03: Adding items returns item records', async () => {
    if (!orderId) return false;
    const res = await fetch(`${apiUrl}/api/v1/orders/${orderId}/items`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        items: [
          {
            menu_item_id: '00000000-0000-0000-0000-000000000003',
            item_name: 'Burger',
            quantity: 2,
            unit_price_paise: 20000,
            course: 'main'
          }
        ]
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok && Array.isArray(data.data) && data.data.length > 0;
  });

  // W1.04: Send KOT generates sequential KOT ticket
  await assert('W1.04: Sending KOT generates sequential ticket', async () => {
    if (!orderId) return false;
    const res = await fetch(`${apiUrl}/api/v1/orders/${orderId}/kot`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
      kotId = data.data[0].id;
      return Number(data.data[0].kot_number) >= 1;
    }
    return false;
  });

  // W1.05: Kitchen bump marks ticket completed
  await assert('W1.05: Kitchen bump marks KOT completed', async () => {
    if (!kotId) return false;
    const res = await fetch(`${apiUrl}/api/v1/kitchen/bump`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ kot_id: kotId, action: 'bump' })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  });

  // W1.06: Finalize bill invokes C++ core and computes GST
  await assert('W1.06: Finalize bill computes GST and allocates invoice', async () => {
    if (!orderId) return false;
    const res = await fetch(`${apiUrl}/api/v1/billing/invoice`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ order_id: orderId })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.ok && data.data?.id) {
      invoiceId = data.data.id;
      invoiceTotal = Number(data.data.total_paise);
      const subtotal = Number(data.data.subtotal_paise);
      const cgst = Number(data.data.cgst_paise);
      const sgst = Number(data.data.sgst_paise);
      // In 5% GST mode, CGST is 2.5% and SGST is 2.5%
      return subtotal === 40000 && cgst > 0 && sgst > 0 && (cgst + sgst === 2000);
    }
    return false;
  });

  // W1.07: Consecutive GST invoice number format
  await assert('W1.07: Consecutive GST invoice number format (T1/YY-YY/00001)', async () => {
    if (!invoiceId) return false;
    const res = await fetch(`${apiUrl}/api/v1/billing/invoices/${invoiceId}`, { headers: authHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    const invNum = data.data?.invoice_number || '';
    return invNum.startsWith('T1/') && invNum.includes('/00001');
  });

  // W1.08: Service charge is OFF by default and not taxed
  await assert('W1.08: Service charge is OFF by default', async () => {
    if (!invoiceId) return false;
    const res = await fetch(`${apiUrl}/api/v1/billing/invoices/${invoiceId}`, { headers: authHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return Number(data.data?.service_charge_paise || 0) === 0;
  });

  // W1.09: Payment completes and marks order as paid
  await assert('W1.09: Payment marks order as paid', async () => {
    if (!invoiceId || !invoiceTotal) return false;
    const res = await fetch(`${apiUrl}/api/v1/payments/record`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        outlet_id: outletId,
        invoice_id: invoiceId,
        payment_method: 'cash',
        amount_paise: invoiceTotal,
        idempotency_key: 'w1-pmt-' + Date.now()
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.ok || !data.data?.is_fully_paid) return false;

    // Verify order status
    const oRes = await fetch(`${apiUrl}/api/v1/orders/${orderId}`, { headers: authHeaders() });
    if (!oRes.ok) return false;
    const oData = await oRes.json();
    return oData.data?.status === 'paid';
  });

  // W1.10: Payment frees table back to available
  await assert('W1.10: Payment frees table to available', async () => {
    const tRes = await fetch(`${apiUrl}/api/v1/floor/tables`, { headers: authHeaders() });
    if (!tRes.ok) return false;
    const tData = await tRes.json();
    const t1 = (tData.data || []).find((t: any) => t.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' || t.table_number === 'T1');
    return t1 && (t1.status === 'available' || t1.status === 'cleaning' || t1.status === 'vacant');
  });

  // W1.11: Stock deducted by recipe after order close
  await assert('W1.11: Stock deducted by recipe in stock_ledger', async () => {
    if (!orderId) return false;
    const res = await evalDb.query(
      `SELECT * FROM stock_ledger WHERE outlet_id = $1 AND reference_id = $2`,
      [outletId, orderId]
    );
    return res.rows.length > 0;
  });

  // W1.12: Balanced journal entries posted after payment
  await assert('W1.12: Balanced journal entries posted in general ledger', async () => {
    if (!invoiceId) return false;
    const res = await evalDb.query(
      `SELECT jl.journal_entry_id, SUM(jl.debit_paise) as total_debit, SUM(jl.credit_paise) as total_credit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.reference_id = $1
       GROUP BY jl.journal_entry_id`,
      [invoiceId]
    );
    if (res.rows.length === 0) return false;
    const row = res.rows[0];
    return Number(row.total_debit) > 0 && Number(row.total_debit) === Number(row.total_credit);
  });

  // W1.13: Shift expected cash updated for cash payment
  await assert('W1.13: Shift expected cash updated on cash payment', async () => {
    const res = await evalDb.query(
      `SELECT closing_cash_expected_paise, opening_float_paise FROM shifts WHERE outlet_id = $1 AND status = 'open'`,
      [outletId]
    );
    if (res.rows.length === 0) return false;
    return Number(res.rows[0].closing_cash_expected_paise) >= invoiceTotal;
  });

  // W1.14: Audit log contains cryptographic records
  await assert('W1.14: Audit trail records linear chained hashes for flow', async () => {
    const res = await evalDb.query(
      `SELECT * FROM audit_logs WHERE outlet_id = $1 ORDER BY seq DESC LIMIT 5`,
      [outletId]
    );
    return res.rows.length >= 3 && res.rows.every(r => r.entry_hash && r.entry_hash.length === 64);
  });

  // W1.15: Browser E2E - Terminal PIN login and floor view
  await assert('W1.15: Browser: PIN login renders POS floor plan with live tables', async () => {
    const targetUrl = webUrl || 'http://localhost:5174';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Type 1234 using physical keyboard event
    await page.keyboard.type('1234');
    await page.waitForTimeout(1000);

    // Wait for POS table view
    const hasT1 = await page.isVisible('text=T1').catch(() => false);
    return hasT1;
  });

  await evalDb.end();
  return { passed, failed, failures };
}
