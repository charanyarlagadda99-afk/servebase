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

  let shiftId = '';

  // W6.01: Open shift with opening cash float
  await assert('W6.01: Open register shift with float (Rs 500)', async () => {
    const res = await fetch(`${apiUrl}/api/v1/shifts/open`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        opening_float_paise: 50000,
        terminal_id: '44444444-4444-4444-4444-444444444444'
      })
    });
    const data = await res.json();
    if (res.ok && data.ok && data.data?.id) {
      shiftId = data.data.id;
      return true;
    }
    return false;
  });

  // W6.02: Record cash paid-out (e.g. ice purchase)
  await assert('W6.02: Record cash paid-out movement', async () => {
    if (!shiftId) return false;
    const res = await fetch(`${apiUrl}/api/v1/shifts/cash-movement`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shift_id: shiftId,
        movement_type: 'paid_out',
        amount_paise: 5000,
        reason: 'Emergency ice block'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true;
  });

  // W6.03: Close shift and reconcile cash with C++ engine
  await assert('W6.03: Close shift computes over/short reconciliation', async () => {
    if (!shiftId) return false;
    const res = await fetch(`${apiUrl}/api/v1/shifts/close`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shift_id: shiftId,
        actual_cash_paise: 45000, // Expected 500 - 50 = 450 (45000 paise)
        denominations: { '500': 0, '200': 2, '100': 0, '50': 1 },
        notes: 'Balanced shift close'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true && data.data?.status === 'closed';
  });

  return { passed, failed, failures };
}
