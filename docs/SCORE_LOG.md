# ServeBase Score Log

Measured strictly by `npm run score` across real stack (C++ Core + Fastify API + PostgreSQL + Playwright browser).
No mocks, append-only scenarios.

| Iteration | Date & Time | Score | Passed / Total | What Changed |
|-----------|-------------|-------|----------------|--------------|
| Baseline  | 2026-10-03 10:28 IST | **63%** | **33 / 52** | Established independent eval harness (W1-W18), fresh PostgreSQL `servebase_eval` db, fixed schema dependency order, verified bcrypt PIN auth. |
