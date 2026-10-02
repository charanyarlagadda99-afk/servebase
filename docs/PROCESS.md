# ServeBase Execution Process and Honesty Rules

## PROCESS (autonomous; no approval gates; no questions between items)
- **Step 0**. Check git, node (LTS), g++ (C++17), PostgreSQL 15+, Playwright browsers. If missing, give exact short install steps for OS, then continue.
- **Step 1**. Save the SPEC to `docs/SPEC.md`. Save this PROCESS and these HONESTY RULES to `docs/PROCESS.md`.
- **Step 2**. Create `docs/BACKLOG.md`: break the defects D1-D11 and every SPEC section into atomic items (one behavior each), target 300+. For each: ID, section, description, acceptance tests (HTTP test name + browser test name), status `[ ]`/`[x]`, evidence path. Order by dependency (D1-D3 first, then D4-D8, then remaining domain screens and features).
- **Step 3**. Audit honestly: an item is `[x]` only if reachable through the HTTP API AND used by the UI AND proven by tests you run now. Existing service code that is not exposed counts as NOT done, but reuse it. Print the real starting count.
- **Step 4**. Loop until complete: take the next unchecked item; implement across every layer (migration, core, service, route, UI); write HTTP and browser tests; run them; fix until pass; run the full suite for regressions; tick the item with evidence; git commit "BL-###: ..."; update `docs/PROGRESS.md` with done/total and "NEXT: BL-###"; repeat immediately.
- **Step 5**. Stop only when every item passes, when a manual action from user is required (say exactly what), or when the session ends. Always commit and update `PROGRESS.md` before stopping.

Provide one command, `npm run verify`, that builds core, runs core tests, migrates and seeds the database, runs API HTTP tests, builds the web app, and runs the browser tests.

---

## HONESTY RULES
- Never write "done" or "complete" unless every backlog item is `[x]` with passing tests. Always report done/total.
- Done means: stored in the database, permissions enforced in the API, UI wired, loading/empty/error states handled, sensitive actions audited, tested through HTTP and the browser.
- No mock data in real code paths. Demo data only via the seed script.
- Simulated integrations (payments, SMS, aggregators, printers, hotel interface) are labelled "simulated".
- Split big items; never skip or delete items to look finished.
- No course, syllabus, "module", or student-project wording anywhere.
- Keep code beginner-readable: small functions, clear names, comments explaining WHY. Reuse working code; do not rewrite for taste.
