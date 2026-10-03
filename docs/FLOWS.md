# ServeBase Domain Event Connection Matrix

Every business event and the effects it must cause. Effects marked **TX** run in the same database transaction. Effects marked **ASYNC** run via transactional outbox.

## Order Lifecycle

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **OrderOpened** | Table status → `occupied` (covers, server, timer) | DB | TX | W1.02 |
| | Floor screens update within 1s | SSE | ASYNC | W17 |
| **KOTSent** | KOT tickets created per station | DB | TX | W1.04 |
| | Order items status → `sent` | DB | TX | W1.04 |
| | Kitchen screens update within 1s | SSE | ASYNC | W17 |
| | Table shows "KOT sent" | DB | TX | W1 |
| | Prep timers start on KDS | UI | ASYNC | W17 |
| **ItemReady** | Captain notified (SSE) | SSE | ASYNC | W17 |
| **ItemVoided** | KOT ticket updated | DB | TX | W2 |
| | Manager approval verified + audit entry | DB | TX | W2 |
| | Wastage entry if item was already prepared | DB | TX | W2 |
| | Stock returned if wastage not flagged | DB | TX | W2 |
| **BillFinalized** | Invoice number allocated (consecutive, gapless) | DB | TX | W1.08 |
| | Tax calculated per outlet mode (C++ core) | Core | TX | W1.07 |
| | Table status → `bill_printed` | DB | TX | W1 |
| | Order locked from edits | DB | TX | W1 |
| **PaymentCaptured** | Shift expected cash updated (if cash) | DB | TX | W6 |
| | Customer loyalty points earned | DB | TX | W12 |
| | Folio posted if charge-to-room | DB | TX | W10 |
| | Payment refunds tracked | DB | TX | W3 |
| **OrderClosed** | Table status → `cleaning` then `vacant` | DB | TX | W1.11 |
| | Stock deducted by recipe (with ledger movement) | DB | TX | W1.12 |
| | Journal entries posted (sales, tax, tender, COGS) | DB | TX | W1.13 |
| | Flash report / day totals refreshed | DB | ASYNC | W1.16 |
| | Audit trail entries | DB | TX | W1.17 |

## Day Operations

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **ShiftOpened** | Cash float recorded | DB | TX | W6 |
| **ShiftClosed** | Denomination count, expected vs actual, over/short | Core+DB | TX | W6 |
| **DayClosed** | Z-report generated = sum of invoices | DB | TX | W7 |
| | Business date locked | DB | TX | W7 |
| | Late edits rejected | DB | TX | W7 |
| | Repeat is idempotent | DB | TX | W7 |

## Inventory & Purchasing

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **GoodsReceived** | Stock increased, WAC recalculated | DB | TX | W8 |
| | Three-way match (PO vs GRN vs vendor bill) | DB | TX | W8 |
| | Accounts payable updated | DB | TX | W8 |
| **StockCounted** | Variance calculated (C++ core) | Core+DB | TX | W8 |
| | Approval required if variance exceeds threshold | DB | TX | W8 |

## People

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **ClockIn** | Attendance logged, late flag if after scheduled | DB | TX | W9 |
| **ClockOut** | Hours calculated, OT if applicable | DB | TX | W9 |
| **PayrollRun** | Payslips generated via C++ core | Core+DB | TX | W9 |
| | Salary journal entries posted | DB | TX | W9 |

## Hotel PMS

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **CheckIn** | Room status → `occupied`, folio created | DB | TX | W10 |
| **RoomCharge** | Folio charge line added, credit limit checked | DB | TX | W10 |
| **POSVoid** | Folio charge line reversed | DB | TX | W10 |
| **NightAudit** | Room charges posted, date rolled | DB | TX | W10 |
| **CheckOut** | Folio settled, room → `vacant` | DB | TX | W10 |

## Aggregators

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **AggregatorOrder** | Auto-creates KOT, accept timer | DB | TX | W11 |
| **PayoutReconciliation** | Flags payout differences | DB | TX | W11 |

## Cross-cutting

| Event | Effect | Layer | TX/ASYNC | Scenario |
|-------|--------|-------|----------|----------|
| **AnyMutation** | SHA-256 hash-chain audit entry | DB | TX | W1.17 |
| **OfflineSync** | Idempotent replay, per-terminal series | DB | TX | W13 |
