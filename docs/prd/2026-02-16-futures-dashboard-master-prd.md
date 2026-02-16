# Futures Monitoring Platform Master PRD

- Version: v1.0
- Date: 2026-02-16
- Status: Draft for Implementation
- Reference: `docs/plans/2026-02-16-futures-dashboard-design.md`

## 1. Product Intent
Build a frontend-backend separated futures monitoring platform for near-month Taiwan index futures (MVP), with extensible domain boundaries for future instruments and analytics.

## 2. MVP Goals
1. Deliver near-real-time futures snapshots to dashboard users.
2. Enforce JWT + RBAC across protected APIs.
3. Support single-plan subscription lifecycle via mock webhook.
4. Run locally with Docker Compose and keep cloud-migration-ready boundaries.

## 3. System Constraints
1. Frontend: React.
2. Backend: FastAPI modular monolith.
3. Data stores: PostgreSQL + Redis.
4. MQ: Redis Streams.
5. Realtime transport: SSE (1-second cadence).
6. Target concurrency: around 200 online users.

## 4. Domain Map (Bounded Contexts)
1. Market Data Ingestion
- Responsibility: provider connectivity, payload normalization, stream append.

2. Indicator & Realtime Delivery
- Responsibility: stream consumption, snapshot computation, cache + SSE push.

3. Identity & Access
- Responsibility: authentication, JWT verification, RBAC policy enforcement.

4. Subscription & Billing (Mock)
- Responsibility: subscription intent, webhook callback handling, subscription state.

5. Admin & Audit
- Responsibility: admin-only operations and audit-event persistence.

6. Historical Analytics (Post-MVP)
- Responsibility: long-term history ingestion, scheduling, and analytical querying.

## 5. Cross-Domain Contracts
1. `TickEvent`
- `symbol`, `ts`, `price`, `volume`, `source`, `market_type`

2. `Snapshot`
- `symbol`, `ts`, `last_price`, `change`, `volume`, `status`

3. Redis Stream and Keys
- Stream: `stream:near_month_txf`
- Latest cache: `latest:snapshot:near_month_txf`
- Dead-letter stream: `stream:dead:near_month_txf`

## 6. Global Security Rules
1. Backend authorization is source of truth.
2. Frontend route guard is UX-layer only.
3. All protected CRUD must pass middleware + RBAC checks.
4. Sensitive operations and denied requests must be audit-logged.

## 7. Global Reliability Rules
1. Provider disconnects require exponential-backoff reconnect.
2. Stream consumers must ack successful messages.
3. Repeated failures must move to dead-letter stream.
4. Single-event processing failure must not block full pipeline.

## 8. Shared Acceptance Criteria
1. End-to-end pipeline delivers snapshots every second in normal operation.
2. Unauthorized access is rejected with correct 401/403 behavior.
3. Subscription mock webhook can activate entitlements.
4. Baseline concurrency test reaches ~200 connections without critical failure.

## 9. Document Structure
1. This file defines shared product requirements and cross-domain constraints.
2. Domain-specific details are defined in:
- `docs/prd/domains/01-market-data-ingestion-prd.md`
- `docs/prd/domains/02-indicator-realtime-prd.md`
- `docs/prd/domains/03-identity-access-prd.md`
- `docs/prd/domains/04-subscription-billing-prd.md`
- `docs/prd/domains/05-admin-audit-prd.md`
- `docs/prd/domains/06-historical-analytics-prd.md`
