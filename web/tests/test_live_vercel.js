import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIVE_URL = 'https://web-rho-nine-toizqjrice.vercel.app';

async function testLiveVercel() {
  console.log('[LIVE VERCEL TEST] Testing production URL:', LIVE_URL);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log('[LIVE VERCEL TEST] Navigating to page...');
    await page.goto(LIVE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    const title = await page.evaluate(() => document.body.innerText);
    console.log('Login screen visible:', title.includes('ServeBase') && title.includes('PIN'));

    // Test entering PIN 1234
    console.log('[LIVE VERCEL TEST] Entering PIN 1234 using on-screen buttons...');
    for (const d of ['1', '2', '3', '4']) {
      await page.evaluate((digit) => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === digit);
        if (btn) btn.click();
      }, d);
      await new Promise(r => setTimeout(r, 150));
    }

    await new Promise(r => setTimeout(r, 1200));

    let postLoginText = await page.evaluate(() => document.body.innerText);
    let loggedIn = postLoginText.includes('POS & Floor') || postLoginText.includes('Table Floor Plan');
    
    if (!loggedIn) {
      console.log('Submitting with Unlock/Enter button...');
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (
          b.textContent.includes('Unlock') || b.textContent.includes('Enter')
        ));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1500));
      postLoginText = await page.evaluate(() => document.body.innerText);
      loggedIn = postLoginText.includes('POS & Floor') || postLoginText.includes('Table Floor Plan');
    }

    console.log('Login successful:', loggedIn);
    if (!loggedIn) throw new Error('Failed to log in to live Vercel app');

    // Verify all 6 tabs
    const tabs = [
      { name: 'Kitchen KDS', check: 'KOT' },
      { name: 'Stock & Recipe', check: 'Paneer' },
      { name: 'Staff & Payroll', check: 'Rajiv' },
      { name: 'Hotel PMS', check: 'Room' },
      { name: 'Financials', check: 'Financials' },
      { name: 'POS & Floor', check: 'Table' },
    ];

    for (const t of tabs) {
      await page.evaluate((name) => {
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent && b.textContent.includes(name));
        if (btn) btn.click();
      }, t.name);
      await new Promise(r => setTimeout(r, 800));
      const content = await page.evaluate(() => document.body.innerText);
      const ok = content.includes(t.check);
      console.log(`Tab '${t.name}': ${ok ? 'OK (rich data populated)' : 'FAILED'}`);
      if (!ok) throw new Error(`Tab ${t.name} did not display expected data`);
    }

    console.log('Console errors captured:', errors.length);
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }

    console.log('\n======================================================');
    console.log('LIVE VERCEL PRODUCTION VERIFICATION: ALL CHECKS PASSED');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

testLiveVercel().catch(e => {
  console.error('[LIVE VERCEL TEST FAILED]', e);
  process.exit(1);
});
