import { setup } from './setup.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function main() {
  const scenariosDir = path.join(__dirname, 'scenarios');
  const scenarioFiles = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.ts') && f.startsWith('w'));
  scenarioFiles.sort();

  // Rule #3: Never weaken, delete, or skip a scenario. Manifest verification:
  const manifestPath = path.join(__dirname, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    for (const reqScenario of manifest.scenarios) {
      if (!scenarioFiles.includes(`${reqScenario}.ts`)) {
        throw new Error(`MANIFEST INTEGRITY VIOLATION: Scenario ${reqScenario} is missing! Eval suite is strictly append-only.`);
      }
    }
  }

  const { apiUrl, webUrl, stop } = await setup();
  
  let browser: any;
  let page: any;
  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  } catch (err) {
    console.warn('Chromium launch failed, running headless via playwright without GUI fallback:', err);
  }
  
  const results: any = {
    scenarios: {},
    gates: {},
    totalPassed: 0,
    totalFailed: 0
  };

  try {
    console.log('\n--- Running Golden Scenarios ---');
    for (const file of scenarioFiles) {
      const scenarioName = file.replace('.ts', '');
      console.log(`Running ${scenarioName}...`);
      try {
        const fileUrl = pathToFileURL(path.join(scenariosDir, file)).href;
        const module = await import(fileUrl);
        const res = await module.run({ apiUrl, webUrl, browser, page });
        
        results.scenarios[scenarioName] = res;
        results.totalPassed += res.passed;
        results.totalFailed += res.failed;
        
        console.log(`  Passed: ${res.passed}, Failed: ${res.failed}`);
        if (res.failures && res.failures.length > 0) {
          res.failures.forEach((f: string) => console.log(`    - [FAIL] ${f}`));
        }
      } catch (e: any) {
        console.log(`  [ERROR] Failed to run ${scenarioName}: ${e.message}`);
        results.scenarios[scenarioName] = { passed: 0, failed: 1, failures: [e.message] };
        results.totalFailed += 1;
      }
    }

    console.log('\n--- Running Quality Gates ---');
    const gatesDir = path.join(__dirname, 'gates');
    if (fs.existsSync(gatesDir)) {
      const gateFiles = fs.readdirSync(gatesDir).filter(f => f.endsWith('.ts'));
      for (const file of gateFiles) {
        const gateName = file.replace('.ts', '');
        console.log(`Running Gate: ${gateName}...`);
        try {
          const fileUrl = pathToFileURL(path.join(gatesDir, file)).href;
          const module = await import(fileUrl);
          const res = await module.checkGate(rootDir);
          
          results.gates[gateName] = res;
          console.log(`  Passed: ${res.passed ? 'Yes' : 'No'}`);
          if (res.failures && res.failures.length > 0) {
            res.failures.forEach((f: string) => console.log(`    - [FAIL] ${f}`));
          }
        } catch (e: any) {
          console.log(`  [ERROR] Failed to run ${gateName}: ${e.message}`);
          results.gates[gateName] = { passed: false, failures: [e.message] };
        }
      }
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    stop();
  }

  const totalAssertions = results.totalPassed + results.totalFailed;
  const scorePercent = totalAssertions === 0 ? 0 : Math.round((results.totalPassed / totalAssertions) * 100);
  results.scorePercent = scorePercent;

  console.log('\n========================================');
  console.log(`SERVEBASE SCORE: ${results.totalPassed} / ${totalAssertions} (${scorePercent}%)`);
  console.log('========================================');
  
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(resultsDir, 'latest.json'), JSON.stringify(results, null, 2));

  if (scorePercent < 100) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
