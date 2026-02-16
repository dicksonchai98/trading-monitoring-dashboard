# Futures Monitoring Dashboard Product Requirements Document (PRD)

- Version: v1.0
- Date: 2026-02-16
- Status: Draft for Implementation
- Owner: Product + Engineering
- Reference: `docs/plans/2026-02-16-futures-dashboard-design.md`

## 1. Product Overview

This product is a frontend-backend separated futures monitoring dashboard. The frontend uses React and the backend uses FastAPI. Real-time market data is ingested from Shioaji, processed by backend modules, and pushed to clients via SSE.

The MVP focuses on near-month Taiwan index futures only and establishes an extensible architecture for future support of options parity metrics, market strength indicators, and chip-flow analysis.

## 2. Product Goals

### 2.1 MVP Goals

1. Deliver near real-time near-month Taiwan index futures snapshots to dashboard users.
2. Implement secure authentication and authorization using JWT + RBAC.
3. Implement a single-plan subscription flow using mock payment webhook.
4. Deploy locally via Docker Compose with architecture prepared for future cloud migration.

### 2.2 Non-Goals (MVP)

1. Real payment provider integration.
2. Full historical scraping/statistical engine.
3. Multi-plan subscription tiers.
4. Full multi-instrument coverage (spot/options/institutional data).
5. WebSocket migration in MVP.

## 3. Target Users and Roles

1. `visitor`

- Can access homepage.
- Page access is controlled by route whitelist.

2. `member`

- In MVP, page visibility is temporarily aligned with admin-level visible pages.
- API permissions are still enforced by backend RBAC.

3. `admin`

- Can access management features and protected CRUD operations.
- All admin actions must be audit-logged.

## 4. Success Metrics (MVP)

1. End-to-end market data pipeline availability >= 99% during business hours in local environment testing.
2. SSE update cadence maintained at 1-second intervals for latest snapshot push.
3. Support ~200 concurrent online users in baseline load test.
4. 100% protected CRUD endpoints enforce backend RBAC checks.
5. Subscription intent -> mock webhook -> active subscription flow completes successfully.

## 5. Scope

### 5.1 In Scope (MVP)

1. Monorepo project structure.
2. Modular monolith backend domains.
3. Shioaji ingestion for near-month Taiwan index futures.
4. Redis Streams as message queue for ingestion and processing.
5. Indicator computation for MVP snapshot fields.
6. Redis latest snapshot cache for SSE fan-out.
7. PostgreSQL for transactional data and minimal persisted snapshots.
8. JWT auth and RBAC policy enforcement.
9. Mock payment webhook and subscription state transitions.
10. Basic observability: logs, lag/error metrics, audit events.

### 5.2 Out of Scope (MVP)

1. Historical data scraping scheduler and long-term analytics platform.
2. Real payment and invoicing.
3. Multi-region deployment and horizontal autoscaling.
4. Advanced analytics and multi-instrument dashboards.

## 6. System Architecture

### 6.1 Repository Structure

- `frontend/`: React dashboard application.
- `backend/`: FastAPI modular monolith.
- `infra/`: Docker Compose and environment templates.
- `docs/`: plans, PRD, operations docs.

### 6.2 Backend Modules

1. `auth`: JWT generation/verification, auth middleware.
2. `users`: user profile and role management.
3. `rbac_policy`: role-resource-action authorization policy.
4. `subscription`: intent creation and subscription state management.
5. `mock_payment`: mock webhook endpoint and signature validation.
6. `market_ingestion`: Shioaji adapter and event normalization.
7. `indicator_engine`: compute snapshot from normalized events.
8. `realtime`: SSE endpoint and push orchestration.
9. `admin`: admin-only management endpoints.
10. `audit`: audit trail recording.

### 6.3 Data Stores

1. `PostgreSQL`

- Users, roles, subscriptions, intents, audit events.
- Minimal persisted market snapshots for baseline history and diagnostics.

2. `Redis`

- Redis Streams for ingestion queues.
- Latest computed snapshot cache.
- Optional short-lived throttling and connection metadata.

## 7. Data Flow

### 7.1 Market Data Pipeline

1. `market_ingestion` receives raw ticks from Shioaji.
2. Raw payload is normalized to `TickEvent` contract.
3. Event is appended into Redis Stream: `stream:near_month_txf`.
4. `indicator_engine` consumer group reads stream events.
5. Computed `Snapshot` is written to:

- PostgreSQL (minimal persistence)
- Redis key `latest:snapshot:near_month_txf`

6. `realtime` module pushes snapshot via SSE every 1 second.

### 7.2 Subscription Pipeline

1. Member sends subscription intent request.
2. Backend stores intent in PostgreSQL.
3. Internal/system trigger calls mock webhook endpoint.
4. Subscription state transitions to active.
5. Entitlement changes are reflected in RBAC policy checks.

### 7.3 Authorization Pipeline

1. Client sends JWT.
2. Middleware validates token and extracts role claims.
3. Endpoint-level policy checks role-resource-action.
4. Unauthorized requests return 401/403 and are audit logged.

## 8. Functional Requirements

### 8.1 Authentication and Authorization

1. System must support JWT login and token validation.
2. System must enforce RBAC on all protected CRUD APIs.
3. Frontend route guards must align with backend authorization results.

### 8.2 Real-time Data Processing

1. System must ingest near-month Taiwan index futures from Shioaji.
2. System must normalize incoming data into an internal contract.
3. System must process events through Redis Streams consumer groups.
4. System must compute and publish latest snapshot every second.

### 8.3 Subscription

1. System must support one subscription plan in MVP.
2. System must support subscription intent creation.
3. System must activate subscription using mock webhook callbacks.
4. Subscription status must impact authorization decisions where applicable.

### 8.4 Admin and Audit

1. Admin CRUD operations must be role-protected.
2. Admin operations must generate audit events.
3. Security-relevant events (auth failures, forbidden actions) must be logged.

## 9. Non-Functional Requirements

1. Performance: SSE updates should deliver at 1-second cadence.
2. Reliability: ingestion reconnect with exponential backoff.
3. Resilience: failed stream messages retried, then dead-lettered.
4. Scalability target: 200 concurrent users in MVP baseline.
5. Security: backend authorization is source of truth.
6. Maintainability: modular monolith boundaries must be explicit.

## 10. API and Event Contracts

### 10.1 REST/SSE Endpoints (MVP)

1. `GET /health`
2. `POST /auth/login`
3. `POST /subscriptions/intent`
4. `POST /subscriptions/mock-webhook`
5. `GET /realtime/near-month` (SSE)

### 10.2 Event Contracts

1. `TickEvent`

- Fields: `symbol`, `ts`, `price`, `volume`, `source`, `market_type`

2. `Snapshot`

- Fields: `symbol`, `ts`, `last_price`, `change`, `volume`, `status`

### 10.3 Redis Naming

1. Stream: `stream:near_month_txf`
2. Latest snapshot cache: `latest:snapshot:near_month_txf`
3. Dead-letter stream: `stream:dead:near_month_txf`

## 11. Error Handling and Reliability

1. Shioaji disconnection triggers reconnect with exponential backoff.
2. Stream processing acknowledges each successfully handled message.
3. Failed messages are retried; after retry limit they move to dead-letter stream.
4. Compute failures must not halt entire pipeline.
5. SSE connection failures are isolated per client and support reconnect.

## 12. Security Requirements

1. JWT tokens must be signed with environment-managed secrets.
2. Mock webhook endpoint must validate internal secret/signature.
3. All sensitive APIs must require authentication.
4. Role escalation attempts must be denied and logged.

## 13. Testing and Acceptance

### 13.1 Required Test Types

1. Unit tests

- Indicator compute functions.
- RBAC policy matrix.

2. Integration tests

- Redis Stream ingestion -> compute -> Redis latest snapshot.
- Subscription intent -> mock webhook activation.

3. API tests

- Auth flow.
- Protected CRUD authorization behavior.

4. Non-functional tests

- SSE concurrency baseline at ~200 users.
- Ingestion reconnect behavior.

### 13.2 Acceptance Criteria

1. Near-month snapshot appears on dashboard and updates every second.
2. Unauthorized CRUD attempts are rejected with correct status codes.
3. Mock webhook successfully activates subscription status.
4. Dead-letter handling works for repeated processing failures.
5. Baseline load test reaches target concurrency without critical failure.

## 14. Deployment and Environments

1. Initial deployment uses single-machine Docker Compose.
2. Service set includes frontend, backend, PostgreSQL, Redis.
3. Configuration follows environment-variable based setup for cloud portability.
4. Architecture keeps migration path open for managed cloud services.

## 15. Risks and Mitigations

1. Risk: Data spikes exceed processing capacity.

- Mitigation: Redis Streams buffering, consumer lag monitoring, retry/DLQ.

2. Risk: Authorization inconsistencies between frontend and backend.

- Mitigation: backend as source of truth; frontend guard is UX-only layer.

3. Risk: SSE limitations at higher scale.

- Mitigation: monitor connection counts and prepare WebSocket migration path.

4. Risk: Mock payment flow diverges from real provider behavior.

- Mitigation: define stable webhook contract now and map later provider events.

## 16. Roadmap (Post-MVP)

### P1

1. Extend data coverage to options/spot/institutional indicators.
2. Differentiate admin/member page access and API entitlements.
3. Integrate real payment provider replacing mock webhook.

### P2

1. Add historical scraping and scheduled analytics pipeline.
2. Evaluate TimescaleDB or ClickHouse for historical analytics workloads.
3. Reassess realtime transport (SSE vs WebSocket) based on load.

## 17. Open Decisions for Future Phases

1. Final real payment provider selection.
2. Long-term historical storage architecture.
3. Multi-plan subscription policy and entitlements.
4. Multi-region and production-grade scaling strategy.
