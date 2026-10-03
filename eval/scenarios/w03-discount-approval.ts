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

  // Login as Cashier (10% cap)
  let cashierToken = '';
  const cRes = await fetch(`${apiUrl}/api/v1/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '5678' })
  });
  const cData = await cRes.json();
  if (cRes.ok && cData.data?.token) cashierToken = cData.data.token;

  const authHeaders = (tok: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tok}`,
    'x-outlet-id': '33333333-3333-3333-3333-333333333333'
  });

  // W3.01: C++ Core calculates tax strictly on discounted taxable value
  await assert('W3.01: C++ Core calculates GST on net taxable value after discount', async () => {
    const res = await fetch(`${apiUrl}/api/v1/billing/calculate`, {
      method: 'POST',
      headers: authHeaders(cashierToken),
      body: JSON.stringify({
        tax_mode: 'no_itc_5',
        bill_discount_percent: 20, // 20% discount
        items: [
          {
            item_id: '00000000-0000-0000-0000-000000000003',
            name: 'Burger',
            quantity: 1,
            unit_price_paise: 10000, // ₹100
            tax_rate_percent: 5.0
          }
        ]
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return false;
    const calc = data.data || data.result;
    // ₹100 gross - 20% (₹20) = ₹80 (8000 paise) taxable value
    // 5% GST on ₹80 = ₹4.00 (400 paise) -> CGST 200, SGST 200
    // Total = ₹84.00 (8400 paise)
    return Number(calc.taxable_value_paise) === 8000 &&
           Number(calc.cgst_paise) === 200 &&
           Number(calc.sgst_paise) === 200 &&
           Number(calc.total_paise) === 8400;
  });

  // W3.02: Discount exceeding cashier cap (10%) requires manager approval
  await assert('W3.02: Discount approval recorded by manager PIN', async () => {
    const res = await fetch(`${apiUrl}/api/v1/auth/approve`, {
      method: 'POST',
      headers: authHeaders(cashierToken),
      body: JSON.stringify({
        approver_pin: '1234',
        action_type: 'discount_override',
        reason: 'VIP guest courtesy discount'
      })
    });
    const data = await res.json();
    return res.ok && data.ok === true && !!data.data?.approvalId;
  });

  return { passed, failed, failures };
}
