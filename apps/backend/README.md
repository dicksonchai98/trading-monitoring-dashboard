# Backend

FastAPI modular monolith for ingestion, processing, auth, subscription, and realtime delivery.

## Local Structure (MVP)

- `app/main.py`: FastAPI entrypoint and router registration
- `app/routes/`: auth, billing, realtime, analytics, admin routes
- `app/services/`: auth, token, denylist, metrics, audit services
- `app/deps.py`: shared authn/authz dependencies
- `tests/`: acceptance-oriented API tests

## Billing Routes (Stripe)

- `POST /billing/checkout` (`user`/`admin`)
- `POST /billing/webhooks/stripe` (public, `Stripe-Signature` required)
- `GET /billing/status` (`user`/`admin`)
- `POST /billing/portal-session` (`user`/`admin`)

## Market Ingestor (Shioaji -> Redis Streams)

- Enable with `INGESTOR_ENABLED=true`
- Required credentials: `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`
- Stream naming: `{env}:stream:{quote_type}:{code}` (for example `dev:stream:tick:MTX`)
- Ordering guarantee: per stream key only (no cross-stream global ordering)
- Gap signals: `event_ts`, `recv_ts`, `events_dropped_total`, `ws_reconnect_count`, `queue_depth`, `ingest_lag_ms`

Runbook:
- `apps/backend/docs/market-ingestor-ops.md`

## Historical Backfill Worker

- Trigger API: `POST /api/admin/backfill/historical-jobs`
- Worker process entrypoint: `python -m workers.backfill_worker`
- Required env for provider login:
  - `SHIOAJI_API_KEY`
  - `SHIOAJI_SECRET_KEY`
  - `SHIOAJI_SIMULATION`
- Runtime knobs:
  - `BACKFILL_MAX_CONCURRENCY`
  - `BACKFILL_RETRY_MAX_ATTEMPTS`
  - `BACKFILL_RETRY_BACKOFF_SECONDS`
  - `BACKFILL_WORKER_POLL_INTERVAL_SECONDS`
  - `BACKFILL_HEARTBEAT_INTERVAL_SECONDS`
  - `BACKFILL_FETCH_MIN_INTERVAL_SECONDS`

<!-- ## Run (example)

```bash
set DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/trading_dashboard
alembic -c alembic.ini upgrade head
set ADMIN_PASSWORD=admin-pass
python scripts/seed_admin.py
uvicorn app.main:app --reload
pytest
``` -->
