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

  let managerToken = '';
  let cashierToken = '';

  // 1. Manager Login
  await assert('W14.01: Manager PIN login returns manager token', async () => {
    const res = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    const body = await res.json();
    if (res.ok && body.data?.token) {
      managerToken = body.data.token;
      return true;
    }
    return false;
  });

  // 2. Cashier Login
  await assert('W14.02: Cashier PIN login returns cashier token', async () => {
    const res = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '5678' })
    });
    const body = await res.json();
    if (res.ok && body.data?.token) {
      cashierToken = body.data.token;
      return true;
    }
    return false;
  });

  // 3. Unauthenticated requests blocked
  await assert('W14.03: Direct unauthenticated API call rejected with 401', async () => {
    const res = await fetch(`${apiUrl}/api/v1/orders`, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.status === 401;
  });

  // 4. Cashier allowed POS operations
  await assert('W14.04: Cashier token authorized to view floor tables', async () => {
    if (!cashierToken) return false;
    const res = await fetch(`${apiUrl}/api/v1/floor/tables`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierToken}`
      }
    });
    return res.status === 200;
  });

  // 5. Cashier blocked from Day Close execute
  await assert('W14.05: Cashier token rejected from day close execute (403)', async () => {
    if (!cashierToken) return false;
    const res = await fetch(`${apiUrl}/api/v1/day-close/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierToken}`
      },
      body: JSON.stringify({ business_date: '2026-10-03' })
    });
    return res.status === 403;
  });

  // 6. Cashier blocked from managerial approvals
  await assert('W14.06: Cashier token rejected from manager approval endpoint (403)', async () => {
    if (!cashierToken) return false;
    const res = await fetch(`${apiUrl}/api/v1/auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        approver_pin: '5678',
        action_type: 'void_item',
        reason: 'Unauthorized attempt'
      })
    });
    return res.status === 403;
  });

  // 7. Manager authorized for managerial operations
  await assert('W14.07: Manager token permitted on day close preview', async () => {
    if (!managerToken) return false;
    const res = await fetch(`${apiUrl}/api/v1/day-close/precheck`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}`
      }
    });
    return res.status === 200;
  });

  return { passed, failed, failures };
}
