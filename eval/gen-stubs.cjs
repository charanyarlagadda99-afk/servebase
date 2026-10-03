const fs = require('fs');
const path = require('path');

const stubs = [
  'w02-takeaway.ts', 'w03-delivery.ts', 'w04-qr-ordering.ts', 'w05-aggregator.ts',
  'w06-cash-management.ts', 'w07-split-bill.ts', 'w08-discounts.ts', 'w09-voids.ts',
  'w10-hotel-room-charge.ts', 'w11-inventory.ts', 'w12-purchasing.ts', 'w13-payroll.ts',
  'w15-reports.ts', 'w16-offline-mode.ts', 'w17-multi-outlet.ts', 'w18-end-of-day.ts'
];

const content = `import type { Page, Browser } from 'playwright';

export async function run({ apiUrl, browser, page }: { apiUrl: string, browser: Browser, page: Page }) {
  return { passed: 0, failed: 1, failures: ['Not implemented'] };
}
`;

for (const s of stubs) {
  fs.writeFileSync(path.join(__dirname, 'scenarios', s), content);
}
