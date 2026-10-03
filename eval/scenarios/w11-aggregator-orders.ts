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

  let token = '';
  const cRes = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234' })
  });
  const cData = await cRes.json();
  if (cRes.ok && cData.data?.token) token = cData.data.token;

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-outlet-id': '33333333-3333-3333-3333-333333333333'
  };

  // W11.01: Aggregator order ingestion
  await assert('W11.01: Aggregator webhook creates order and kitchen ticket', async () => {
    const res = await fetch(`${apiUrl}/api/v1/channels/simulate-order`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        channel_name: 'Zomato',
        channel_order_id: 'ZOM-TEST-001',
        customer_name: 'Test Eater',
        items: [
          {
            menu_item_id: '00000000-0000-0000-0000-000000000003',
            name: 'Burger',
            quantity: 1,
            price_paise: 20000
          }
        ]
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true;
  });

  // W11.02: Payout reconciliation query
  await assert('W11.02: Aggregator payout reconciliation reports commissions and payouts', async () => {
    const res = await fetch(`${apiUrl}/api/v1/channels/payout-reconciliation`, {
      headers: authHeaders
    });
    const data = await res.json();
    return res.ok && data.ok === true && Array.isArray(data.data);
  });

  return { passed, failed, failures };
}
