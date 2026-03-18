# Futures Monitoring Dashboard Design (2026-02-16)

## Goal

Build an MVP for a futures monitoring dashboard with a React frontend and FastAPI backend. Data comes from Shioaji, is processed in backend, and pushed to the frontend in near real-time. The system includes JWT-based admin, RBAC, Stripe subscription flow, and page-level access control. MVP scope focuses on near-month Taiwan index futures only.

## MVP Scope

- Real-time near-month Taiwan index futures display
- SSE updates every 1 second
- JWT auth + RBAC (admin/member/visitor)
- Stripe Checkout + Webhook for single subscription plan
- Page access control on frontend + enforced RBAC on backend
- PostgreSQL + Redis
- Redis Streams as MQ

Out of scope (MVP):

- Full options/spot/foreign data types
- Historical backfill and scraping pipeline
- Full multi-plan subscription model

## Key Decisions

- Monorepo, modular monolith backend
- Redis Streams for MQ (single vendor, multi-stream)
- Redis cache for latest snapshot and SSE fanout
- PostgreSQL for transactional data (users, subscriptions, audit)
- SSE (not WebSocket) for MVP
- Target concurrency: ~200 online users

## Architecture

### Repo Structure

- `frontend/` React app (routes with role guards)
- `backend/` FastAPI app (modules per domain)
- `infra/` docker-compose and environment templates
- `docs/` design + implementation plans

### Backend Modules

- `auth`: JWT, auth middleware
- `users`: user profiles and roles
- `rbac_policy`: permissions for CRUD
- `subscription`: single-plan subscription state machine
- `billing_provider`: Stripe integration (Checkout/Webhook/Portal)
- `market_ingestion`: Shioaji adapter and normalization
- `indicator_engine`: compute near-month snapshot
- `realtime`: SSE hub and stream readers
- `admin`: admin endpoints
- `audit`: security/admin event logging

## Data Flow

### Market Data

1. `market_ingestion` receives Shioaji raw data
2. Normalize to `TickEvent`
3. Append to Redis Streams `stream:near_month_txf`
4. `indicator_engine` consumes stream via consumer group
5. Compute snapshot and write:
   - Postgres (minimal persisted snapshot)
   - Redis key `latest:snapshot:near_month_txf`
6. `realtime` SSE reads latest snapshot and pushes every 1 second

### Subscription Flow (Stripe)

1. Member creates subscription intent
2. Store intent in Postgres
3. Create Stripe Checkout Session
4. Receive Stripe webhook event
5. Activate subscription, update RBAC entitlements

### Access Control

- Frontend: page route guards
- Backend: middleware + RBAC policy checks for all CRUD
- Admin actions always write audit events

## Error Handling & Reliability

- Shioaji connection: retry with exponential backoff
- Stream consumption: acked messages, retry on failure, dead-letter stream
- Indicator compute failure: log + skip, do not block stream
- SSE: per-connection failures isolated
- Auth failures: 401/403 with audit logging

## Testing Strategy

- Unit: indicator computations, RBAC policies
- Integration: Redis Streams -> compute -> Redis snapshot
- API: auth, role-protected CRUD, Stripe checkout/webhook flow
- Non-functional: SSE 200 connections, ingestion reconnection

## Open Questions (Post-MVP)

- Historical data storage and analysis (TimescaleDB/ClickHouse?)
- Multi-plan subscription
- Extended instruments (options, spot, institutional data)
- WebSocket migration if needed
