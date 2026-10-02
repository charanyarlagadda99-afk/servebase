# ServeBase: Production Architecture & Deployment Specification

## 1. System Topology Overview

ServeBase is built on a multi-tier hospitality architecture designed for high-concurrency food & beverage, retail, and hotel front-office operations:

```
┌─────────────────────────────────────────────────────────────┐
│                 ServeBase Client Applications               │
│  (Desktop POS, Waiter Tablet, Kitchen KDS, Back-Office Web) │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│ Cloud / Edge Hosting (Vercel) │ │ On-Premise / Container    │
│  - SPA Static Assets          │ │  (Docker / Node / Fastify)│
│  - Instant Global CDN         │ │  - Port 3000 REST API     │
│  - Deterministic Mock Store   │ │  - Realtime WebSockets    │
└───────────────────────────────┘ └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
┌───────────────────────────────────┐                        ┌───────────────────────────────────┐
│     PostgreSQL 16 Enterprise      │                        │     High-Performance C++ Core     │
│  - Strict ACID Concurrency        │                        │  - Native Process Worker Pool     │
│  - Advisory Locks (No Gaps)       │                        │  - Fixed-Point Integer Pricing    │
│  - Append-Only SHA-256 Ledger     │                        │  - Indian Statutory Payroll Engine│
└───────────────────────────────────┘                        └───────────────────────────────────┘
```

---

## 2. Serverless (Vercel) vs Dedicated Stateful Environments

### 2.1 Why the Client Runs Standalone on Vercel
Vercel's serverless edge infrastructure is optimized for static asset distribution and short-lived request/response lambdas ($<10$s). ServeBase relies on two architectural primitives that require persistent state:
1. **Long-Running Native Worker Pool (`servebase_core.exe`)**: High-throughput POS bill calculations, fractional cent distribution (Hamilton largest-remainder method), and Indian statutory payroll calculations run on a persistent multi-worker pool communicating over stdio pipes. Serverless edge functions terminate child processes between requests.
2. **PostgreSQL Connection Pool & Advisory Locks**: Sequential gapless invoice number generation requires atomic table-level or advisory locks across active POS stations.

To enable public demonstration and edge accessibility without requiring an active PostgreSQL bridge, the React frontend features **Automatic Infrastructure Detection**:
- If `http://localhost:3000/health` responds, the application seamlessly binds to the live Fastify + PostgreSQL + C++ worker pool.
- If running in standalone cloud preview (such as on Vercel), the application gracefully falls back to deterministic client-side business logic and in-memory transactional storage, enabling full interactive auditing of all workflows (POS, KDS, Splits, Hotel PMS, Leakage Variance, BCG Matrix) with zero login walls.

---

## 3. Running Locally (Complete Full-Stack)

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- PostgreSQL 15 or 16
- C++ Compiler (GCC / MinGW / Clang / MSVC)

### Step 1: Database Initialization
Ensure PostgreSQL is running on `localhost:5432`:
```bash
# Set connection environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/servebase"

# Run schema migrations and master data seed
cd api
npm run migrate
npm run seed
```

### Step 2: C++ Core Engine Build
Compile the high-performance native calculation engine:
```bash
cd core
# On Windows:
g++ -O3 -std=c++17 -o servebase_core.exe src/main.cpp src/pricing.cpp src/payroll.cpp
# On Linux / macOS:
g++ -O3 -std=c++17 -o servebase_core src/main.cpp src/pricing.cpp src/payroll.cpp
```

### Step 3: Fastify REST API Service
```bash
cd api
npm run dev
# API listens on http://localhost:3000
# Health check: http://localhost:3000/health
```

### Step 4: Web Application
```bash
cd web
npm run dev
# Client interface available at http://localhost:5173
```

---

## 4. Container Deployment (Docker / Kubernetes / Railway / Render)

For production deployments containing both the API, C++ core engine, and PostgreSQL database, use standard container orchestration.

### Dockerfile (`api/Dockerfile`)
```dockerfile
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y build-essential postgresql-client
WORKDIR /app

# Compile C++ Core
COPY core/ ./core/
RUN cd core && g++ -O3 -std=c++17 -o servebase_core src/main.cpp src/pricing.cpp src/payroll.cpp

# Install API Dependencies & Build
COPY api/package*.json ./api/
RUN cd api && npm ci

COPY api/ ./api/
RUN cd api && npm run build

EXPOSE 3000
CMD ["node", "api/dist/server.js"]
```

---

## 5. Security & Verification Suite

Before promotion to production, run the end-to-end verification suites:

### API Integration & Concurrency Tests (Vitest)
```bash
cd api
npx vitest run --fileParallelism=false
# Verifies 69 test cases across all 11 operational blocks
```

### Automated Headless Chrome E2E Suite (Puppeteer)
```bash
cd web
node tests/e2e_browser_audit.mjs
# Audits Desktop, Tablet, and Mobile Phone viewports across all 7 operational flows
```

---

## 6. Public Cloud Deployment URL
- **Production Client Web App**: `https://web-rho-nine-toizqjrice.vercel.app`
- **SSO Protection**: Disabled (`ssoProtection: false`) for unhindered public and auditor access.
