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
    body: JSON.stringify({ pin: '5678' }) // Cashier with role in outlet A only
  });
  const cData = await cRes.json();
  if (cRes.ok && cData.data?.token) token = cData.data.token;

  // W15.01: Requesting unauthorized outlet ID yields 403 Forbidden
  await assert('W15.01: User cannot access data for unauthorized foreign outlet (403)', async () => {
    const foreignOutletId = '99999999-0000-0000-0000-000000000099';
    const res = await fetch(`${apiUrl}/api/v1/floor/tables`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-outlet-id': foreignOutletId
      }
    });
    return res.status === 403;
  });

  return { passed, failed, failures };
}
