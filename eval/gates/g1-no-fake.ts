import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

export function checkGate(rootDir: string) {
  console.log('Running G1 No-Fake Gate...');
  const webSrc = path.join(rootDir, 'web', 'src');
  const files = walk(webSrc);
  
  let failures: string[] = [];
  
  const mockDataDir = path.join(webSrc, 'data');
  if (fs.existsSync(mockDataDir)) {
    const mockFiles = fs.readdirSync(mockDataDir);
    if (mockFiles.length > 0) {
      failures.push(`Mock data files found in web/src/data: ${mockFiles.join(', ')}`);
    }
  }

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(webSrc, file);

    if (content.includes('getSimulatedFallback')) {
      failures.push(`'getSimulatedFallback' found in ${relPath}`);
    }
    
    // basic check for simulated property assignment
    if (/simulated\s*:|simulated\s*=/.test(content)) {
      failures.push(`'simulated' property assignment found in ${relPath}`);
    }
    
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (content.includes('Math.round') && (content.includes('* 0.05') || content.includes('* 0.18') || content.includes('tax'))) {
        failures.push(`Potential business math (tax calc) in browser found in ${relPath}`);
      }
      
      // case-insensitive check for demo in UI components
      if (file.endsWith('.tsx') && /demo/i.test(content) && !content.includes('demonstrate')) {
        failures.push(`'demo' text found in UI component ${relPath}`);
      }
    }
  }
  
  return {
    passed: failures.length === 0,
    failures
  };
}
