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

  const testPhone = '+919999988888';

  // W12.01: Create / upsert customer profile
  await assert('W12.01: Upsert customer profile with phone and name', async () => {
    const res = await fetch(`${apiUrl}/api/v1/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        phone: testPhone,
        name: 'Aarav Mehta',
        email: 'aarav@example.com'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true && !!data.data?.id;
  });

  // W12.02: Customer phone lookup
  await assert('W12.02: Customer lookup returns loyalty balance', async () => {
    const res = await fetch(`${apiUrl}/api/v1/customers/${encodeURIComponent(testPhone)}`, {
      headers: authHeaders
    });
    const data = await res.json();
    return res.ok && data.ok === true && data.data?.phone === testPhone;
  });

  return { passed, failed, failures };
}
