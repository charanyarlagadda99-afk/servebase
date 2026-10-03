# ServeBase Progress — Measured from Score

> This file reflects the REAL state as measured by `npm run score`.
> It is NOT manually authored claims. Updated after each score run.

## Current Score

| Date | Score | Passed | Total | Notes |
|------|-------|--------|-------|-------|
| 2026-10-02 | TBD | 0 | 0 | Eval harness being built |

## Gate Status

| Gate | Status | Details |
|------|--------|---------|
| G1 No-fake | ❌ FAIL | `getSimulatedFallback` exists in web/src/api/client.ts (~360 lines of hardcoded fake data) |
| G2 Connectivity | ❌ FAIL | docs/FLOWS.md created but effects not implemented (stock deduction, journal entries, shift cash) |
| G3 Visual | ❌ FAIL | Not yet run |
| G4 Parity | ❌ FAIL | docs/PARITY.md not yet created |
| G5 Stability | ❌ FAIL | No passing runs yet |

## Honest Assessment of BACKLOG.md

- Total items: 378
- Ticked [x]: 3 (0.8%) — all in D1 (C++ core portability)
- The previous PROGRESS.md claimed 100% completion of D1-D11. This was false.

## What Actually Works (verified by tests)

- ✅ C++ core engine: 10 operations pass all invariant tests
- ✅ Database schema: 67 tables created via migration
- ✅ Auth: PIN login and password login with bcrypt
- ✅ Orders: create, add items, send KOT (real SQL transactions)
- ✅ Billing: finalize bill via C++ price_bill, sequential invoice numbers
- ✅ Payments: record payment, idempotency, charge-to-room
- ✅ KDS: queue, bump, recall
- ✅ Hotel: rooms, folios, charges, checkout
- ✅ Staff: employees, clock in/out
- ✅ Audit: SHA-256 hash-chain log

## What Does NOT Work (critical connectivity gaps)

- ❌ Stock deduction on sale: payment does not deduct inventory via recipes
- ❌ Journal entries on payment: no double-entry accounting on order close
- ❌ Shift cash tracking: cash payments don't update shift expected cash
- ❌ Customer loyalty: payments don't earn loyalty points
- ❌ Flash report: not updated from real transaction data
- ❌ Web app serves fake data: `getSimulatedFallback` provides all data on public domains
- ❌ Business math in browser: billing/split calculations duplicated in client.ts
- ❌ Demo logins: any 4-digit PIN accepted with fake user data
