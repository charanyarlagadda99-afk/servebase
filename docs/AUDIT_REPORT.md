# ServeBase Comprehensive End-to-End System Audit & Gap Report

This audit was conducted by senior QA engineering and full-stack development, reviewing every screen, operational flow, permission boundary, and data integrity invariant across ServeBase.

---

## 1. Summary Bug Counts by Severity

| Severity Level | Definition | Discovered | Resolved / Fixed | Outstanding |
| :--- | :--- | :---: | :---: | :---: |
| **P0 (Critical)** | Blocks a core operational flow or exposes security bypass | 3 | 3 | 0 |
| **P1 (High)** | Data inconsistency, regulatory mismatch, or missing checklist domain capability | 8 | 8 | 0 |
| **P2 (Medium)** | Operational friction, responsive layout issue, or missing shortcut | 4 | 4 | 0 |
| **P3 (Low)** | Visual polish, export triggers, or state feedback improvements | 2 | 2 | 0 |
| **Total** | **All Severity Categories** | **17** | **17** | **0** |

---

## 2. Detailed Audit Log Table

| ID | Screen / Component | Role | Steps to Reproduce | Expected Behavior | Actual Behavior | Severity | Fix Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **AUD-01** | Global Deployment | Public / Agent | Access `https://web-rho-nine-toizqjrice.vercel.app` from external network | Page renders public touch interface | Redirects to Vercel SSO login wall (`ssoProtection: true`) | **P0** | **FIXED** (SSO disabled via CLI) |
| **AUD-02** | POS Cart (`PosView`) | Cashier / Server | Add items to cart; attempt to remove an item before or after KOT | Ability to remove/void item with audit logging | Trash icon imported but no delete/void button rendered | **P0** | **FIXED** (Item void & remove controls added) |
| **AUD-03** | POS Order Actions | Cashier / Server | Apply discount $>15\%$ or void fired KOT item | Prompt for Manager 4-digit PIN override | Action executed without authentication or blocked silently | **P0** | **FIXED** (Manager Override Modal implemented) |
| **AUD-04** | POS Billing | Cashier | Check bill calculation options | Service charge toggle default OFF, never taxed; GST 5% on food only | No service charge toggle; discount input missing | **P1** | **FIXED** (Service charge toggle & discount modal added) |
| **AUD-05** | POS Split Bill | Cashier | Click "Split Bill" modal | Support splitting by Item, Seat, Equal, or Custom Amount | Only supported equal 2/3/4/5-way splits | **P1** | **FIXED** (4 split modes added: Equal, Item, Seat, Amount) |
| **AUD-06** | Table Management | Manager / Host | Inspect active tables during rush | Visual table lock state and idle timer tracking | No idle timers or table lock indicators | **P1** | **FIXED** (Table locks & idle timers displayed) |
| **AUD-07** | Shift Reconciliation | Cashier | Close cash drawer at end of shift | Enter physical denomination count (₹2000 to ₹10/coins) vs book cash | Only binary clock-out without denomination tally | **P1** | **FIXED** (Currency denomination tally modal added) |
| **AUD-08** | Reports & Analytics | Controller / GM | Open Reports dashboard | Visual BCG Menu Engineering matrix (Stars, Plowhorses, Puzzles, Dogs) | C++ operation existed in backend but had no UI visualization | **P1** | **FIXED** (Interactive BCG Matrix added) |
| **AUD-09** | Channels & Aggregators | Dispatcher / GM | Review Swiggy/Zomato orders | View simulated aggregator orders, rider tracking & payout reconciliation | No aggregator order stream or payout reconciliation screen | **P1** | **FIXED** (Aggregator order intake & payout view added) |
| **AUD-10** | Inventory & Stock | Store Manager | View usage discrepancies | Reconcile theoretical recipe consumption vs physical stock count | Static 3-way match without dynamic shrinkage/leakage report | **P1** | **FIXED** (Leakage & recipe variance dashboard added) |
| **AUD-11** | Hotel PMS Folios | Front Desk | Open occupied room with posted charges | Ability to void or reverse an incorrect room charge | No charge reversal button or folio void audit entry | **P1** | **FIXED** (Charge reversal workflow implemented) |
| **AUD-12** | Global Navigation | All Staff | Press `Ctrl+K` or keyboard shortcuts | Open Command Palette for fast navigation and search | No keyboard listener or command palette available | **P2** | **FIXED** (Command Palette with hotkeys implemented) |
| **AUD-13** | Web Client Data Layer | All Roles | Run web app locally with API running | Client queries `http://localhost:3000` with graceful offline fallback | Client used static in-memory seed exclusively | **P2** | **FIXED** (API client with live sync & offline fallback added) |
| **AUD-14** | Mobile Viewports | Floor Server | Access POS on mobile screen (< 768px) | Menu and cart collapse into tabbed or drawer views | Cart and menu overlapped horizontally | **P2** | **FIXED** (Responsive mobile drawer & tabbed layout added) |
| **AUD-15** | Inventory & Cash Forms | Store / Cashier | Submit empty or negative quantities | Input validation with helpful error toast | Accepted negative/zero values without feedback | **P2** | **FIXED** (Strict validation on all input fields) |
| **AUD-16** | Financial Reports | Accountant | Open Flash P&L or Z-Report | Export data to CSV or Print formatted PDF view | No export or print trigger on reports | **P3** | **FIXED** (CSV export & Print preview triggers added) |
| **AUD-17** | Architecture Alignment | DevOps / Infra | Compare Vercel serverless vs Local Full-Stack | Document why persistent C++ engine & Postgres need container host | Unclear separation between static SPA and backend daemons | **P3** | **FIXED** (Deployment notes documented in `DEPLOYMENT_NOTE.md`) |

---

## 3. Serverless (Vercel) vs Dedicated Full-Stack Architecture Comparison

| Capability | Local / Dedicated Container (Docker, VM, VPS) | Vercel Edge Serverless Deployment |
| :--- | :--- | :--- |
| **Web Touch Interface** | Fully Supported | Fully Supported (`https://web-rho-nine-toizqjrice.vercel.app`) |
| **C++17 Engine (`servebase_core.exe`)** | Fully Supported (Persistent process pool over stdio IPC) | **Cannot Run**: Serverless functions cannot keep long-running child process pools open. |
| **PostgreSQL Database** | Fully Supported (`localhost:5432` with row locks) | Requires external cloud PostgreSQL (Supabase, Neon, AWS RDS). |
| **Realtime SSE Pub-Sub** | Fully Supported (`keep-alive` HTTP connections) | Limited by serverless execution timeouts (10s–60s). |
| **Tamper-Evident SHA-256 Audit Log** | Fully Supported (Append-only linear DB chain) | Client-side mock mode on Vercel; live DB on full-stack. |
| **Offline Action Queue & Sync** | Fully Supported (Replays to Fastify `/api/sync`) | Fully Supported (IndexedDB/LocalStore buffering). |
