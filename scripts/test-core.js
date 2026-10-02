import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';
const coreDir = path.resolve('core');

console.log('[CORE TEST] Executing C++ Engine Test Suite...');

try {
  let makeCmd = 'make';
  try {
    execSync('make --version', { stdio: 'ignore' });
  } catch {
    try {
      execSync('mingw32-make --version', { stdio: 'ignore' });
      makeCmd = 'mingw32-make';
    } catch {
      makeCmd = null;
    }
  }

  if (makeCmd) {
    execSync(`${makeCmd} test`, { cwd: coreDir, stdio: 'inherit' });
  } else {
    // Direct compilation fallback
    const binDir = path.join(coreDir, 'bin');
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    const exe = isWindows ? path.join(binDir, 'test_runner.exe') : path.join(binDir, 'test_runner');
    execSync(`g++ -std=c++17 -O2 -Iinclude -Isrc tests/test_runner.cpp -o "${exe}"`, {
      cwd: coreDir,
      stdio: 'inherit',
    });
    execSync(`"${exe}"`, { cwd: coreDir, stdio: 'inherit' });
  }
} catch (err) {
  console.error('[CORE TEST FAILED]', err.message);
  process.exit(1);
}
