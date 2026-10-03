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

  // W18.01: State durability in PostgreSQL
  await assert('W18.01: Orders created persist durable state in database across sessions', async () => {
    const res = await fetch(`${apiUrl}/api/v1/orders/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        table_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        order_type: 'dine_in',
        covers: 4,
        notes: 'Durability verification order'
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.data?.id) return false;
    const orderId = data.data.id;

    // Fetch in a fresh request
    const getRes = await fetch(`${apiUrl}/api/v1/orders/${orderId}`, { headers: authHeaders });
    const getData = await getRes.json();
    return getRes.ok && getData.ok === true && getData.data?.notes === 'Durability verification order';
  });

  return { passed, failed, failures };
}
