# ServeBase Engineering Progress & Verification Tracker

## Defects Status Summary (D1 - D11)
- [x] **D1 (Core Engine)**: Linux g++ portability fixed (`std::max<int64_t>(0, ...)` in `ops/price_bill.hpp` and `ops/compute_payroll.hpp`), portable `core/Makefile` and root `Makefile` added, all 10 C++ operations verified with zero test failures.
- [x] **D2 (REST Surface)**: Versioned `/api/v1` routes over all 24 domain service areas: `auth`, `platform`, `menu`, `floor`, `orders`, `kot`, `kitchen`, `billing`, `payments`, `shifts`, `day-close`, `inventory`, `recipes`, `purchasing`, `staff`, `payroll`, `accounting`, `alerts`, `hotel`, `channels`, `customers`, `promotions`, `sync`, `audit`, `reports`, `settings`, `imports`. OpenAPI documentation mounted at `/docs`.
- [x] **D3 (API Security & RBAC)**: JWT authentication, 4-digit terminal PIN login, role matrix permissions (`requirePermission`), tenant outlet scoping validated against user roles, Zod request validation, rate limiting (`@fastify/rate-limit`).
- [x] **D4 (Web Data Wiring)**: Complete removal of mock data (`web/src/data/mockData.ts` deleted), typed API client (`web/src/api/client.ts`), dedicated terminal PIN & password login view (`web/src/views/LoginView.tsx`), persistent session storage in localStorage, sticky offline banner when backend is unreachable, live data wiring across Pos, Floor, KDS, Inventory, Staff, Hotel, Reports.
- [x] **D5 (Server-Side Math)**: Removed browser pricing, GST, discount, and splitting math from `PosView.tsx`. All calculations delegated strictly to API + C++ core engine (`/api/v1/billing/calculate` and `/api/v1/billing/split`).
- [x] **D6 (Manager Approvals)**: Real PIN and capability verification on server (`/api/v1/auth/approve`), returning approver identity, reason code, and recording in cryptographic audit trail.
- [x] **D7 (Server Sequences)**: Consecutive invoice numbers (`finalizeBill`) and KOT numbers (`sendKOT`) allocated strictly on server under row locks in PostgreSQL.
- [x] **D8 (Realtime Streaming)**: SSE event channel (`/api/v1/realtime/stream`) broadcasting station queues (`KOT_CREATED`, `KOT_BUMPED`) and floor layout updates (`TABLE_UPDATED`).
- [x] **D9 (Verification Harness)**: Fastify HTTP injection test suite (`api/tests/http_api_v1.test.ts`, 33 tests) and Puppeteer/Playwright browser suite (`web/tests/e2e_pos_flow.js`) against running stack in headless Google Chrome.
- [x] **D10 (Documentation)**: Measured progress numbers and accurate setup runbooks in `PROGRESS.md`, `TEST_REPORT.md`, and `README.md`.
- [x] **D11 (Unified Verification)**: Single `npm run verify` command that verifies C++ core tests, all 102 API tests across 12 test suites, Vite web production build, and headless Chrome browser E2E test.

---

## Live Deployments
- **Production Vercel URL**: `https://web-ba605krb7-foraitools28-9900s-projects.vercel.app`
- **Aliased Domain**: `https://web-rho-nine-toizqjrice.vercel.app`
- **GitHub Repository**: `https://github.com/charanyarlagadda99-afk/servebase.git`

---

## Measured Test Metrics
- **C++17 Engine**: 10 / 10 operations passing (100%)
- **API Test Suite**: 12 / 12 test files passing, 102 / 102 tests passing (100%)
- **Web Build**: `tsc && vite build` passing with 0 errors
- **Browser E2E**: Headless Google Chrome walking Terminal PIN Login, POS Floor Plan, and module navigation passing with 0 errors
- **Unified Verification (`npm run verify`)**: PASS (Exit code 0)
