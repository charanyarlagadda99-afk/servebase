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

  let folioId = '';

  // W10.01: Check in guest into Room 101
  await assert('W10.01: Hotel guest check-in creates active folio', async () => {
    const res = await fetch(`${apiUrl}/api/v1/hotel/checkin`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        room_id: '11110000-0000-0000-0000-000000000101',
        guest_id: '22220000-0000-0000-0000-000000000001',
        credit_limit_paise: 5000000 // ₹50,000 credit limit
      })
    });
    const data = await res.json();
    if (res.ok && data.ok && data.data?.id) {
      folioId = data.data.id;
      return true;
    }
    return false;
  });

  // W10.02: Post charge to room folio
  await assert('W10.02: Post F&B charge to room folio with credit check', async () => {
    const res = await fetch(`${apiUrl}/api/v1/hotel/post-charge`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        room_number: '101',
        amount_paise: 150000, // ₹1,500
        description: 'Room Service Dinner'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true;
  });

  // W10.03: Check out guest and settle folio
  await assert('W10.03: Checkout settles folio and vacates room', async () => {
    if (!folioId) return false;
    const res = await fetch(`${apiUrl}/api/v1/hotel/checkout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        folio_id: folioId,
        payment_method: 'card'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true;
  });

  return { passed, failed, failures };
}
