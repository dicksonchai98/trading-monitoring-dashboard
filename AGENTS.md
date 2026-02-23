# AGENTS Constitution

This document defines the project flow and technical baseline for all human and AI agents working in this repository.

## 1) Source Reference

Primary design reference:
- `docs/plans/2026-02-16-futures-dashboard-design.md`

If new changes conflict with this baseline, update design docs and OpenSpec artifacts in the same change.

## 2) Project Workflow

### A. Market Data Workflow

1. Backend `market_ingestion` receives raw Shioaji market data.
2. Data is normalized into shared event shape (`TickEvent`).
3. Events are appended to Redis Streams (`stream:near_month_txf`).
4. `indicator_engine` consumes stream events (consumer group).
5. Backend computes near-month snapshot.
6. Snapshot is written to:
   - PostgreSQL (minimal persisted snapshot)
   - Redis (`latest:snapshot:near_month_txf`) for fast read/fanout
7. `realtime` module pushes updates to clients via SSE every 1 second.

### B. Subscription Workflow (Mock)

1. Member creates subscription intent.
2. Intent is stored in PostgreSQL.
3. Backend triggers internal mock webhook flow.
4. Subscription is activated and RBAC entitlements are updated.

### C. Access Control Workflow

1. User authenticates via JWT-based auth flow.
2. Frontend applies page-level route guards for UX.
3. Backend enforces RBAC at API boundary (source of truth).
4. Admin operations generate audit records.

### D. Delivery Workflow

1. Start from design/spec updates (`docs/` + `openspec/`).
2. Implement per module boundary (auth, ingestion, realtime, subscription, admin, audit).
3. Validate with unit/integration/API/non-functional tests.
4. Ship with infra config alignment (`infra/`).

## 3) Technology and Framework Baseline

### A. Frontend

- Framework: React (SPA)
- Language: JavaScript/TypeScript in React ecosystem
- Responsibilities:
  - Dashboard views
  - Role-based page guards
  - SSE client consumption

### B. Backend

- Framework: FastAPI (modular monolith)
- Language: Python
- Responsibilities:
  - Auth and RBAC enforcement
  - Shioaji ingestion and normalization
  - Indicator computation
  - SSE delivery
  - Subscription/mock payment/admin/audit APIs

### C. Data and Infrastructure

- Database: PostgreSQL (transactional data: users, subscription, audit)
- Cache and MQ: Redis
  - Redis Streams for event pipeline
  - Redis keys for latest snapshot cache and SSE fanout support
- Transport for realtime: SSE (MVP choice; not WebSocket)
- Infra management: `infra/` (compose and env templates)

## 4) MVP Scope Baseline

In scope:
- Near-month Taiwan index futures monitoring
- 1-second SSE updates
- JWT + RBAC (admin/member/visitor)
- Mock payment webhook with single plan

Out of scope:
- Full multi-instrument coverage
- Historical backfill/scraping pipeline
- Real payment provider integration
- Full multi-plan billing model

## 5) Security and Reliability Baseline

- Backend RBAC is mandatory for protected APIs.
- Auth failures return deterministic `401/403` behavior.
- Stream handling should support retry, ack, and dead-letter behavior.
- SSE failures must be isolated per connection.
- Admin/security-relevant actions should be auditable.

## 6) Testing Baseline

- Unit: indicator logic, RBAC policies
- Integration: stream -> compute -> snapshot path
- API: auth, role-protected routes, mock webhook flow
- Non-functional: SSE connection/concurrency and ingestion reconnect behavior
