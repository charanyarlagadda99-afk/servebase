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

  // W9.01: Clock in employee
  await assert('W9.01: Staff clock-in logs attendance record', async () => {
    const res = await fetch(`${apiUrl}/api/v1/staff/clock-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: '77777777-7777-7777-7777-777777777777',
        work_date: '2026-10-03'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true;
  });

  // W9.02: Clock out employee
  await assert('W9.02: Staff clock-out updates shift hours', async () => {
    const res = await fetch(`${apiUrl}/api/v1/staff/clock-out`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: '77777777-7777-7777-7777-777777777777',
        work_date: '2026-10-03',
        break_minutes: 30
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true;
  });

  return { passed, failed, failures };
}
