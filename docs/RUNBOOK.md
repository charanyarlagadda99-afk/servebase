# ServeBase Operations & Engineering Runbook

This runbook covers system setup, configuration, standard operational workflows, disaster recovery procedures, and day-close protocols.

---

## 1. System Requirements & Environment

### Hardware Requirements
- **Server / POS Terminal**: x86-64 CPU (minimum 2 cores, 4 recommended), 4 GB RAM (8 GB recommended for combined DB + API + Core), 20 GB SSD storage.
- **Operating Systems**: Windows 10/11 Pro/Enterprise, Ubuntu 22.04 LTS, or Debian 12.

### Software Prerequisites
- **PostgreSQL**: Version 14, 15, or 16 running on port 5432.
- **Node.js**: Version 20.x or 22.x LTS.
- **C++ Compiler**: GCC (g++) with C++17 support (MinGW-w64 on Windows, `build-essential` on Linux).

---

## 2. Environment Configuration

Create or verify `api/.env`:

```ini
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/servebase
JWT_SECRET=super-secret-servebase-enterprise-key-2026
CORE_ENGINE_PATH=../core/bin/servebase_core.exe
C_POOL_SIZE=4
OFFLINE_SYNC_ENABLED=true
```

---

## 3. Step-by-Step Installation & Build

### Step 1: Compile Native C++ Core Engine
```powershell
# Navigate to the core engine directory
cd core

# Compile binary using MinGW or GCC
make clean
make

# Verify the compiled binary exists
ls bin/servebase_core.exe
```

### Step 2: Initialize Database & Seed Operational Data
```powershell
# Navigate to the API service directory
cd ../api
npm install

# Apply database schema
npm run db:init

# Generate 90-day deterministic seed dataset
npm run db:seed
```

### Step 3: Run Automated Verification Suite
```powershell
# Run all 11 test suites (76 tests) with serial DB execution
npx vitest run --fileParallelism=false
```

### Step 4: Build and Launch Web Interface
```powershell
# Navigate to web frontend directory
cd ../web
npm install

# Compile production bundle
npm run build

# Start Vite preview or development server
npm run dev
```

---

## 4. Standard Operational Procedures (SOP)

### SOP-01: Shift Opening & Cash Float Registration
1. Cashier enters 4-digit PIN on the terminal.
2. System prompts for physical opening cash float verification (default: ₹5,000.00).
3. Cashier counts physical currency in the drawer and confirms denominations.
4. System posts an opening audit record and transitions terminal status to `ACTIVE`.

### SOP-02: POS Table Order & Kitchen Firing
1. Select table on floor plan (`T-01` through `PDR-2`).
2. Add menu items to order cart. Select course assignment (`beverage`, `starter`, `main`, `dessert`).
3. Set course firing status:
   - `FIRE`: Items appear on kitchen KDS screens immediately.
   - `HOLD`: Items remain on ticket as pending until captain triggers `FIRE`.
4. Click **Send KOT**. The system invokes C++ `route_kot`, partitions items by preparation station (Tandoor, Curry, Bar, Pantry), creates sequential KOTs, and emits SSE events to kitchen screens.

### SOP-03: KDS Station Workflow & Bump
1. Kitchen display shows incoming KOTs ordered chronologically.
2. Timers indicate preparation duration:
   - Green: $< 10$ minutes
   - Amber: $10 - 15$ minutes
   - Red (Flashing): $> 15$ minutes (SLA breach alert)
3. Station chef taps item to toggle from `pending` $\rightarrow$ `preparing` $\rightarrow$ `ready`.
4. When all station items are ready, tap **Bump KOT** to clear from the queue.
5. If an item was bumped accidentally, click **Recall (Recent)** to restore the ticket.

### SOP-04: Split Billing & Settlement
1. On table checkout, click **Split Bill** if guests request separate checks.
2. Select number of ways (e.g. 2, 3, 4) or split by individual seat items.
3. System applies C++ `split_bill` (Largest-Remainder algorithm) ensuring zero penny loss.
4. Select tender type per split: UPI QR, Credit/Debit Card, Cash, or Hotel Room Folio.
5. Once fully settled, the table status automatically returns to `VACANT`.

### SOP-05: End-of-Day Close (Z-Report)
The Z-Report permanently locks the business day, posts daily general ledger journals, and advances the operating calendar:
1. Verify pre-conditions:
   - All floor tables must be in `VACANT` state.
   - All KOTs must be bumped and cleared.
   - All shifts must have denomination reconciliations submitted.
2. From the **Financials & Close** tab, review gross sales, net sales, taxes collected, and tender tallies.
3. Click **Execute Day Close & Print Z-Report**.
4. System executes:
   - Locks all shift registers for the day.
   - Posts balanced sales, COGS, and tax journal vouchers to General Ledger.
   - Advances system `business_date` by $+1$ day.
   - Generates sequential, sealed Z-Report document with tamper-evident audit signature.

### SOP-06: Hotel PMS Night Audit
1. Open **Hotel PMS** view.
2. Click **Run Night Audit**.
3. Wizard verifies room occupancy and posts daily room tariff charges + 12% hotel GST to all active in-house guest folios.
4. Computes daily hospitality metrics:
   - **Occupancy %** $= (\text{Occupied Rooms} / \text{Total Rooms}) \times 100$
   - **Average Daily Rate (ADR)** $= \text{Room Revenue} / \text{Rooms Sold}$
   - **RevPAR** $= \text{Room Revenue} / \text{Total Available Rooms}$
5. Locks hotel folio session for the business date.

---

## 5. Troubleshooting & Disaster Recovery

### Issue 1: C++ Worker Pool Crash or Non-Responsive Engine
- **Symptom**: API returns `500 Native Engine Worker Error` on pricing or recipe calls.
- **Root Cause**: Memory fault or termination of child process `servebase_core.exe`.
- **Resolution**:
  1. The worker pool (`api/src/core/pool.ts`) automatically respawns dead workers up to the configured pool capacity.
  2. To verify binary integrity manually:
     ```powershell
     cd core
     echo {"op":"price_bill","payload":{"items":[{"quantity":1,"unit_price":10000,"tax_rate_percent":5}]}} | ./bin/servebase_core.exe
     ```
  3. If compilation is damaged, rebuild: `cd core && make clean && make`.

### Issue 2: Audit Hash-Chain Integrity Failure
- **Symptom**: System raises alert `CRITICAL_SECURITY_AUDIT_MISMATCH`.
- **Diagnostic Command**:
  ```powershell
  cd api
  npx ts-node -e "import { verifyAuditChain } from './src/services/audit'; verifyAuditChain().then(console.log);"
  ```
- **Resolution**:
  - The output will identify the exact sequence number where `prev_hash != calculated_hash`. Inspect the database row for unauthorized out-of-band updates (`UPDATE audit_log`).

### Issue 3: Database Backup & Point-in-Time Restore
- **Daily Backup Command**:
  ```powershell
  pg_dump -U postgres -d servebase -F c -b -v -f "servebase_backup_$(date +%Y%m%d).dump"
  ```
- **Restore Command**:
  ```powershell
  pg_restore -U postgres -d servebase -v -c "servebase_backup_20261002.dump"
  ```
