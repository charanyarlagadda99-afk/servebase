import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIVE_URL = 'https://web-rho-nine-toizqjrice.vercel.app';

async function testKeyboardLogin() {
  console.log('[KEYBOARD TEST] Testing physical keyboard PIN entry on live site...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });

    // Type 1234 with keyboard
    console.log('Typing 1234 with physical keyboard...');
    await page.keyboard.press('1');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('2');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('3');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('4');
    
    await new Promise(r => setTimeout(r, 1200));

    let content = await page.evaluate(() => document.body.innerText);
    let managerLoggedIn = content.includes('POS & Floor') || content.includes('Table Floor Plan');
    console.log('Manager (1234) login via physical keyboard:', managerLoggedIn);
    if (!managerLoggedIn) throw new Error('Manager keyboard login failed');

    // Click logout
    console.log('Logging out...');
    await page.evaluate(() => {
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Logout'));
      if (logoutBtn) logoutBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Type 5678 with keyboard
    console.log('Typing 5678 with physical keyboard...');
    await page.keyboard.press('5');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('6');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('7');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('8');

    await new Promise(r => setTimeout(r, 1200));

    content = await page.evaluate(() => document.body.innerText);
    let cashierLoggedIn = content.includes('POS & Floor') || content.includes('Table Floor Plan');
    console.log('Cashier (5678) login via physical keyboard:', cashierLoggedIn);
    if (!cashierLoggedIn) throw new Error('Cashier keyboard login failed');

    console.log('✓ Both Manager (1234) and Cashier (5678) physical keyboard entries verified!');
  } finally {
    await browser.close();
  }
}

testKeyboardLogin().catch(e => {
  console.error('[KEYBOARD TEST FAILED]', e);
  process.exit(1);
});
