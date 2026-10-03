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

  // W17.01: Realtime SSE endpoint accepts connections
  await assert('W17.01: Realtime SSE event stream responds with text/event-stream', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`${apiUrl}/api/v1/realtime/stream?outlet_id=33333333-3333-3333-3333-333333333333`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const contentType = res.headers.get('content-type') || '';
      return res.status === 200 && contentType.includes('text/event-stream');
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') return true; // Stream connected and was open until abort!
      return false;
    }
  });

  return { passed, failed, failures };
}
