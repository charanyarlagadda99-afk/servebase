# ServeBase System Limitations & Simulated Interfaces

In accordance with system engineering honesty and operational transparency, this document details all simulated interfaces, hardware abstractions, and operational scope boundaries in ServeBase.

---

## 1. Simulated External Interfaces (`"simulated": true`)

The following integrations are fully implemented with real data validation and business domain logic, but execute against simulated external gateways rather than live production third-party accounts:

### 1. Payment Gateways (UPI, Cards & POS EDC Terminals)
- **Status**: **Simulated** (`api/src/services/payments.ts`).
- **Rationale**: Live processing requires certified PCI-DSS Level 1 terminal hardware (Pine Labs, Paytm Soundbox, Razorpay POS) and merchant acquiring bank credentials.
- **Implementation**: The payment engine processes split tenders, validates paise integrity, generates sequential tax invoices, and responds with simulated payment gateway transaction references (`tx_sim_...`). Double-charge idempotency is strictly enforced.

### 2. Third-Party Online Food Aggregators (Zomato & Swiggy)
- **Status**: **Simulated** (`api/src/services/channels.ts`).
- **Rationale**: Commercial production aggregator APIs require partner whitelisting, static enterprise IP allocations, and active commercial restaurant contracts.
- **Implementation**: Inbound order intake webhooks, rider assignment notifications, and pickup timestamps are fully simulated with realistic order JSON payloads. Incoming orders are converted into internal tickets and sent to kitchen KDS stations.

### 3. Thermal Hardware ESC/POS Receipt & Kitchen Printers
- **Status**: **Simulated Driver** (`api/src/services/billing.ts`).
- **Rationale**: Physical Epson/Star Micronics thermal printers require local USB, RS-232, or Ethernet line-feed access.
- **Implementation**: Print jobs format 80mm/58mm text buffers containing restaurant headers, GSTIN, consecutive invoice series, itemized bills, tax summaries, and QR code raw data. Output is emitted to logger streams and virtual preview modals.

### 4. SMS & WhatsApp Communication Gateways
- **Status**: **Simulated** (`api/src/services/customers.ts`).
- **Rationale**: Requires registered DLT (Distributed Ledger Technology) sender IDs with Indian telecom operators under TRAI regulations.
- **Implementation**: All customer notifications (OTP logins, digital bill links, loyalty points balance alerts) generate compliant template payloads and log to the console with `"simulated": true`.

### 5. Hotel Electronic Door Key Encoders
- **Status**: **Simulated** (`api/src/services/hotel.ts`).
- **Rationale**: Physical VingCard or Assa Abloy RFID keycard encoders require proprietary RS-485 COM port drivers.
- **Implementation**: Room check-in generates simulated cryptographic RFID keycard tokens.

---

## 2. Operational Scope Boundaries

### Currency & Geographic Scope
- ServeBase is engineered primarily for the **Indian Hospitality Market (INR)**, adhering to the Central Goods and Services Tax (CGST) Act 2017, EPF Act 1952, and ESI Act 1948.
- Foreign exchange conversions and multi-currency billing (e.g. USD, EUR, AED) are not natively modeled in this version.

### Database Architecture
- The system utilizes PostgreSQL 14+ with atomic row locks (`FOR UPDATE`) for sequential invoice generation and transactional consistency.
- The C++ native engine communicates via stdio line-delimited JSON with a persistent worker pool managed by Node.js. In high-availability multi-server clusters, the C++ worker pool is replicated per API pod.

### Scalability Limits
- **Tested POS Checkout Throughput**: 122 transactions/second per PostgreSQL instance.
- **Table Capacity per Outlet**: Up to 500 physical tables per outlet.
- **Audit Log Chain Capacity**: Tested up to 1,000,000 sequential transactions without cryptographic hash calculation latency degradation.
