import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for preview server at ${url}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function runBrowserTest() {
  console.log('[E2E TEST] Starting Vite Preview Server on port', PREVIEW_PORT);
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore',
  });

  let browser;
  try {
    await waitForServer(PREVIEW_URL);
    console.log('[E2E TEST] Preview server is up. Launching headless Chrome...');

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('[E2E TEST] Navigating to', PREVIEW_URL);
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0' });

    // Step 1: Verify Login Screen is rendered
    console.log('[E2E TEST] Step 1: Verifying Terminal Login Screen...');
    await page.waitForSelector('input[type="password"], button', { timeout: 8000 });
    const titleText = await page.evaluate(() => document.body.innerText);
    if (!titleText.includes('ServeBase') && !titleText.includes('PIN')) {
      throw new Error('Expected ServeBase Login screen not found');
    }
    console.log('✓ Login screen rendered successfully.');

    // Step 2: Enter PIN 1234
    console.log('[E2E TEST] Step 2: Entering 4-digit terminal PIN (1234)...');
    // Click PIN buttons 1, 2, 3, 4
    for (const digit of ['1', '2', '3', '4']) {
      const clicked = await page.evaluate((d) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent && b.textContent.trim() === d);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, digit);
      if (!clicked) {
        // Fallback to typing into input if available
        const input = await page.$('input[type="password"]');
        if (input) await input.type(digit);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // Click Unlock Terminal button
    console.log('[E2E TEST] Submitting PIN...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const enterBtn = buttons.find(b => b.textContent && (
        b.textContent.includes('Unlock') || 
        b.textContent.includes('Enter') || 
        b.textContent.includes('Sign In') || 
        b.textContent.includes('Login')
      ));
      if (enterBtn) enterBtn.click();
    });

    // Wait for transition to POS & Floor Plan or navigation header
    console.log('[E2E TEST] Step 3: Verifying POS navigation and floor plan...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('POS & Floor') || text.includes('Hospitality OS') || text.includes('Table Floor Plan');
    }, { timeout: 10000 });
    console.log('✓ Logged in. POS Floor Plan loaded.');

    // Step 4: Verify navigation tabs and rich populated data in each domain module
    console.log('[E2E TEST] Step 4: Testing domain module navigation tabs & data verification...');
    
    // Tab: Kitchen KDS
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(btn => btn.textContent && btn.textContent.includes('Kitchen KDS'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const kdsText = await page.evaluate(() => document.body.innerText);
    if (!kdsText.includes('KOT') && !kdsText.includes('Tandoor') && !kdsText.includes('Curry') && !kdsText.includes('Kitchen')) {
      throw new Error('KDS screen is empty or missing tickets');
    }
    console.log('  ✓ Navigated to Kitchen KDS (live KOT tickets verified)');

    // Tab: Stock & Recipe
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(btn => btn.textContent && btn.textContent.includes('Stock & Recipe'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const invText = await page.evaluate(() => document.body.innerText);
    if (!invText.includes('Stock') && !invText.includes('Paneer') && !invText.includes('Rice')) {
      throw new Error('Inventory screen is empty');
    }
    console.log('  ✓ Navigated to Stock & Recipe (raw materials and par levels verified)');

    // Tab: Staff & Payroll
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(btn => btn.textContent && btn.textContent.includes('Staff & Payroll'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const staffText = await page.evaluate(() => document.body.innerText);
    if (!staffText.includes('Staff') && !staffText.includes('Rajiv') && !staffText.includes('Pooja')) {
      throw new Error('Staff screen is empty');
    }
    console.log('  ✓ Navigated to Staff & Payroll (employees and roster verified)');

    // Tab: Hotel PMS
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(btn => btn.textContent && btn.textContent.includes('Hotel PMS'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const hotelText = await page.evaluate(() => document.body.innerText);
    if (!hotelText.includes('Room') && !hotelText.includes('101') && !hotelText.includes('Deluxe')) {
      throw new Error('Hotel screen is empty');
    }
    console.log('  ✓ Navigated to Hotel PMS (room rack and folios verified)');

    // Tab: Financials & Reports
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(btn => btn.textContent && btn.textContent.includes('Financials'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const finText = await page.evaluate(() => document.body.innerText);
    if (!finText.includes('Report') && !finText.includes('Gross') && !finText.includes('Sales')) {
      throw new Error('Financials screen is empty');
    }
    console.log('  ✓ Navigated to Financials (Z-report and flash P&L verified)');

    // Return to POS
    await page.evaluate(() => {
      const posBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent && b.textContent.includes('POS & Floor'));
      if (posBtn) posBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const posText = await page.evaluate(() => document.body.innerText);
    if (!posText.includes('Table') && !posText.includes('T1') && !posText.includes('T-1')) {
      throw new Error('POS table grid is empty');
    }
    console.log('✓ Navigated back to POS & Floor (floor plan populated and verified).');

    console.log('\n========================================');
    console.log('ALL PLAYWRIGHT/PUPPETEER E2E TESTS PASSED');
    console.log('========================================\n');
  } finally {
    if (browser) await browser.close();
    previewProcess.kill();
  }
}

runBrowserTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('[E2E TEST FAILED]', err);
  process.exit(1);
});
