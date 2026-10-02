# ServeBase: Enterprise Hospitality Operating System

**ServeBase** is an enterprise-grade point-of-sale (POS), kitchen operations, inventory lifecycle, and back-office enterprise resource planning (ERP) platform engineered for multi-outlet restaurants, bars, quick-service chains, and hotel food & beverage operations. 

Comparable in capability and scope to platforms like Petpooja, Toast, Lightspeed, and Restaurant365, ServeBase combines a high-throughput **C++17 native calculation engine**, a robust **Node.js/TypeScript Fastify API** with PostgreSQL persistence, a cryptographic **SHA-256 tamper-evident linear audit hash chain**, and a responsive **React 18 touch-optimized operator interface**.

---

## Key System Highlights

1. **Native C++17 Core Engine (`servebase_core.exe`)**
   - High-performance, stateless computational worker pool communicating via line-delimited JSON over stdio.
   - Executes mission-critical domain math: bill pricing, Hamilton/Largest-Remainder zero-penny-loss split billing, multi-station KOT routing, bill of materials recipe yield explosions, periodic cycle-count variance analysis, Indian statutory payroll computations (PF, ESI, PT, TDS), sales aggregation, shift denomination reconciliation, BCG/Kasavana & Smith menu engineering matrix, and automated par level forecasting.
   - Zero JavaScript/TypeScript numerical fallback: all core calculations run strictly through compiled native machine code.

2. **Full-Scope Enterprise Domain Capabilities**
   - **Table & Floor Management**: Dynamic multi-section table layout, visual covers and turnover tracking, table transfer, and merge operations.
   - **Menu & Pricing Engine**: Multi-station routing (Tandoor, Curry, Bar, Pantry, Expediter), course firing sequences (`Hold` vs `Fire`), and modifier pricing.
   - **Billing & Split-Tender Settlements**: Consecutive invoice numbering compliant with Indian GST Act Section 31 (`T1/YY-YY/00001`) enforced via atomic database row locks. Full support for split tenders across Cash, Credit/Debit Card, UPI QR, and Hotel PMS Guest Folios.
   - **Kitchen Display System (KDS)**: Real-time multi-station order routing, live ticket timers with color-coded SLA thresholds (<10m green, 10–15m amber, >15m red pulse), item bump, whole ticket bump, recall window, and expediter pass consolidation.
   - **Perpetual Inventory & Recipe Management**: Real-time stock movement ledger, automated Weighted Average Cost (WAC) recalculation upon goods receipt (GRN), automated ingredient depletion via recipe bill-of-materials on bill settlement, and physical cycle count variance tracking.
   - **Procurement & 3-Way Match**: Automated Purchase Orders (PO), Goods Receipt Notes (GRN), and vendor invoice reconciliation with configurable quantity and cost tolerance thresholds.
   - **Staff Attendance & Statutory Payroll**: 4-digit PIN time clock with 15-minute grace period enforcement, automated late-arrival and early-departure flags, and statutory payroll engine enforcing EPF Act 1952, ESI Act 1948, Professional Tax, and TDS income tax withholding.
   - **Double-Entry General Ledger**: Standard Chart of Accounts (Assets, Liabilities, Equity, Revenue, COGS, OPEX), automated balanced journal vouchers enforcing `Total Debits == Total Credits`, live Trial Balance, and Flash P&L reporting.
   - **Hotel PMS Integration**: Room inventory management, guest check-in/out, folio charge posting with credit limit validations, and Night Audit wizard computing Average Daily Rate (ADR) and Revenue Per Available Room (RevPAR).
   - **Channels & Loyalty**: Simulated aggregator intake (Zomato/Swiggy order webhooks and rider assignment), 4-tier customer loyalty program (Bronze, Silver, Gold, Platinum), and multi-condition promotional coupon engine.
   - **Offline Synchronization**: Deterministic client-side offline action queue with replay idempotency and conflict resolution.

3. **Compliance & Audit Integrity**
   - Strict Indian GST calculation: 5% non-ITC restaurant rate, 18% hotel restaurant rate, and composition scheme support.
   - Append-only linear SHA-256 hash-chain audit log. Every invoice, void, discount, and inventory write-off generates a cryptographic link verifying chronological ledger integrity.
   - Zero floating-point drift: all monetary values are represented and stored as 64-bit integer paise (`BIGINT`).

---

## Monorepo Architecture

```
lucid-euclid/
├── core/                       # C++17 Stateless Computational Engine
│   ├── src/                    # Source files (main.cpp, operations/*.cpp)
│   ├── include/                # Header definitions & JSON serializer
│   ├── tests/                  # Standalone C++ verification test suite
│   ├── Makefile                # MinGW / GCC native build script
│   └── bin/servebase_core.exe  # Compiled native binary (655 KB)
│
├── api/                        # Fastify + TypeScript Backend Service
│   ├── src/
│   │   ├── core/               # Native C++ child-process worker pool
│   │   ├── db/                 # PostgreSQL pool, schema.sql & seed.ts
│   │   ├── services/           # Domain business logic (12 domain services)
│   │   ├── tests/              # Vitest test suites (11 suites, 76 tests)
│   │   └── index.ts            # Fastify HTTP server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── web/                        # React 18 + Vite + Tailwind CSS Touch UI
│   ├── src/
│   │   ├── views/              # POS, KDS, Inventory, Staff, Hotel, Reports
│   │   ├── data/               # Realistic mock seed data
│   │   ├── types/              # Comprehensive TypeScript interfaces
│   │   ├── utils/              # INR currency & unit formatters
│   │   ├── App.tsx             # Root container & cross-module state sync
│   │   └── main.tsx            # DOM root mount
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── docs/                       # Architecture, Runbooks & Regulatory Guides
│   ├── ARCHITECTURE.md
│   ├── DOMAIN_GUIDE.md
│   ├── RUNBOOK.md
│   ├── TEST_REPORT.md
│   ├── DEMO_SCRIPT.md
│   ├── LIMITATIONS.md
│   └── COMPLIANCE_NOTES.md
│
└── PROGRESS.md                 # Development & Verification Tracking
```

---

## Quickstart

### Prerequisites
- **Operating System**: Windows 10/11 or Linux (Ubuntu 20.04+)
- **PostgreSQL**: Version 14+ running on `localhost:5432` with database `servebase`
- **Node.js**: Version 20+ (LTS)
- **C++ Compiler**: GCC / MinGW with C++17 support

### 1. Build Native C++ Core Engine
```bash
cd core
make clean && make
# Output generated at core/bin/servebase_core.exe
```

### 2. Configure Database & Start API Service
```bash
cd api
npm install

# Initialize PostgreSQL schema and run deterministic seed
npm run db:init
npm run db:seed

# Run complete automated verification suite (76 tests across 11 suites)
npm test

# Launch Fastify backend service (default port: 3000)
npm run dev
```

### 3. Build & Launch Web Touch Interface
```bash
cd web
npm install

# Build production bundle
npm run build

# Start local preview or development server (default port: 5173)
npm run dev
```

---

## Core Operational Modules

| Module | Primary Responsibility | Technical Foundation |
| :--- | :--- | :--- |
| **POS & Floor** | Table layout, covers, touch menu, cart, modifiers, course firing, and split billing | React 18, C++ `price_bill` & `split_bill` |
| **Kitchen KDS** | Station routing, ticket countdowns, bump item/ticket, and recall pass | Event-driven KOT router, C++ `route_kot` |
| **Inventory & Recipes** | Perpetual stock ledger, WAC calculations, recipe explosions, and 3-way match | PostgreSQL ledger, C++ `explode_recipe` & `compute_variance` |
| **Staff & Payroll** | PIN time clock with grace tracking and Indian statutory deductions | C++ `compute_payroll` (EPF, ESI, PT, TDS) |
| **Hotel PMS** | Room grid, PMS folios, charge-to-room, and Night Audit wizard | PMS folio ledger, ADR/RevPAR analytics |
| **Financials & Close** | Shift denomination tally, Z-Report day close, Flash P&L, and Trial Balance | Double-entry ledger, C++ `reconcile_shift` & `aggregate_sales` |
| **Tamper-Evident Audit** | Chronological non-repudiation of all financial and operational events | SHA-256 linear hash-chain |

---

## License & Compliance
ServeBase is built to conform to the statutory standards of the **Central Goods and Services Tax Act, 2017**, the **Employees' Provident Funds and Miscellaneous Provisions Act, 1952**, and the **Employees' State Insurance Act, 1948**. All simulated external interfaces (payment gateways, aggregators, SMS alerts, hardware printers) are clearly labeled and isolated in configuration.
