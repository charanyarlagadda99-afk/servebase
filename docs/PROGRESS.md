# ServeBase Engineering Progress & Verification Tracker

## Current Status
- **Total Backlog Items**: 378
- **Completed Items**: 3 / 378 (0.8%)
- **Pending Items**: 375
- **NEXT**: BL-004

---

## Defects Status Summary (D1 - D11)
- [x] **D1 (Core Engine)**: Linux g++ portability fixed (`std::max<int64_t>(0, ...)`), portable `core/Makefile` and root `Makefile` added, all 10 C++ ops verified.
- [ ] **D2 (REST Surface)**: Versioned `/api/v1` routes over all domain services, OpenAPI documentation.
- [ ] **D3 (API Security & RBAC)**: JWT auth, PIN login, role matrix guard, tenant scoping, Zod validation, rate limiting.
- [ ] **D4 (Web Data Wiring)**: Complete removal of mock data, typed API client, real login view, offline banner, persistence.
- [ ] **D5 (Server-Side Math)**: POS calculation delegated strictly to API + C++ core engine.
- [ ] **D6 (Manager Approvals)**: Real PIN and capability verification on server with audit log.
- [ ] **D7 (Server Sequences)**: Consecutive invoice & KOT numbers allocated under row locks.
- [ ] **D8 (Realtime Streaming)**: SSE event channel for station queues and floor layout updates.
- [ ] **D9 (Verification Harness)**: Fastify HTTP injection test suite and Playwright browser suite.
- [ ] **D10 (Documentation)**: Measured progress numbers and accurate setup runbooks.
- [ ] **D11 (Container Architecture)**: Linux Dockerfile, docker-compose, stateful deployment guide.

---

## Execution Log
*Detailed commit-by-commit item completions will be recorded here.*
