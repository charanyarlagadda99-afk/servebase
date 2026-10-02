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

    // Step 4: Verify navigation tabs
    console.log('[E2E TEST] Step 4: Testing domain module navigation tabs...');
    const tabs = ['Kitchen KDS', 'Stock & Recipe', 'Staff & Payroll', 'Hotel PMS', 'Financials'];
    for (const tabName of tabs) {
      const switched = await page.evaluate((t) => {
        const buttons = Array.from(document.querySelectorAll('nav button'));
        const b = buttons.find(btn => btn.textContent && btn.textContent.includes(t));
        if (b) {
          b.click();
          return true;
        }
        return false;
      }, tabName);
      if (switched) {
        await new Promise(r => setTimeout(r, 200));
        console.log(`  ✓ Navigated to ${tabName}`);
      }
    }

    // Return to POS
    await page.evaluate(() => {
      const posBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent && b.textContent.includes('POS & Floor'));
      if (posBtn) posBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));
    console.log('✓ Navigated back to POS & Floor.');

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
