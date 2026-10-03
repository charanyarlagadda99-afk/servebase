import type { Page, Browser } from 'playwright';

export async function run({ apiUrl }: { apiUrl: string, browser: Browser, page: Page }) {
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

  // 1. Login as Cashier (5678)
  let cashierToken = '';
  const cRes = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '5678' })
  });
  const cData = await cRes.json();
  if (cRes.ok && cData.data?.token) cashierToken = cData.data.token;

  // 2. Login as Manager (1234)
  let managerToken = '';
  const mRes = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234' })
  });
  const mData = await mRes.json();
  if (mRes.ok && mData.data?.token) managerToken = mData.data.token;

  const authHeaders = (tok: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tok}`,
    'x-outlet-id': '33333333-3333-3333-3333-333333333333'
  });

  // Create an order, add item, send KOT
  let orderId = '';
  let orderItemId = '';
  const ordRes = await fetch(`${apiUrl}/api/v1/orders/create`, {
    method: 'POST',
    headers: authHeaders(cashierToken),
    body: JSON.stringify({
      table_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      order_type: 'dine_in',
      covers: 2,
      items: [
        {
          menu_item_id: '00000000-0000-0000-0000-000000000003',
          item_name: 'Burger',
          quantity: 1,
          unit_price_paise: 20000,
          course: 'main'
        }
      ]
    })
  });
  const ordData = await ordRes.json();
  if (ordData.ok && ordData.data?.id) {
    orderId = ordData.data.id;
    orderItemId = ordData.data.items?.[0]?.id;
  }

  // Send KOT
  if (orderId) {
    await fetch(`${apiUrl}/api/v1/orders/${orderId}/kot`, {
      method: 'POST',
      headers: authHeaders(cashierToken)
    });
  }

  // W2.01: Void after KOT without manager approval is rejected
  await assert('W2.01: Void after KOT without approval is rejected', async () => {
    if (!orderId || !orderItemId) return false;
    const res = await fetch(`${apiUrl}/api/v1/orders/${orderId}/void-item`, {
      method: 'POST',
      headers: authHeaders(cashierToken),
      body: JSON.stringify({
        order_item_id: orderItemId,
        reason: 'Customer cancelled'
      })
    });
    return res.status === 400 || res.status === 403;
  });

  // W2.02: Wrong manager PIN rejected in approval
  await assert('W2.02: Wrong manager PIN rejected for void approval', async () => {
    const res = await fetch(`${apiUrl}/api/v1/auth/approve`, {
      method: 'POST',
      headers: authHeaders(managerToken),
      body: JSON.stringify({
        approver_pin: '0000', // Invalid PIN
        action_type: 'void_item',
        reason: 'Customer cancelled'
      })
    });
    return res.status === 401 || res.status === 400;
  });

  // W2.03: Correct manager PIN approved and returns approval_id
  let approvalId = '';
  await assert('W2.03: Correct manager PIN creates valid approval record', async () => {
    const res = await fetch(`${apiUrl}/api/v1/auth/approve`, {
      method: 'POST',
      headers: authHeaders(managerToken),
      body: JSON.stringify({
        approver_pin: '1234', // General Manager
        action_type: 'void_item',
        reason: 'Customer changed mind'
      })
    });
    const data = await res.json();
    if (res.ok && data.data?.approvalId) {
      approvalId = data.data.approvalId;
      return true;
    }
    return false;
  });

  // W2.04: Void after KOT succeeds with valid approvalId
  await assert('W2.04: Void after KOT succeeds with valid manager approval', async () => {
    if (!orderId || !orderItemId || !approvalId) return false;
    const res = await fetch(`${apiUrl}/api/v1/orders/${orderId}/void-item`, {
      method: 'POST',
      headers: authHeaders(cashierToken),
      body: JSON.stringify({
        order_item_id: orderItemId,
        reason: 'Customer changed mind',
        approval_id: approvalId
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true && data.data?.is_voided === true;
  });

  return { passed, failed, failures };
}
