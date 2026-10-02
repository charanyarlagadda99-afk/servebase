# ServeBase Architecture Specification

This document details the architectural principles, component interactions, database schema, native execution pool, and security/audit models governing ServeBase.

---

## 1. Architectural Principles

1. **Integer Money Representation (Zero Floating-Point Drift)**
   Every monetary figure across the entire stack (database, C++ engine, API services, and frontend state) is represented in **integer paise** (1 INR = 100 paise) using SQL `BIGINT`, C++ `int64_t`, and TypeScript `number`. Fractional paise never enter the persistence layer. Any rounding is performed explicitly at the final calculation boundary using Banker's Rounding or the Largest-Remainder Method.

2. **Native C++17 Computational Isolation**
   All complex mathematical, allocation, and algorithmic tasks are executed within a compiled native C++17 binary (`servebase_core.exe`). The Node.js Fastify API maintains a persistent pool of worker processes communicating via line-delimited JSON over stdio. **There are no TypeScript calculation fallbacks**; if the native binary fails or is unavailable, requests fail fast with explicit errors.

3. **Cryptographic Audit Non-Repudiation**
   Every state-altering event (order creation, void, bill generation, discount application, inventory movement, shift close, folio posting) generates an immutable record in the `audit_log` table. Each entry includes an incremental sequence number, the previous record's SHA-256 hash, and a cryptographic SHA-256 signature of the current payload:
   $$\text{Hash}_n = \text{SHA256}(\text{seq}_n \mathbin{\Vert} \text{Hash}_{n-1} \mathbin{\Vert} \text{timestamp} \mathbin{\Vert} \text{action} \mathbin{\Vert} \text{entity\_id} \mathbin{\Vert} \text{payload})$$
   Any manual modification or deletion in the database breaks the chain and is immediately detectable by the verification scanner.

4. **Optimistic Concurrency Control & Soft Deletion**
   Entities subject to concurrent modification (tables, orders, inventory stock, shifts) include a `version INT DEFAULT 1` column. Writes enforce `WHERE id = $1 AND version = $2`, incrementing the version atomically. Destructive operations set `deleted_at = NOW()` to preserve complete operational history for tax and inventory audits.

5. **Atomic Transaction Reusability**
   To eliminate connection deadlocks during multi-step domain workflows (e.g. bill payment triggering inventory depletion, room folio charging, general ledger journal posting, and audit logging), all repository and service functions accept an optional `existingClient?: pg.PoolClient`. If supplied, the operation participates in the ongoing transaction; if omitted, it acquires and releases a dedicated client cleanly.

---

## 2. System Architecture Diagram

```
+-----------------------------------------------------------------------+
|                             USER TIER                                 |
|   +-----------------------+   +-------------------+   +-----------+   |
|   | POS & Floor Terminal  |   | Kitchen KDS Pass  |   | Hotel PMS |   |
|   +-----------------------+   +-------------------+   +-----------+   |
+-----------------------------------|-----------------------------------+
                                    | HTTPS / SSE (EventStream)
+-----------------------------------v-----------------------------------+
|                        API TIER (Node.js / Fastify)                   |
|                                                                       |
|   +-------------------+   +--------------------+   +--------------+   |
|   | Orders & Tables   |   | Billing & Payments |   | Inventory    |   |
|   +-------------------+   +--------------------+   +--------------+   |
|   | KDS Routing       |   | Staff & Payroll    |   | General Ldg  |   |
|   +-------------------+   +--------------------+   +--------------+   |
|                               |                                       |
|                Worker Pool    | Line-delimited JSON                   |
|                (4 Processes)  | over stdio                            |
|                               v                                       |
|               +-------------------------------+                       |
|               | C++17 Core Engine             |                       |
|               | (servebase_core.exe)          |                       |
|               |                               |                       |
|               | - price_bill                  |                       |
|               | - split_bill (Hamilton)       |                       |
|               | - route_kot                   |                       |
|               | - explode_recipe (BOM)        |                       |
|               | - compute_variance            |                       |
|               | - compute_payroll (EPF/ESI)   |                       |
|               | - aggregate_sales             |                       |
|               | - reconcile_shift             |                       |
|               | - menu_engineering (BCG)      |                       |
|               | - forecast_par                |                       |
|               +-------------------------------+                       |
|                                                                       |
+-----------------------------------|-----------------------------------+
                                    | PostgreSQL Pool (pg)
+-----------------------------------v-----------------------------------+
|                         DATA PERSISTENCE TIER                         |
|                                                                       |
|   +-------------------+   +--------------------+   +--------------+   |
|   | Tables & Menus    |   | Orders & Bills     |   | Stock Ledger |   |
|   +-------------------+   +--------------------+   +--------------+   |
|   | General Ledger    |   | Hotel PMS Folios   |   | Staff & Pay  |   |
|   +-------------------+   +--------------------+   +--------------+   |
|   | SHA-256 Linear Audit Log (Tamper-Evident Hash Chain)          |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------------------------------------------+
```

---

## 3. C++17 Core Engine Operations

The native executable `core/bin/servebase_core.exe` acts as a high-throughput stateless computational co-processor. Requests are formatted as JSON lines containing an `op` selector, an operational `payload`, and an optional `request_id`:

```json
{"op": "price_bill", "request_id": "req-981", "payload": { ... }}
```

The response is returned on stdout as a matching single-line JSON:

```json
{"status": "ok", "request_id": "req-981", "result": { ... }}
```

### Detailed Operation Specifications:

1. **`price_bill`**
   - **Input**: List of items (quantity, unit price, tax rate), applied order-level discounts (percentage or flat), service charge percentage, and packaging charges.
   - **Logic**: Calculates item net totals, sums taxes by rate category (CGST, SGST, IGST), applies proportional discounts, calculates service charges, and applies banker's rounding to return final net and gross amounts in paise.

2. **`split_bill`**
   - **Input**: Grand total in paise, number of splits, or custom percentage allocations.
   - **Logic**: Implements the **Hamilton / Largest-Remainder Method**. Prevents rounding loss (e.g. dividing ₹100.00 across 3 people produces 33.33, 33.33, and 33.34) by calculating base quotients and distributing remainder paise in descending order of fractional remainders. Guarantees: $\sum \text{Split Amounts} \equiv \text{Original Total}$.

3. **`route_kot`**
   - **Input**: List of ordered items with item codes, names, courses, modifiers, and preparation stations.
   - **Logic**: Filters out already fired items, partitions items by target station (`tandoor`, `curry`, `bar`, `pantry`, `dessert`), formats sequential station-specific KOT payloads with course fire/hold markers.

4. **`explode_recipe`**
   - **Input**: Array of sold menu items and the full Bill of Materials (BOM) recipe graph.
   - **Logic**: Decomposes sold items into raw material ingredient consumptions, factoring in recipe portion sizes, batch yield percentages, and prep wastage factors.

5. **`compute_variance`**
   - **Input**: Opening stock, purchases received, theoretical sales consumption (from BOM), and physical counted stock.
   - **Logic**: Evaluates:
     $$\text{Variance Qty} = \text{Closing Count} - (\text{Opening} + \text{Purchases} - \text{Theoretical})$$
     Multiplies by the ingredient's Weighted Average Cost to yield the exact monetary shrinkage or overage.

6. **`compute_payroll`**
   - **Input**: Employee monthly gross salary, working days, days present, statutory parameters.
   - **Logic**:
     - Computes Basic pay ($50\%$ of Gross).
     - Calculates Employee Provident Fund (EPF): $12\%$ of Basic, capped at the statutory wage ceiling of ₹15,000/month ($\max \text{PF} = \text{₹}1,800$).
     - Calculates Employee State Insurance (ESI): $0.75\%$ of Gross (applicable only if Gross $\le \text{₹}21,000/\text{month}$).
     - Professional Tax (PT): State slab deduction (flat ₹200).
     - Tax Deducted at Source (TDS): Slab-based withholding.
     - Net Payable $= \text{Gross} - (\text{PF} + \text{ESI} + \text{PT} + \text{TDS})$.

7. **`aggregate_sales`**
   - **Input**: Array of closed bills with timestamps, tenders, and items.
   - **Logic**: Aggregates gross/net revenue by hour, category, station, and payment tender (Cash, Card, UPI, Room). Computes average spend per cover (SPH) and table turnover rate.

8. **`reconcile_shift`**
   - **Input**: System recorded cash sales, payouts, starting float, and physical currency denomination breakdown (₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1).
   - **Logic**: Computes total physical cash tallied, compares with expected book cash balance, flags overage/shortage, and evaluates if discrepancy exceeds cashier tolerance threshold.

9. **`menu_engineering`**
   - **Input**: Item sales volume, menu mix percentage, food cost, selling price.
   - **Logic**: Computes average margin and average sales volume across the category. Categorizes items into the Boston Consulting Group (BCG) / Kasavana & Smith 4-quadrant matrix:
     - **Stars**: High Margin, High Volume (Promote & protect quality).
     - **Plowhorses**: Low Margin, High Volume (Re-engineer recipes or adjust price).
     - **Puzzles**: High Margin, Low Volume (Reposition, promote, rename).
     - **Dogs**: Low Margin, Low Volume (Consider removal from menu).

10. **`forecast_par`**
    - **Input**: Historical daily sales consumption, supplier lead time (in days), safety stock buffer factor.
    - **Logic**: Computes exponentially weighted moving average (EWMA) consumption, applies lead-time demand multipliers, and outputs optimal Par Levels and Reorder Quantities.

---

## 4. Database Schema Design

The schema is defined in `api/src/db/schema.sql` and enforces strict relational integrity:

### Core Domain Tables
- **`organizations` & `outlets`**: Multi-tenant operational hierarchy with timezone, GSTIN, and currency configuration.
- **`tables`**: Physical floor tables with capacity, current active order reference, and state enum (`vacant`, `occupied`, `billed`, `reserved`, `cleaning`).
- **`menu_items` & `menu_item_modifiers`**: Menu catalog with HSN/SAC codes, base prices in paise, tax rates, and assigned prep stations.
- **`recipes` & `recipe_ingredients`**: Bill of Materials linking menu items to inventory ingredients with gross/net usage and yield loss percentages.
- **`orders` & `order_items`**: Dine-in, takeaway, and room service orders with item-level course tags (`starter`, `main`, `dessert`, `beverage`), status (`hold`, `fire`, `ready`, `served`), and special instructions.
- **`kots` & `kot_items`**: Kitchen Order Tickets generated sequentially per station with bump timestamps and prep durations.
- **`bills` & `payments`**: Consecutive tax invoices (`T1/YY-YY/00001`) with CGST/SGST/IGST breakdown, discounts, service charges, and split-tender payment records.
- **`inventory_items` & `stock_ledger`**: Raw ingredients, perpetual stock ledger tracking every transaction type (`purchase`, `sales_depletion`, `variance`, `waste`, `transfer`), and unit costs.
- **`purchase_orders`, `goods_received_notes` & `grn_items`**: Procurement cycle with 3-way match audit validation.
- **`staff`, `attendance` & `payroll_runs`**: Employee records, biometric/PIN time punch logs, and monthly statutory payroll registers.
- **`chart_of_accounts`, `journal_entries` & `journal_lines`**: Double-entry general ledger with balanced debits and credits for all revenue, COGS, and payroll events.
- **`hotel_rooms`, `hotel_folios` & `hotel_folio_charges`**: Room inventory, guest accounts, credit limits, and Night Audit charge tracking.
- **`audit_log`**: Tamper-evident append-only SHA-256 linear hash-chain.

---

## 5. Security & Authentication Architecture

- **Session Security**: Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256, carrying user role, outlet access scope, and permissions.
- **PIN Verification**: Waiters and cashiers authenticate using a 4-digit numeric PIN hashed with bcrypt. 5 consecutive incorrect attempts lock the terminal session, requiring manager unlock.
- **Manager Override**: Critical operations (bill voids, item cancellation post-KOT firing, complimentary discounts $>15\%$, credit limit overrides) require a high-privilege manager credentials verification and log an explicit security event in the audit chain.
- **Database Row-Level Isolation**: Multi-outlet operations partition queries by `outlet_id`, preventing data leakage across independent restaurant branches.
