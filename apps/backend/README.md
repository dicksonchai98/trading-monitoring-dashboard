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

## OTP + Email Services

- OTP APIs:
  - `POST /auth/email/send-otp`
  - `POST /auth/email/verify-otp`
  - `POST /auth/register` (requires `verification_token`)
- Webhook:
  - `POST /email/webhooks/sendgrid`
- Core modules:
  - `app/services/otp_service.py`
  - `app/services/email_outbox_dispatcher.py`
  - `app/workers/email_worker.py`
  - `workers/email_pipeline_worker.py`
  - `app/services/sendgrid_provider.py`
  - `app/services/notification_email_service.py`

Runbook:
- `apps/backend/docs/otp-email-ops.md`

## Market Ingestor (Shioaji -> Redis Streams)

- Enable with `INGESTOR_ENABLED=true`
- Required credentials: `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`
- Stream naming: `{env}:stream:{quote_type}:{code}` (for example `dev:stream:tick:MTX`)
- Ordering guarantee: per stream key only (no cross-stream global ordering)
- Gap signals: `event_ts`, `recv_ts`, `events_dropped_total`, `ws_reconnect_count`, `queue_depth`, `ingest_lag_ms`

Runbook:
- `apps/backend/docs/market-ingestor-ops.md`

## Historical Backfill Worker

- Trigger API: `POST /api/admin/batch/backfill/jobs`
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

## Shared Batch Admin APIs

- `POST /api/admin/batch/backfill/jobs`
- `POST /api/admin/batch/crawler/jobs`
- `GET /api/admin/batch/jobs`
- `GET /api/admin/batch/jobs/{job_id}`

## Stream Processing Worker

- Dedicated process entrypoint: `python -m workers.stream_processing_worker`
- Split process entrypoints:
  - `python -m workers.stream_processing_tick_worker`
  - `python -m workers.stream_processing_bidask_worker`
  - `python -m workers.quote_worker`
  - `python -m workers.latest_state_worker`
  - `python -m workers.market_summary_worker`
- API process should not run aggregator loops; set `AGGREGATOR_ENABLED=false` for API service.
- In docker-compose:
  - `backend-api` serves HTTP only.
  - `backend-stream-worker` keeps compatibility for combined stream processing.
  - `backend-tick-worker` runs Tick processing.
  - `backend-bidask-worker` runs BidAsk processing.
  - `backend-latest-state-worker` runs spot latest-state processing.
  - `backend-market-summary-worker` runs market summary processing for `TSE001`.

Quick runbook:
- Start (split workers): `docker compose up -d redis backend-api backend-tick-worker backend-bidask-worker backend-latest-state-worker backend-quote-worker`
- Check status: `docker compose ps`
- Restart one worker: `docker compose restart backend-tick-worker`
- Stop one worker without API impact: `docker compose stop backend-bidask-worker`

<!-- ## Run (example)

```bash
set DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/trading_dashboard
alembic -c alembic.ini upgrade head
set ADMIN_PASSWORD=admin-pass
python scripts/seed_admin.py
uvicorn app.main:app --reload
pytest
``` -->
