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

  // W4.01: Equal split with odd paise sums strictly to master bill
  await assert('W4.01: Equal split of 10001 paise among 3 parts sums exactly to 10001', async () => {
    const res = await fetch(`${apiUrl}/api/v1/billing/split`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        split_type: 'equal',
        num_parts: 3,
        bill: {
          subtotal_paise: 9525,
          taxable_value_paise: 9525,
          cgst_paise: 238,
          sgst_paise: 238,
          total_paise: 10001
        }
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return false;
    const splits = data.data?.splits || data.result?.splits || [];
    if (splits.length !== 3) return false;
    const sumTotal = splits.reduce((acc: number, s: any) => acc + Number(s.total_paise), 0);
    return sumTotal === 10001;
  });

  // W4.02: Split by amount preserves exact totals
  await assert('W4.02: Split by target amount matches requested shares', async () => {
    const res = await fetch(`${apiUrl}/api/v1/billing/split`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        split_type: 'by_amount',
        target_amounts: [4000, 6000],
        bill: {
          subtotal_paise: 9524,
          taxable_value_paise: 9524,
          cgst_paise: 238,
          sgst_paise: 238,
          total_paise: 10000
        }
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return false;
    const splits = data.data?.splits || data.result?.splits || [];
    if (splits.length !== 2) return false;
    const sumTotal = splits.reduce((acc: number, s: any) => acc + Number(s.total_paise), 0);
    return sumTotal === 10000 && Number(splits[0].total_paise) === 4000 && Number(splits[1].total_paise) === 6000;
  });

  return { passed, failed, failures };
}
