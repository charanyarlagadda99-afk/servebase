# ServeBase Master Backlog & Verification Ledger

Total Items: 378
Completed Items: 0 / 378 (0.0%)

| ID | Section | Description | Acceptance Tests | Status | Evidence |
| :--- | :--- | :--- | :--- | :---: | :--- |
| BL-001 | D1-CORE | Fix std::max(0LL, int64_t) in core/src/operations/price_bill.cpp and compute_payroll.cpp for Linux g++ | `core/tests/test_price_bill` / `none` | [ ] | pending |
| BL-002 | D1-CORE | Create portable root and core/Makefile with clean, test, and release targets | `make test` / `none` | [ ] | pending |
| BL-003 | D1-CORE | Ensure core builds and passes all 10 operation tests natively on Linux and Windows | `core/bin/test_runner` / `none` | [ ] | pending |
| BL-004 | D2-API-SURFACE | Establish Fastify API route prefix /api/v1 with standardized JSON envelope and error handler | `api/tests/http/api_envelope.test.ts` / `none` | [ ] | pending |
| BL-005 | D2-API-SURFACE | Implement OpenAPI / Swagger documentation endpoint at /docs and /docs/json | `api/tests/http/openapi.test.ts` / `none` | [ ] | pending |
| BL-006 | D2-API-SURFACE | Implement /api/v1/auth routes (terminal-pin, backoffice-login, refresh, logout, me) | `api/tests/http/auth_routes.test.ts` / `web/tests/e2e/login.spec.ts` | [ ] | pending |
| BL-007 | D2-API-SURFACE | Implement /api/v1/platform routes (organizations, brands, outlets, terminals, settings) | `api/tests/http/platform_routes.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-008 | D2-API-SURFACE | Implement /api/v1/menu routes (categories, items, variants, modifiers, combos, availability) | `api/tests/http/menu_routes.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-009 | D2-API-SURFACE | Implement /api/v1/floor routes (areas, tables, table-status, move, merge, split-table) | `api/tests/http/floor_routes.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-010 | D2-API-SURFACE | Implement /api/v1/orders routes (create, get, update, items, hold-fire, cancel, timeline) | `api/tests/http/order_routes.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-011 | D2-API-SURFACE | Implement /api/v1/kot routes (generate, route-station, print-ticket, duplicate-flag) | `api/tests/http/kot_routes.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-012 | D2-API-SURFACE | Implement /api/v1/kitchen routes (active-tickets, bump-item, bump-ticket, recall, stats) | `api/tests/http/kitchen_routes.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-013 | D2-API-SURFACE | Implement /api/v1/billing routes (calculate-bill, finalize-invoice, invoice-lookup, credit-note) | `api/tests/http/billing_routes.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-014 | D2-API-SURFACE | Implement /api/v1/payments routes (process-payment, split-tender, refund, idempotency-check) | `api/tests/http/payment_routes.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-015 | D2-API-SURFACE | Implement /api/v1/shifts routes (open, paid-in-out, drop, denomination-tally, close, blind-close) | `api/tests/http/shift_routes.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-016 | D2-API-SURFACE | Implement /api/v1/day-close routes (precheck, execute-z-close, report, history) | `api/tests/http/day_close_routes.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-017 | D2-API-SURFACE | Implement /api/v1/inventory routes (items, ledger, stock-balance, adjustments, conversions) | `api/tests/http/inventory_routes.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-018 | D2-API-SURFACE | Implement /api/v1/recipes routes (recipe-crud, explode-bom, cost-calc, sub-recipes) | `api/tests/http/recipe_routes.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-019 | D2-API-SURFACE | Implement /api/v1/purchasing routes (vendors, purchase-orders, goods-receipts, three-way-match) | `api/tests/http/purchasing_routes.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-020 | D2-API-SURFACE | Implement /api/v1/staff routes (employees, rosters, pin-clock, attendance-corrections) | `api/tests/http/staff_routes.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-021 | D2-API-SURFACE | Implement /api/v1/payroll routes (salary-structures, run-payroll, statutory-deductions, payslips) | `api/tests/http/payroll_routes.test.ts` / `web/tests/e2e/payroll.spec.ts` | [ ] | pending |
| BL-022 | D2-API-SURFACE | Implement /api/v1/accounting routes (chart-of-accounts, journals, trial-balance, flash-pnl) | `api/tests/http/accounting_routes.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-023 | D2-API-SURFACE | Implement /api/v1/alerts routes (active-alerts, acknowledge, notification-rules) | `api/tests/http/alert_routes.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-024 | D2-API-SURFACE | Implement /api/v1/hotel routes (rooms, checkin-checkout, folios, room-charge, night-audit) | `api/tests/http/hotel_routes.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-025 | D2-API-SURFACE | Implement /api/v1/channels routes (simulated-intake, accept-reject, rider-update, payout-recon) | `api/tests/http/channel_routes.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-026 | D2-API-SURFACE | Implement /api/v1/customers routes (profiles, history, loyalty-balance, coupon-redeem) | `api/tests/http/customer_routes.test.ts` / `web/tests/e2e/customers.spec.ts` | [ ] | pending |
| BL-027 | D2-API-SURFACE | Implement /api/v1/promotions routes (coupons, discounts, rules-engine, happy-hour) | `api/tests/http/promotion_routes.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-028 | D2-API-SURFACE | Implement /api/v1/sync routes (offline-queue-push, conflict-resolve, client-version) | `api/tests/http/sync_routes.test.ts` / `web/tests/e2e/offline.spec.ts` | [ ] | pending |
| BL-029 | D2-API-SURFACE | Implement /api/v1/audit routes (hash-chain-verify, audit-events, filter-by-user) | `api/tests/http/audit_routes.test.ts` / `web/tests/e2e/audit.spec.ts` | [ ] | pending |
| BL-030 | D2-API-SURFACE | Implement /api/v1/reports routes (daily-flash, hourly-matrix, bcg-matrix, leakage, variance) | `api/tests/http/report_routes.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-031 | D2-API-SURFACE | Implement /api/v1/settings routes (outlet-taxes, printing, targets, round-off-rules) | `api/tests/http/settings_routes.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-032 | D2-API-SURFACE | Implement /api/v1/imports routes (csv-menu, csv-inventory, csv-vendors, validation-report) | `api/tests/http/import_routes.test.ts` / `web/tests/e2e/import.spec.ts` | [ ] | pending |
| BL-033 | D3-AUTH | Implement Fastify JWT authentication hook validating Authorization Bearer header | `api/tests/http/auth_jwt.test.ts` / `none` | [ ] | pending |
| BL-034 | D3-AUTH | Enforce token expiry and implement /api/v1/auth/refresh rotation | `api/tests/http/auth_jwt.test.ts` / `none` | [ ] | pending |
| BL-035 | D3-AUTH | Implement role permission matrix guard checking user_outlet_roles against endpoint capabilities | `api/tests/http/rbac_guard.test.ts` / `none` | [ ] | pending |
| BL-036 | D3-AUTH | Scope all tenant database queries to outlet_id extracted from verified token (remove LIMIT 1) | `api/tests/http/tenant_scoping.test.ts` / `none` | [ ] | pending |
| BL-037 | D3-AUTH | Add fastify-rate-limit plugin to protect authentication and sensitive mutation endpoints | `api/tests/http/rate_limit.test.ts` / `none` | [ ] | pending |
| BL-038 | D3-AUTH | Enforce Zod validation schema on every route request body, query params, and route params | `api/tests/http/zod_validation.test.ts` / `none` | [ ] | pending |
| BL-039 | D3-AUTH | Standardize API error envelope: { ok: false, error: { code, message, details, timestamp } } | `api/tests/http/error_format.test.ts` / `none` | [ ] | pending |
| BL-040 | D4-WEB-DATA | Delete web/src/data/mockData.ts and all static INITIAL_* mock states from components | `web/tests/e2e/no_mock_data.spec.ts` / `web/tests/e2e/no_mock_data.spec.ts` | [ ] | pending |
| BL-041 | D4-WEB-DATA | Implement typed API client in web/src/api/client.ts using VITE_API_URL environment variable | `web/tests/e2e/api_client.spec.ts` / `web/tests/e2e/api_client.spec.ts` | [ ] | pending |
| BL-042 | D4-WEB-DATA | Build dedicated full-screen Login View supporting PIN keypad (terminal) and password (back-office) | `web/tests/e2e/login_view.spec.ts` / `web/tests/e2e/login_view.spec.ts` | [ ] | pending |
| BL-043 | D4-WEB-DATA | Persist authenticated JWT and current active outlet in localStorage and restore on page refresh | `web/tests/e2e/session_persistence.spec.ts` / `web/tests/e2e/session_persistence.spec.ts` | [ ] | pending |
| BL-044 | D4-WEB-DATA | Display global sticky Offline Banner when API /health check fails, with retry mechanism | `web/tests/e2e/offline_banner.spec.ts` / `web/tests/e2e/offline_banner.spec.ts` | [ ] | pending |
| BL-045 | D4-WEB-DATA | Wire PosView to fetch categories and active menu items dynamically from /api/v1/menu | `api/tests/http/menu_routes.test.ts` / `web/tests/e2e/pos_live_data.spec.ts` | [ ] | pending |
| BL-046 | D4-WEB-DATA | Wire FloorView / PosView to fetch live table status from /api/v1/floor/tables | `api/tests/http/floor_routes.test.ts` / `web/tests/e2e/floor_live_data.spec.ts` | [ ] | pending |
| BL-047 | D4-WEB-DATA | Wire KitchenView to fetch live KOT station queues from /api/v1/kitchen/tickets | `api/tests/http/kitchen_routes.test.ts` / `web/tests/e2e/kds_live_data.spec.ts` | [ ] | pending |
| BL-048 | D4-WEB-DATA | Wire InventoryView to fetch real stock items and ledger from /api/v1/inventory | `api/tests/http/inventory_routes.test.ts` / `web/tests/e2e/inventory_live_data.spec.ts` | [ ] | pending |
| BL-049 | D4-WEB-DATA | Wire StaffView to fetch real employees and time records from /api/v1/staff | `api/tests/http/staff_routes.test.ts` / `web/tests/e2e/staff_live_data.spec.ts` | [ ] | pending |
| BL-050 | D4-WEB-DATA | Wire HotelView to fetch real room statuses and folios from /api/v1/hotel | `api/tests/http/hotel_routes.test.ts` / `web/tests/e2e/hotel_live_data.spec.ts` | [ ] | pending |
| BL-051 | D4-WEB-DATA | Wire ReportsView to fetch real financial aggregations from /api/v1/reports | `api/tests/http/report_routes.test.ts` / `web/tests/e2e/reports_live_data.spec.ts` | [ ] | pending |
| BL-052 | D5-MATH | Remove client-side tax, discount, and total math in PosView.tsx and delegate to /api/v1/billing/calculate | `api/tests/http/billing_core.test.ts` / `web/tests/e2e/billing_server_math.spec.ts` | [ ] | pending |
| BL-053 | D5-MATH | Ensure tax calculation applies outlet tax mode (5% non-ITC, 18% with ITC, composition) via C++ core | `api/tests/http/billing_core.test.ts` / `web/tests/e2e/billing_server_math.spec.ts` | [ ] | pending |
| BL-054 | D5-MATH | Ensure bill splits (equal, item, seat, amount) run strictly through C++ split_bill op via API | `api/tests/http/split_core.test.ts` / `web/tests/e2e/split_server_math.spec.ts` | [ ] | pending |
| BL-055 | D5-MATH | Ensure service charge is untaxed and optional in C++ calculation engine | `api/tests/http/billing_core.test.ts` / `web/tests/e2e/billing_server_math.spec.ts` | [ ] | pending |
| BL-056 | D6-APPROVAL | Implement POST /api/v1/auth/approve verifying manager PIN, capability, and logging audit event | `api/tests/http/approval_route.test.ts` / `web/tests/e2e/approval_flow.spec.ts` | [ ] | pending |
| BL-057 | D6-APPROVAL | Reject item void after KOT in API without valid manager authorization payload | `api/tests/http/order_void_approval.test.ts` / `web/tests/e2e/approval_flow.spec.ts` | [ ] | pending |
| BL-058 | D6-APPROVAL | Reject bill discount exceeding role cap without valid manager authorization payload | `api/tests/http/discount_approval.test.ts` / `web/tests/e2e/approval_flow.spec.ts` | [ ] | pending |
| BL-059 | D6-APPROVAL | Reject invoice credit note refund without valid manager authorization payload | `api/tests/http/refund_approval.test.ts` / `web/tests/e2e/approval_flow.spec.ts` | [ ] | pending |
| BL-060 | D7-IDENTIFIERS | Generate consecutive gapless invoice numbers using counter-row lock in API | `api/tests/http/invoice_consecutive.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-061 | D7-IDENTIFIERS | Generate station-wise consecutive KOT numbers on server in /api/v1/kot/generate | `api/tests/http/kot_generation.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-062 | D7-IDENTIFIERS | Remove all Math.random and client UUID generation for orders, tickets, and transactions | `api/tests/http/order_routes.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-063 | D8-REALTIME | Implement Server-Sent Events (SSE) endpoint at /api/v1/realtime/stream for station events | `api/tests/http/realtime_sse.test.ts` / `web/tests/e2e/kds_realtime.spec.ts` | [ ] | pending |
| BL-064 | D8-REALTIME | Connect KitchenView to SSE channel and automatically update queue on new KOT dispatch | `api/tests/http/realtime_sse.test.ts` / `web/tests/e2e/kds_realtime.spec.ts` | [ ] | pending |
| BL-065 | D8-REALTIME | Connect FloorView to SSE channel and automatically update table status on billing/occupancy changes | `api/tests/http/realtime_sse.test.ts` / `web/tests/e2e/floor_realtime.spec.ts` | [ ] | pending |
| BL-066 | D9-TESTS | Setup HTTP integration test framework using Fastify inject for all /api/v1 endpoints | `api/tests/http/suite_runner.test.ts` / `none` | [ ] | pending |
| BL-067 | D9-TESTS | Configure Playwright test runner in web/playwright.config.ts targeting live stack | `none` / `web/tests/e2e/smoke.spec.ts` | [ ] | pending |
| BL-068 | D9-TESTS | Implement full E2E Playwright test suite for POS order-to-settlement lifecycle | `api/tests/http/billing_routes.test.ts` / `web/tests/e2e/pos_e2e.spec.ts` | [ ] | pending |
| BL-069 | D9-TESTS | Implement full E2E Playwright test suite for KDS bump-and-recall lifecycle | `api/tests/http/kitchen_routes.test.ts` / `web/tests/e2e/kds_e2e.spec.ts` | [ ] | pending |
| BL-070 | D9-TESTS | Implement full E2E Playwright test suite for Shift open-to-close with denomination tally | `api/tests/http/shift_routes.test.ts` / `web/tests/e2e/shifts_e2e.spec.ts` | [ ] | pending |
| BL-071 | D9-TESTS | Implement full E2E Playwright test suite for Day Close with locked business date | `api/tests/http/day_close_routes.test.ts` / `web/tests/e2e/day_close_e2e.spec.ts` | [ ] | pending |
| BL-072 | D9-TESTS | Implement full E2E Playwright test suite for Hotel PMS check-in, room charge, and night audit | `api/tests/http/hotel_routes.test.ts` / `web/tests/e2e/hotel_e2e.spec.ts` | [ ] | pending |
| BL-073 | D10-DOCS | Audit and update README.md with exact setup steps, verified endpoints, and real requirements | `none` / `none` | [ ] | pending |
| BL-074 | D10-DOCS | Rebuild PROGRESS.md tracking done/total backlog items with real status | `none` / `none` | [ ] | pending |
| BL-075 | D10-DOCS | Rebuild TEST_REPORT.md recording verified HTTP and browser test executions | `none` / `none` | [ ] | pending |
| BL-076 | D11-DEPLOY | Create multi-stage Linux Dockerfile for API compiling C++ core and bundling Fastify | `docker-build-test` / `none` | [ ] | pending |
| BL-077 | D11-DEPLOY | Create docker-compose.yml orchestrating PostgreSQL, C++ core engine, and Fastify API | `docker-compose-test` / `none` | [ ] | pending |
| BL-078 | D11-DEPLOY | Document production deployment runbook for stateful containers (Railway / Render / VPS) | `none` / `none` | [ ] | pending |
| BL-079 | SPEC-A-PLATFORM | Query organization master hierarchy (business > brand > outlet > terminal) | `api/tests/http/platform.test.ts` / `web/tests/e2e/platform.spec.ts` | [ ] | pending |
| BL-080 | SPEC-A-PLATFORM | Persist outlet timezone Asia/Kolkata and financial year Apr-Mar setting | `api/tests/http/platform.test.ts` / `web/tests/e2e/platform.spec.ts` | [ ] | pending |
| BL-081 | SPEC-A-PLATFORM | Configure outlet tax mode: 5% non-ITC, 18% with ITC, or composition scheme | `api/tests/http/platform.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-082 | SPEC-A-PLATFORM | Configure tax-inclusive vs tax-exclusive pricing per outlet | `api/tests/http/platform.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-083 | SPEC-A-PLATFORM | Configure currency format (INR paise, comma grouping, rupee symbol) | `api/tests/http/platform.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-084 | SPEC-A-PLATFORM | Enforce business-day cutoff hour (default 04:00 AM) for all daily business dates | `api/tests/http/business_date.test.ts` / `web/tests/e2e/platform.spec.ts` | [ ] | pending |
| BL-085 | SPEC-A-PLATFORM | Configure target prime cost ratios (food 28-35%, labor 25-35%, prime 60-65%) | `api/tests/http/platform.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-086 | SPEC-A-PLATFORM | Implement explicit round-off configuration (nearest integer paise with dedicated ledger line) | `api/tests/http/platform.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-087 | SPEC-A-PLATFORM | Terminal master management: register POS terminals and station assignments | `api/tests/http/platform.test.ts` / `web/tests/e2e/platform.spec.ts` | [ ] | pending |
| BL-088 | SPEC-A-PLATFORM | Outlet switching in back-office navbar scoping session data to active outlet | `api/tests/http/platform.test.ts` / `web/tests/e2e/platform.spec.ts` | [ ] | pending |
| BL-089 | SPEC-B-AUTH | Terminal PIN login validating 4-digit bcrypt hash and returning short-lived token | `api/tests/http/auth.test.ts` / `web/tests/e2e/auth.spec.ts` | [ ] | pending |
| BL-090 | SPEC-B-AUTH | Back-office password login with username and password returning token + refresh token | `api/tests/http/auth.test.ts` / `web/tests/e2e/auth.spec.ts` | [ ] | pending |
| BL-091 | SPEC-B-AUTH | Enforce PIN lockout after 5 consecutive failed attempts with audit log entry | `api/tests/http/auth_lockout.test.ts` / `web/tests/e2e/auth.spec.ts` | [ ] | pending |
| BL-092 | SPEC-B-AUTH | Role permission matrix mapping roles (Cashier, Captain, Manager, Chef, Admin) to actions | `api/tests/http/auth_rbac.test.ts` / `web/tests/e2e/auth.spec.ts` | [ ] | pending |
| BL-093 | SPEC-B-AUTH | Manager override workflow for item void after KOT generation | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/approval.spec.ts` | [ ] | pending |
| BL-094 | SPEC-B-AUTH | Manager override workflow for bill discounts exceeding role cap (>15%) | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/approval.spec.ts` | [ ] | pending |
| BL-095 | SPEC-B-AUTH | Manager override workflow for invoice credit note / refund | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/approval.spec.ts` | [ ] | pending |
| BL-096 | SPEC-B-AUTH | Manager override workflow for manual price overrides | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/approval.spec.ts` | [ ] | pending |
| BL-097 | SPEC-B-AUTH | Manager override workflow for bill reprinting flagged as DUPLICATE | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/approval.spec.ts` | [ ] | pending |
| BL-098 | SPEC-B-AUTH | Manager override workflow for no-sale cash drawer openings | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/approval.spec.ts` | [ ] | pending |
| BL-099 | SPEC-B-AUTH | Audit record creation for every manager approval with approver ID, timestamp, and reason | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/audit.spec.ts` | [ ] | pending |
| BL-100 | SPEC-C-MENU | Create, update, and soft-delete menu categories with sort orders | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-101 | SPEC-C-MENU | Create, update, and soft-delete menu items with base prices in integer paise | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-102 | SPEC-C-MENU | Support item dietary indicators: vegetarian, non-vegetarian, egg | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-103 | SPEC-C-MENU | Configure allergen indicators (nuts, dairy, gluten, shellfish, soy) | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-104 | SPEC-C-MENU | Assign SAC/HSN codes (e.g. 996311) and GST tax rates per item | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-105 | SPEC-C-MENU | Assign station routing per menu item (Tandoor, Curry, Bar, Pantry, Expediter) | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-106 | SPEC-C-MENU | Configure item preparation times and course classification (Starter, Main, Dessert, Beverage) | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-107 | SPEC-C-MENU | Create item size variants (e.g. Regular, Large) with price deltas | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-108 | SPEC-C-MENU | Create modifier groups with min/max selection constraints (e.g. Spice Level, Toppings) | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-109 | SPEC-C-MENU | Support combo meals with component item selection rules | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-110 | SPEC-C-MENU | Support open items allowing cashier to specify custom name and price at POS | `api/tests/http/menu.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-111 | SPEC-C-MENU | Configure day-part and happy hour pricing schedules | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-112 | SPEC-C-MENU | Configure per-channel pricing overrides (dine-in, takeaway, delivery, aggregator) | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-113 | SPEC-C-MENU | Toggle item availability manually (86 list) | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-114 | SPEC-C-MENU | Automatically toggle item availability when linked recipe ingredients reach zero stock | `api/tests/http/menu_auto_86.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-115 | SPEC-C-MENU | Effective-dated menu versioning preserving price history for audits | `api/tests/http/menu.test.ts` / `web/tests/e2e/menu.spec.ts` | [ ] | pending |
| BL-116 | SPEC-D-FLOOR | Define dining areas/sections (Main Hall, Terrace, Bar, Private Room) | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-117 | SPEC-D-FLOOR | Define tables with shape, seating capacity, and coordinate layout | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-118 | SPEC-D-FLOOR | Table status state machine: available -> occupied -> billed -> cleaning -> available | `api/tests/http/floor_state.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-119 | SPEC-D-FLOOR | Support table reservation status with customer name, phone, and time slot | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-120 | SPEC-D-FLOOR | Support table blocking/unblocking with reason for maintenance | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-121 | SPEC-D-FLOOR | Optimistic concurrency table lock preventing concurrent edits across terminals | `api/tests/http/floor_lock.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-122 | SPEC-D-FLOOR | Move table operation transferring active order to a new vacant table | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-123 | SPEC-D-FLOOR | Merge tables operation combining multiple tables under a single primary order | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-124 | SPEC-D-FLOOR | Split table operation dividing guest checks across separate sub-tables | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-125 | SPEC-D-FLOOR | Record covers (guest count) on table seating with average check calculation | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-126 | SPEC-D-FLOOR | Assign waiter/captain to table with sales performance tracking | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-127 | SPEC-D-FLOOR | Live table idle timers with color-coded warning thresholds (green < 15m, amber 15-30m, red > 30m) | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-128 | SPEC-D-FLOOR | Waitlist queue management with estimated wait time and party size | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-129 | SPEC-D-FLOOR | Walk-in token generation for quick-service and takeaway counters | `api/tests/http/floor.test.ts` / `web/tests/e2e/floor.spec.ts` | [ ] | pending |
| BL-130 | SPEC-E-ORDERS | Support order types: dine-in, takeaway, delivery, room-service, aggregator, QR-table | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-131 | SPEC-E-ORDERS | Enforce order lifecycle: open -> kot_sent -> preparing -> ready -> served -> billed -> paid -> closed | `api/tests/http/order_lifecycle.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-132 | SPEC-E-ORDERS | Attach custom preparation notes per item line | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-133 | SPEC-E-ORDERS | Course firing control: assign items to Hold or Fire courses | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-134 | SPEC-E-ORDERS | Fire held courses generating incremental KOT tickets for the kitchen | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-135 | SPEC-E-ORDERS | Route KOT items to appropriate kitchen stations using C++ route_kot engine | `api/tests/http/kot_routing.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-136 | SPEC-E-ORDERS | Sequential station-wise KOT numbering per business day | `api/tests/http/kot_routing.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-137 | SPEC-E-ORDERS | KOT reprint handling with prominent DUPLICATE banner | `api/tests/http/kot_routing.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-138 | SPEC-E-ORDERS | Item cancellation before KOT dispatch allowed without approval | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-139 | SPEC-E-ORDERS | Item void after KOT dispatch requires reason code and manager PIN verification | `api/tests/http/order_voids.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-140 | SPEC-E-ORDERS | Item void after preparation creates stock wastage entry in inventory ledger | `api/tests/http/order_voids.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-141 | SPEC-E-ORDERS | Item void after bill invoice generation creates statutory credit note | `api/tests/http/order_voids.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-142 | SPEC-E-ORDERS | Complimentary item marking with mandatory reason code and zeroed revenue line | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-143 | SPEC-E-ORDERS | Support percent and flat discounts at item and bill level | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-144 | SPEC-E-ORDERS | Discounts applied strictly before tax with stacking order and maximum cap checks | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-145 | SPEC-E-ORDERS | Audit trail: maintain chronological order timeline of all additions, voids, and status transitions | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-146 | SPEC-F-KITCHEN | Per-station ticket queue view filtered by station (Tandoor, Curry, Bar, Pantry, Expediter) | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-147 | SPEC-F-KITCHEN | FIFO ticket ordering with visual VIP / high-priority indicators | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-148 | SPEC-F-KITCHEN | Real-time elapsed ticket timers with color coding (green <10m, amber 10-15m, red >15m) | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-149 | SPEC-F-KITCHEN | Single-item bump capability marking individual lines as ready | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-150 | SPEC-F-KITCHEN | Whole-ticket bump removing ticket from active station display | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-151 | SPEC-F-KITCHEN | Recall window allowing kitchen staff to un-bump recently completed tickets | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-152 | SPEC-F-KITCHEN | All-day item aggregation count view summing pending preparation quantities across all tickets | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-153 | SPEC-F-KITCHEN | Expo pass screen consolidating multi-station items before server pickup | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-154 | SPEC-F-KITCHEN | Item-ready notification dispatch to assigned waiter / captain | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-155 | SPEC-F-KITCHEN | Ticket preparation time metrics recording bump timestamps for SLA reporting | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-156 | SPEC-G-BILLING | Statutory GST Tax Invoice generation with supplier details, GSTIN, SAC 996311, and place of supply | `api/tests/http/billing.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-157 | SPEC-G-BILLING | Bill of Supply generation for composition scheme outlets without tax breakdown lines | `api/tests/http/billing.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-158 | SPEC-G-BILLING | Atomic consecutive invoice numbering series per financial year under counter row lock (max 16 chars) | `api/tests/http/billing_numbering.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-159 | SPEC-G-BILLING | Separate consecutive invoice sequence per outlet and terminal series | `api/tests/http/billing_numbering.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-160 | SPEC-G-BILLING | Voluntary service charge toggle default OFF, never taxed, one-tap removable | `api/tests/http/billing.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-161 | SPEC-G-BILLING | Gratuity / Tips tracking stored in separate liability ledger distinct from service charge | `api/tests/http/billing.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-162 | SPEC-G-BILLING | Split bill mode: Equal Split using Hamilton largest-remainder integer distribution | `api/tests/http/split_bill.test.ts` / `web/tests/e2e/split_bill.spec.ts` | [ ] | pending |
| BL-163 | SPEC-G-BILLING | Split bill mode: Split By Line Item allocating items to separate guest checks | `api/tests/http/split_bill.test.ts` / `web/tests/e2e/split_bill.spec.ts` | [ ] | pending |
| BL-164 | SPEC-G-BILLING | Split bill mode: Split By Seat allocating items grouped by seat identifier | `api/tests/http/split_bill.test.ts` / `web/tests/e2e/split_bill.spec.ts` | [ ] | pending |
| BL-165 | SPEC-G-BILLING | Split bill mode: Split By Custom Amount against remaining unpaid balance | `api/tests/http/split_bill.test.ts` / `web/tests/e2e/split_bill.spec.ts` | [ ] | pending |
| BL-166 | SPEC-G-BILLING | Multi-tender payment settlement supporting Cash, Card, UPI, and Hotel Room Folio | `api/tests/http/payments.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-167 | SPEC-G-BILLING | Idempotency key enforcement on all payment requests preventing duplicate charges | `api/tests/http/payments_idempotency.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-168 | SPEC-G-BILLING | Simulated UPI dynamic QR code generator returning payment confirmation | `api/tests/http/payments.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-169 | SPEC-G-BILLING | Settled invoices are immutable; post-settlement changes require formal Credit Note | `api/tests/http/billing_credit_note.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-170 | SPEC-G-BILLING | Credit note generation assigns consecutive credit note number and reverses revenue ledger | `api/tests/http/billing_credit_note.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-171 | SPEC-H-SHIFTS | Shift open operation recording opening cash float per user per terminal | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-172 | SPEC-H-SHIFTS | Record cash paid-ins (petty cash replenishment) with mandatory reason | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-173 | SPEC-H-SHIFTS | Record cash paid-outs (vendor cash disbursements) with recipient and reason | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-174 | SPEC-H-SHIFTS | Record safe drops removing excess cash from active terminal drawer | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-175 | SPEC-H-SHIFTS | Shift closing physical cash denomination tally modal (2000, 500, 200, 100, 50, 20, 10, coins) | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-176 | SPEC-H-SHIFTS | Calculate expected cash vs counted cash and flag cash over / short variance | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-177 | SPEC-H-SHIFTS | Optional blind close setting hiding expected cash from cashier during denomination entry | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-178 | SPEC-H-SHIFTS | No-sale cash drawer opening log recording user, timestamp, and justification | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-179 | SPEC-H-SHIFTS | Generate comprehensive Shift Report with sales by tender, drops, and variance summary | `api/tests/http/shifts.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-180 | SPEC-I-DAYCLOSE | Day close pre-flight check verifying zero open orders, unsettled bills, or open shifts | `api/tests/http/day_close.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-181 | SPEC-I-DAYCLOSE | Generate comprehensive Z-Report grouped by category, payment mode, tax slab, and comps | `api/tests/http/day_close.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-182 | SPEC-I-DAYCLOSE | Lock business date preventing any new transactions under the closed date | `api/tests/http/day_close.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-183 | SPEC-I-DAYCLOSE | Roll business date forward to next operational date automatically | `api/tests/http/day_close.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-184 | SPEC-I-DAYCLOSE | Post-closure modifications restricted to adjustment journal entries with manager authorization | `api/tests/http/day_close.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-185 | SPEC-I-DAYCLOSE | Idempotent day-close execution preventing duplicate ledger postings for the same business date | `api/tests/http/day_close.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-186 | SPEC-J-INVENTORY | Raw material master (items, SKU, storage location, unit of measure, minimum par level) | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-187 | SPEC-J-INVENTORY | Unit conversions (e.g. 1 kg = 1000 g, 1 l = 1000 ml) for recipe calculations | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-188 | SPEC-J-INVENTORY | Append-only stock transaction ledger recording purchases, sales, wastage, and transfers | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-189 | SPEC-J-INVENTORY | Recalculate Weighted Average Cost (WAC) automatically on each Goods Receipt Note | `api/tests/http/inventory_wac.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-190 | SPEC-J-INVENTORY | Recipe Bill of Materials (BOM) creation with ingredient quantities, yield, and wastage % | `api/tests/http/recipes.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-191 | SPEC-J-INVENTORY | Sub-recipe hierarchy support (e.g. Curry Paste used in multiple main dishes) | `api/tests/http/recipes.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-192 | SPEC-J-INVENTORY | Automatic ingredient depletion on KOT dispatch or bill settlement (configurable) | `api/tests/http/inventory_depletion.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-193 | SPEC-J-INVENTORY | Batch and expiry date tracking with First-Expiry-First-Out (FEFO) consumption priority | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-194 | SPEC-J-INVENTORY | Cycle count and full physical stock count entry with theoretical vs physical comparison | `api/tests/http/inventory_counts.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-195 | SPEC-J-INVENTORY | Record inventory wastage with reason codes (spoilage, burned, expired, spillage) | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-196 | SPEC-J-INVENTORY | Inter-outlet stock transfer with dispatch, transit tracking, and receiving acknowledgement | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-197 | SPEC-J-INVENTORY | Theoretical vs actual usage variance analysis report using C++ compute_variance op | `api/tests/http/inventory_variance.test.ts` / `web/tests/e2e/inventory.spec.ts` | [ ] | pending |
| BL-198 | SPEC-K-PURCHASING | Vendor master management (business name, contact, GSTIN, payment terms, bank details) | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-199 | SPEC-K-PURCHASING | Purchase indent creation from low-stock par level recommendations | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-200 | SPEC-K-PURCHASING | Purchase Order (PO) workflow: Draft -> Approved -> Sent -> Partially Received -> Closed | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-201 | SPEC-K-PURCHASING | Goods Receipt Note (GRN) recording received quantities, batch numbers, and expiry dates | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-202 | SPEC-K-PURCHASING | Three-way match reconciliation: PO vs GRN vs Vendor Invoice with price/qty tolerance rules | `api/tests/http/three_way_match.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-203 | SPEC-K-PURCHASING | Purchase return and Debit Note generation for damaged or rejected goods | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-204 | SPEC-K-PURCHASING | Vendor price history tracking with price spike alerts on unexpected increases | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-205 | SPEC-K-PURCHASING | Vendor payment scheduling and Accounts Payable ageing report (0-30, 31-60, 61-90, 90+ days) | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-206 | SPEC-K-PURCHASING | Input Tax Credit (ITC) handling: capitalizes tax to cost under non-ITC mode, posts to asset under ITC mode | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-207 | SPEC-L-STAFF | Employee master: multi-role assignment, multi-outlet allocation, contact details, bank info | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-208 | SPEC-L-STAFF | Shift template scheduling and weekly roster with employee overlap conflict detection | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-209 | SPEC-L-STAFF | Terminal PIN time clock: clock-in, break-start, break-end, clock-out | `api/tests/http/staff_clock.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-210 | SPEC-L-STAFF | Enforce 15-minute grace period with automatic late-arrival and early-departure flags | `api/tests/http/staff_clock.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-211 | SPEC-L-STAFF | Attendance correction workflow requiring manager PIN approval | `api/tests/http/staff_clock.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-212 | SPEC-L-STAFF | Employee leave tracking: Casual, Sick, Paid leave requests and balances | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-213 | SPEC-L-STAFF | Salary structure configuration: Basic, HRA, Conveyance, Special Allowance, Overtime rate | `api/tests/http/payroll.test.ts` / `web/tests/e2e/payroll.spec.ts` | [ ] | pending |
| BL-214 | SPEC-L-STAFF | Employee Provident Fund (EPF Act 1952) calculation via C++ compute_payroll op | `api/tests/http/payroll.test.ts` / `web/tests/e2e/payroll.spec.ts` | [ ] | pending |
| BL-215 | SPEC-L-STAFF | Employee State Insurance (ESI Act 1948) calculation via C++ compute_payroll op | `api/tests/http/payroll.test.ts` / `web/tests/e2e/payroll.spec.ts` | [ ] | pending |
| BL-216 | SPEC-L-STAFF | Professional Tax (PT) state-wise slab deduction and TDS income tax withholding | `api/tests/http/payroll.test.ts` / `web/tests/e2e/payroll.spec.ts` | [ ] | pending |
| BL-217 | SPEC-L-STAFF | Mandatory "Verify statutory deductions with your chartered accountant" notice on payroll screen | `api/tests/http/payroll.test.ts` / `web/tests/e2e/payroll.spec.ts` | [ ] | pending |
| BL-218 | SPEC-L-STAFF | Monthly payslip generation with printable PDF preview | `api/tests/http/payroll.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-219 | SPEC-L-STAFF | Staff meal tracking with daily allowance limits | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-220 | SPEC-L-STAFF | Staff discount policy enforcement with employee discount caps | `api/tests/http/staff.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-221 | SPEC-L-STAFF | Server sales ranking and void rate performance analysis | `api/tests/http/staff.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-222 | SPEC-M-ACCOUNTING | Standard Chart of Accounts (Assets, Liabilities, Equity, Revenue, COGS, OPEX) | `api/tests/http/accounting.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-223 | SPEC-M-ACCOUNTING | Automated balanced journal entries posted on bill settlement (Debit Cash/Bank, Credit Revenue/GST) | `api/tests/http/accounting_auto.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-224 | SPEC-M-ACCOUNTING | Automated balanced journal entries posted on inventory consumption (Debit COGS, Credit Inventory) | `api/tests/http/accounting_auto.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-225 | SPEC-M-ACCOUNTING | Automated balanced journal entries posted on purchasing (Debit Inventory, Credit Accounts Payable) | `api/tests/http/accounting_auto.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-226 | SPEC-M-ACCOUNTING | Automated balanced journal entries posted on payroll disbursement (Debit Wages, Credit Payables/TDS) | `api/tests/http/accounting_auto.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-227 | SPEC-M-ACCOUNTING | Manual journal entry form with debit/credit balance constraint and manager authorization | `api/tests/http/accounting.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-228 | SPEC-M-ACCOUNTING | Bank reconciliation tool matching bank statement transactions against POS settlement batches | `api/tests/http/accounting.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-229 | SPEC-M-ACCOUNTING | Accounting period lock preventing backdated journal entries into closed financial periods | `api/tests/http/accounting.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-230 | SPEC-M-ACCOUNTING | Real-time Trial Balance report enforcing Total Debits == Total Credits | `api/tests/http/accounting_reports.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-231 | SPEC-M-ACCOUNTING | Daily Flash P&L statement comparing sales revenue against COGS, labor, and prime cost | `api/tests/http/accounting_reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-232 | SPEC-M-ACCOUNTING | Monthly Profit & Loss Statement and basic Balance Sheet reporting | `api/tests/http/accounting_reports.test.ts` / `web/tests/e2e/accounting.spec.ts` | [ ] | pending |
| BL-233 | SPEC-M-ACCOUNTING | GSTR-1 outward supplies summary export (B2B, B2C, HSN summary, Credit Notes) | `api/tests/http/accounting_gst.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-234 | SPEC-M-ACCOUNTING | GSTR-3B monthly tax computation export with input tax credit reconciliation | `api/tests/http/accounting_gst.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-235 | SPEC-N-HOTEL | Room master: room numbers, room types (Deluxe, Suite, Standard), status (vacant, occupied, cleaning) | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-236 | SPEC-N-HOTEL | Guest registration, check-in, room key assignment, and check-out with folio settlement | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-237 | SPEC-N-HOTEL | Guest folio management tracking room charges, POS restaurant postings, taxes, and payments | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-238 | SPEC-N-HOTEL | POS charge-to-room: in-house guest lookup by room number and guest name verification | `api/tests/http/hotel_charges.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-239 | SPEC-N-HOTEL | Folio credit limit validation rejecting room charge if remaining limit is exceeded | `api/tests/http/hotel_charges.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-240 | SPEC-N-HOTEL | Post POS charge to room folio stamped with outlet, terminal, invoice number, and posting timestamp | `api/tests/http/hotel_charges.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-241 | SPEC-N-HOTEL | Mandatory POS void reversal: voiding a restaurant bill MUST post an offsetting reversal on the room folio | `api/tests/http/hotel_void_reversal.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-242 | SPEC-N-HOTEL | Room service order management with tray tracking and delivery status | `api/tests/http/hotel.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-243 | SPEC-N-HOTEL | Night Audit wizard: verify unposted outlet transactions, post room tariffs & taxes, roll hotel date | `api/tests/http/hotel_night_audit.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-244 | SPEC-N-HOTEL | Night audit metrics: compute Average Daily Rate (ADR) and Revenue Per Available Room (RevPAR) | `api/tests/http/hotel_night_audit.test.ts` / `web/tests/e2e/hotel.spec.ts` | [ ] | pending |
| BL-245 | SPEC-N-HOTEL | Room GST tax slab configuration (e.g. 12% below ₹7500, 18% above) flagged "verify with CA" | `api/tests/http/hotel.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-246 | SPEC-O-CHANNELS | Simulated Zomato & Swiggy webhook intake endpoint receiving online delivery orders | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-247 | SPEC-O-CHANNELS | Item catalog mapping between internal POS menu items and aggregator channel IDs | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-248 | SPEC-O-CHANNELS | Auto-accept or manual accept / reject within configured timer threshold | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-249 | SPEC-O-CHANNELS | Auto-dispatch aggregator orders to kitchen KDS with station routing | `api/tests/http/channels.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-250 | SPEC-O-CHANNELS | Aggregator delivery status updates: Order Accepted -> Food Ready -> Dispatched -> Delivered | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-251 | SPEC-O-CHANNELS | Channel commission tracking: configure aggregator commission % (e.g. 22%) and delivery fee | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-252 | SPEC-O-CHANNELS | Payout reconciliation: order gross - commission - taxes - fees == expected net bank payout | `api/tests/http/channels_payout.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-253 | SPEC-O-CHANNELS | Per-channel GST TCS (Tax Collected at Source) flag with CA confirmation notice | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-254 | SPEC-O-CHANNELS | Direct online ordering intake API allowing custom branded web orders | `api/tests/http/channels.test.ts` / `web/tests/e2e/channels.spec.ts` | [ ] | pending |
| BL-255 | SPEC-P-CUSTOMERS | Customer profile master (name, phone number, email, address, notes, birthdate, anniversary) | `api/tests/http/customers.test.ts` / `web/tests/e2e/customers.spec.ts` | [ ] | pending |
| BL-256 | SPEC-P-CUSTOMERS | Customer order history tracking lifetime visits, average spend, and favorite items | `api/tests/http/customers.test.ts` / `web/tests/e2e/customers.spec.ts` | [ ] | pending |
| BL-257 | SPEC-P-CUSTOMERS | Customer B2B GSTIN recording for corporate invoices requiring tax credit | `api/tests/http/customers.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-258 | SPEC-P-CUSTOMERS | Loyalty tier progression: Bronze -> Silver -> Gold -> Platinum based on annual spend | `api/tests/http/customers_loyalty.test.ts` / `web/tests/e2e/customers.spec.ts` | [ ] | pending |
| BL-259 | SPEC-P-CUSTOMERS | Loyalty point accrual on invoice settlement and redemption against bill total | `api/tests/http/customers_loyalty.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-260 | SPEC-P-CUSTOMERS | Promo coupon code engine with validity window, usage limits, minimum bill, and channel constraints | `api/tests/http/promotions.test.ts` / `web/tests/e2e/pos.spec.ts` | [ ] | pending |
| BL-261 | SPEC-P-CUSTOMERS | Marketing communication consent flags (SMS, WhatsApp, Email opt-in/opt-out) | `api/tests/http/customers.test.ts` / `web/tests/e2e/customers.spec.ts` | [ ] | pending |
| BL-262 | SPEC-P-CUSTOMERS | Simulated SMS / WhatsApp receipt and invoice delivery notification | `api/tests/http/customers.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-263 | SPEC-Q-REPORTS | Daily Flash report: total sales, covers, average check, food cost %, labor cost %, prime cost vs targets | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-264 | SPEC-Q-REPORTS | Sales by category, item, and channel with quantity and revenue totals | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-265 | SPEC-Q-REPORTS | Hourly sales heatmap matrix (Hour x Weekday) computed via C++ aggregate_sales op | `api/tests/http/reports_matrices.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-266 | SPEC-Q-REPORTS | Kasavana & Smith BCG Menu Engineering matrix (Stars, Plowhorses, Puzzles, Dogs) via C++ op | `api/tests/http/reports_bcg.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-267 | SPEC-Q-REPORTS | ABC Inventory Analysis classifying stock items by consumption value (A=80%, B=15%, C=5%) | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-268 | SPEC-Q-REPORTS | Leakage report tracking voids, discounts, comps, and refunds grouped by authorizing user | `api/tests/http/reports_leakage.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-269 | SPEC-Q-REPORTS | Table turnover time analytics: seating duration and covers per hour | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-270 | SPEC-Q-REPORTS | Kitchen ticket fulfillment time analytics: average prep time per station vs target SLAs | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-271 | SPEC-Q-REPORTS | Inventory theoretical vs actual consumption variance report with root-cause reasons | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-272 | SPEC-Q-REPORTS | Wastage report categorized by reason code with rupee loss totals | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-273 | SPEC-Q-REPORTS | Vendor purchase price trends and price increase tracking | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-274 | SPEC-Q-REPORTS | Payment mode reconciliation report (Cash, Card, UPI, Room Charge totals) | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-275 | SPEC-Q-REPORTS | Statutory GST tax report detailing 5% and 18% CGST/SGST collected vs tax liability | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-276 | SPEC-Q-REPORTS | Multi-outlet comparison report comparing gross sales, covers, and prime cost ratios across outlets | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-277 | SPEC-Q-REPORTS | Server performance scorecard: sales per labor hour, average ticket, and void rate | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-278 | SPEC-Q-REPORTS | CSV export capability on every reporting table with verified data headers | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports.spec.ts` | [ ] | pending |
| BL-279 | SPEC-R-ALERTS | Low stock alert triggered when ingredient balance drops below configured par level | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-280 | SPEC-R-ALERTS | Near-expiry alert triggered when ingredient batch reaches expiry threshold (e.g. 3 days) | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-281 | SPEC-R-ALERTS | Negative stock alert triggered if inventory goes below zero | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-282 | SPEC-R-ALERTS | Vendor price spike alert triggered when GRN unit cost exceeds purchase order by >5% | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-283 | SPEC-R-ALERTS | Operational leakage alert triggered on unusual spikes in voids, comps, or discounts | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-284 | SPEC-R-ALERTS | No-sale cash drawer opening alert logging unexpected manual drawer pops | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-285 | SPEC-R-ALERTS | Cash discrepancy alert on shift close when counted cash differs from expected cash | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-286 | SPEC-R-ALERTS | Unclosed shift or unclosed business day warning before scheduled cutoff hour | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-287 | SPEC-R-ALERTS | Consecutive invoice number gap alert verifying chronological sequence integrity | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-288 | SPEC-R-ALERTS | Aggregator pending order alert when delivery order is not accepted within 3 minutes | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-289 | SPEC-R-ALERTS | In-app notification center modal with unread badge counter and acknowledge actions | `api/tests/http/alerts.test.ts` / `web/tests/e2e/alerts.spec.ts` | [ ] | pending |
| BL-290 | SPEC-S-SETUP | First-run onboarding wizard guiding brand, outlet, tax configuration, and menu initialization | `api/tests/http/settings.test.ts` / `web/tests/e2e/onboarding.spec.ts` | [ ] | pending |
| BL-291 | SPEC-S-SETUP | Settings screen: tax mode, inclusive/exclusive pricing, and round-off rule configuration | `api/tests/http/settings.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-292 | SPEC-S-SETUP | Settings screen: thermal printer configuration (simulated 80mm ESC/POS and network IP) | `api/tests/http/settings.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-293 | SPEC-S-SETUP | Settings screen: receipt design header, footer, GSTIN, FSSAI number, and disclaimer text | `api/tests/http/settings.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-294 | SPEC-S-SETUP | Settings screen: consecutive numbering prefix and series configuration per terminal | `api/tests/http/settings.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-295 | SPEC-S-SETUP | Settings screen: target prime cost and operational budget ratio thresholds | `api/tests/http/settings.test.ts` / `web/tests/e2e/settings.spec.ts` | [ ] | pending |
| BL-296 | SPEC-S-SETUP | CSV Import tool for menu categories and items with error validation reporting | `api/tests/http/imports.test.ts` / `web/tests/e2e/import.spec.ts` | [ ] | pending |
| BL-297 | SPEC-S-SETUP | CSV Import tool for raw materials and inventory par levels | `api/tests/http/imports.test.ts` / `web/tests/e2e/import.spec.ts` | [ ] | pending |
| BL-298 | SPEC-S-SETUP | CSV Import tool for vendor master profiles and payment terms | `api/tests/http/imports.test.ts` / `web/tests/e2e/import.spec.ts` | [ ] | pending |
| BL-299 | SPEC-S-SETUP | CSV Import tool for employee master records and roles | `api/tests/http/imports.test.ts` / `web/tests/e2e/import.spec.ts` | [ ] | pending |
| BL-300 | SPEC-S-SETUP | CSV Import tool for customer profiles and loyalty tiers | `api/tests/http/imports.test.ts` / `web/tests/e2e/import.spec.ts` | [ ] | pending |
| BL-301 | SPEC-S-SETUP | User activity log screen displaying chronological administrative audit events | `api/tests/http/audit.test.ts` / `web/tests/e2e/audit.spec.ts` | [ ] | pending |
| BL-302 | SPEC-S-SETUP | Database backup and restore CLI script supporting disaster recovery | `scripts/backup_restore.test.ts` / `none` | [ ] | pending |
| BL-303 | SPEC-T-PRINTS | 80mm Thermal Receipt template with outlet GSTIN, FSSAI, itemized bill, tax breakdown, and QR code | `api/tests/http/templates.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-304 | SPEC-T-PRINTS | A4 GST Tax Invoice template formatted for formal corporate billing and hotel checkouts | `api/tests/http/templates.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-305 | SPEC-T-PRINTS | Kitchen Order Ticket (KOT) print template with table number, waiter, station, items, and notes | `api/tests/http/templates.test.ts` / `web/tests/e2e/kds.spec.ts` | [ ] | pending |
| BL-306 | SPEC-T-PRINTS | End-of-Day Z-Report print template summarizing financial turnover and tax totals | `api/tests/http/templates.test.ts` / `web/tests/e2e/day_close.spec.ts` | [ ] | pending |
| BL-307 | SPEC-T-PRINTS | Shift Close Report print template with cash float, drops, over/short, and tender totals | `api/tests/http/templates.test.ts` / `web/tests/e2e/shifts.spec.ts` | [ ] | pending |
| BL-308 | SPEC-T-PRINTS | Employee Monthly Payslip print template with earnings, statutory deductions, and net pay | `api/tests/http/templates.test.ts` / `web/tests/e2e/staff.spec.ts` | [ ] | pending |
| BL-309 | SPEC-T-PRINTS | Purchase Order print template with vendor address, line items, and delivery terms | `api/tests/http/templates.test.ts` / `web/tests/e2e/purchasing.spec.ts` | [ ] | pending |
| BL-310 | SPEC-T-PRINTS | Print preview modal rendering realistic thermal paper simulation with copy/print actions | `api/tests/http/templates.test.ts` / `web/tests/e2e/billing.spec.ts` | [ ] | pending |
| BL-311 | SPEC-U-CROSS | Append-only linear SHA-256 tamper-evident hash chain linking financial transactions | `api/tests/http/audit_hash_chain.test.ts` / `none` | [ ] | pending |
| BL-312 | SPEC-U-CROSS | Audit chain integrity verification endpoint proving zero tampering or record deletion | `api/tests/http/audit_hash_chain.test.ts` / `web/tests/e2e/audit.spec.ts` | [ ] | pending |
| BL-313 | SPEC-U-CROSS | Idempotency key enforcement on all money and stock mutations preventing double-postings | `api/tests/http/idempotency.test.ts` / `none` | [ ] | pending |
| BL-314 | SPEC-U-CROSS | ACID database transactions wrapping multi-table orders, inventory depletion, and journal entries | `api/tests/http/transactions.test.ts` / `none` | [ ] | pending |
| BL-315 | SPEC-U-CROSS | Offline-first client sync engine with UUID keys and local action outbox | `api/tests/http/offline_sync.test.ts` / `web/tests/e2e/offline.spec.ts` | [ ] | pending |
| BL-316 | SPEC-U-CROSS | Deterministic conflict resolution during offline queue sync (server timestamp priority) | `api/tests/http/offline_sync.test.ts` / `web/tests/e2e/offline.spec.ts` | [ ] | pending |
| BL-317 | SPEC-U-CROSS | Simulated offline resilience test: queue orders offline and successfully sync when reconnected | `api/tests/http/offline_sync.test.ts` / `web/tests/e2e/offline.spec.ts` | [ ] | pending |
| BL-318 | SPEC-U-CROSS | Native C++ calculation worker process pool with auto-restart on worker crash | `api/tests/http/core_pool.test.ts` / `none` | [ ] | pending |
| BL-319 | SPEC-U-CROSS | Return HTTP 503 Service Unavailable if C++ worker pool is completely exhausted or down | `api/tests/http/core_pool.test.ts` / `none` | [ ] | pending |
| BL-320 | SPEC-U-CROSS | High-throughput database connection pool with parameterized queries preventing SQL injection | `api/tests/http/db_pool.test.ts` / `none` | [ ] | pending |
| BL-321 | SPEC-U-CROSS | Scale benchmark verification: handle concurrent invoice requests without race conditions | `api/tests/http/concurrency.test.ts` / `none` | [ ] | pending |
| BL-322 | SPEC-U-CROSS | Deterministic master seed script populating 1 group, 3 outlets, 1 20-room hotel, and 90 days data | `api/tests/http/seed.test.ts` / `web/tests/e2e/smoke.spec.ts` | [ ] | pending |
| BL-323 | SPEC-U-CROSS | Document default demo user logins across roles in README.md | `none` / `none` | [ ] | pending |
| BL-324 | SPEC-UI-POS | POS: Floor view renders interactive table cards with capacity, status colors, and idle timers | `api/tests/http/floor.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-325 | SPEC-UI-POS | POS: Clicking vacant table opens order sheet and displays category tabs | `api/tests/http/menu.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-326 | SPEC-UI-POS | POS: Search input filters menu items in real-time by item name or code | `api/tests/http/menu.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-327 | SPEC-UI-POS | POS: Adding item to cart creates line item with quantity 1 and base price | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-328 | SPEC-UI-POS | POS: Clicking item with modifiers opens modifier modal enforcing min/max selections | `api/tests/http/menu.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-329 | SPEC-UI-POS | POS: Increment/decrement item quantity in cart with live price recalculation | `api/tests/http/billing.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-330 | SPEC-UI-POS | POS: Course selection toggle (Hold / Fire) per item line in cart | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-331 | SPEC-UI-POS | POS: Add item special note / cooking instruction modal | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-332 | SPEC-UI-POS | POS: "Send KOT" button dispatches order to API and updates table status to occupied | `api/tests/http/kot.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-333 | SPEC-UI-POS | POS: "Print Bill" button requests invoice calculation from API and displays bill sheet | `api/tests/http/billing.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-334 | SPEC-UI-POS | POS: Service charge toggle on bill sheet updates bill total from server calculation | `api/tests/http/billing.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-335 | SPEC-UI-POS | POS: Discount modal with percentage or flat amount triggering manager PIN if >15% | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-336 | SPEC-UI-POS | POS: Item void button prompting reason and manager PIN verification | `api/tests/http/auth_approval.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-337 | SPEC-UI-POS | POS: Split Bill modal with tabs for Equal, Item, Seat, and Amount splits | `api/tests/http/split_bill.test.ts` / `web/tests/e2e/split_ui.spec.ts` | [ ] | pending |
| BL-338 | SPEC-UI-POS | POS: Settle Payment sheet with tender selection (Cash, Card, UPI QR, Room Folio) | `api/tests/http/payments.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-339 | SPEC-UI-POS | POS: Move Table modal listing vacant target tables and executing move via API | `api/tests/http/floor.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-340 | SPEC-UI-POS | POS: Merge Table modal allowing selection of occupied source tables | `api/tests/http/floor.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-341 | SPEC-UI-POS | POS: Covers count prompt on seating new guests | `api/tests/http/floor.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-342 | SPEC-UI-POS | POS: Waiter assignment dropdown on active order | `api/tests/http/floor.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-343 | SPEC-UI-POS | POS: Mobile responsive cart drawer toggle on small viewports (<640px) | `api/tests/http/orders.test.ts` / `web/tests/e2e/pos_ui.spec.ts` | [ ] | pending |
| BL-344 | SPEC-UI-KDS | KDS: Station header filter tabs (All, Tandoor, Curry, Bar, Pantry, Expediter) | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds_ui.spec.ts` | [ ] | pending |
| BL-345 | SPEC-UI-KDS | KDS: Order cards display table number, waiter, ticket age timer, and line items | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds_ui.spec.ts` | [ ] | pending |
| BL-346 | SPEC-UI-KDS | KDS: Item click marks item as prepared with strikethrough styling | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds_ui.spec.ts` | [ ] | pending |
| BL-347 | SPEC-UI-KDS | KDS: "Bump Ticket" button completes order and animates removal from active pass | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds_ui.spec.ts` | [ ] | pending |
| BL-348 | SPEC-UI-KDS | KDS: "Recall" button displays modal of recently bumped tickets with undo action | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds_ui.spec.ts` | [ ] | pending |
| BL-349 | SPEC-UI-KDS | KDS: "All-Day Summary" toggle displays consolidated item preparation count badges | `api/tests/http/kitchen.test.ts` / `web/tests/e2e/kds_ui.spec.ts` | [ ] | pending |
| BL-350 | SPEC-UI-INVENTORY | Inventory: Tab navigation for Stock Items, Recipes, Suppliers, and Purchase Orders | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-351 | SPEC-UI-INVENTORY | Inventory: Stock items table with current quantity, unit, WAC cost, and reorder status | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-352 | SPEC-UI-INVENTORY | Inventory: Add/Edit raw material item modal with validation | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-353 | SPEC-UI-INVENTORY | Inventory: Stock adjustment modal with quantity change and mandatory reason | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-354 | SPEC-UI-INVENTORY | Inventory: Recipe builder view linking menu item to raw materials with yield % | `api/tests/http/recipes.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-355 | SPEC-UI-INVENTORY | Inventory: Theoretical vs Actual usage leakage variance report table | `api/tests/http/inventory.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-356 | SPEC-UI-INVENTORY | Inventory: Purchase Order creation form selecting vendor, items, and unit prices | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-357 | SPEC-UI-INVENTORY | Inventory: Goods Receipt Note entry verifying received quantities against PO | `api/tests/http/purchasing.test.ts` / `web/tests/e2e/inventory_ui.spec.ts` | [ ] | pending |
| BL-358 | SPEC-UI-STAFF | Staff: Tab navigation for Employee Directory, Time Clock, Rosters, and Payroll | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-359 | SPEC-UI-STAFF | Staff: PIN Time Clock terminal modal for clock-in and clock-out with grace status | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-360 | SPEC-UI-STAFF | Staff: Employee directory table with role badges, outlet assignments, and active status | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-361 | SPEC-UI-STAFF | Staff: Add/Edit employee modal with role multi-select and salary fields | `api/tests/http/staff.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-362 | SPEC-UI-STAFF | Staff: Shift Cash Drawer Denomination Tally modal with over/short calculation | `api/tests/http/shifts.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-363 | SPEC-UI-STAFF | Staff: Run Payroll modal computing statutory deductions (EPF, ESI, PT, TDS) | `api/tests/http/payroll.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-364 | SPEC-UI-STAFF | Staff: View Monthly Payslip modal with itemized breakdown and print trigger | `api/tests/http/payroll.test.ts` / `web/tests/e2e/staff_ui.spec.ts` | [ ] | pending |
| BL-365 | SPEC-UI-HOTEL | Hotel: Room grid display with room number, type, guest name, and occupancy colors | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel_ui.spec.ts` | [ ] | pending |
| BL-366 | SPEC-UI-HOTEL | Hotel: Guest check-in modal capturing guest name, phone, dates, and credit limit | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel_ui.spec.ts` | [ ] | pending |
| BL-367 | SPEC-UI-HOTEL | Hotel: Guest Folio details modal displaying itemized room charges and POS postings | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel_ui.spec.ts` | [ ] | pending |
| BL-368 | SPEC-UI-HOTEL | Hotel: Room charge void reversal modal allowing authorized credit back to folio | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel_ui.spec.ts` | [ ] | pending |
| BL-369 | SPEC-UI-HOTEL | Hotel: Night Audit wizard modal executing tariff postings and day roll | `api/tests/http/hotel.test.ts` / `web/tests/e2e/hotel_ui.spec.ts` | [ ] | pending |
| BL-370 | SPEC-UI-REPORTS | Reports: Daily Flash metrics cards (Net Sales, Covers, Food Cost %, Labor %, Prime Cost) | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports_ui.spec.ts` | [ ] | pending |
| BL-371 | SPEC-UI-REPORTS | Reports: Business date range picker filtering report datasets | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports_ui.spec.ts` | [ ] | pending |
| BL-372 | SPEC-UI-REPORTS | Reports: Kasavana & Smith BCG Menu Matrix quadrant display with category filters | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports_ui.spec.ts` | [ ] | pending |
| BL-373 | SPEC-UI-REPORTS | Reports: Online Delivery Aggregators simulated order feed and payout reconciliation table | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports_ui.spec.ts` | [ ] | pending |
| BL-374 | SPEC-UI-REPORTS | Reports: Audit Log viewer showing SHA-256 verified event chain and search filters | `api/tests/http/audit.test.ts` / `web/tests/e2e/reports_ui.spec.ts` | [ ] | pending |
| BL-375 | SPEC-UI-REPORTS | Reports: CSV Export button on report tables downloading formatted CSV file | `api/tests/http/reports.test.ts` / `web/tests/e2e/reports_ui.spec.ts` | [ ] | pending |
| BL-376 | SPEC-UI-GLOBAL | Global: Command Palette (Ctrl+K) modal with keyboard search and quick navigation | `none` / `web/tests/e2e/command_palette.spec.ts` | [ ] | pending |
| BL-377 | SPEC-UI-GLOBAL | Global: Real-time backend connection status badge (Connected / Disconnected / Offline) | `api/tests/http/health.test.ts` / `web/tests/e2e/global.spec.ts` | [ ] | pending |
| BL-378 | SPEC-UI-GLOBAL | Global: Notification bell counter opening notifications drawer with live alerts | `api/tests/http/alerts.test.ts` / `web/tests/e2e/global.spec.ts` | [ ] | pending |
