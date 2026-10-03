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

  let vendorId = '';

  // W8.01: Create vendor
  await assert('W8.01: Register purchasing vendor with GSTIN', async () => {
    const res = await fetch(`${apiUrl}/api/v1/purchasing/vendors`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Heritage Farm Produce',
        supplier_code: 'VEND-01',
        gstin: '07AAACH1234F1Z1',
        payment_terms_days: 30
      })
    });
    const data = await res.json();
    if (res.ok && data.ok && data.data?.id) {
      vendorId = data.data.id;
      return true;
    }
    return false;
  });

  // W8.02: Create Purchase Order
  await assert('W8.02: Create formal Purchase Order (PO)', async () => {
    if (!vendorId) return false;
    const res = await fetch(`${apiUrl}/api/v1/purchasing/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        vendor_id: vendorId,
        items: [
          {
            raw_material_id: '00000000-0000-0000-0000-000000000011',
            quantity: 50,
            unit_price_paise: 3500 // ₹35/kg
          }
        ]
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true && !!data.data?.id;
  });

  return { passed, failed, failures };
}
