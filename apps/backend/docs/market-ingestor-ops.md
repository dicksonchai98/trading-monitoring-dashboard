# Market Ingestor Ops Runbook

## Purpose

This runbook documents MVP operation of the Shioaji to Redis Streams ingestor.

## Context7-validated Shioaji call sequence

Based on Context7 source `/llmstxt/sinotrade_github_io_llms-full_txt`, the startup sequence is:

1. `api.login(api_key=..., secret_key=..., fetch_contract=False)`
2. `api.fetch_contracts(contract_download=True)` (optional but recommended when login skips fetch)
3. Register callbacks:
   - `api.quote.set_on_tick_fop_v1_callback(...)`
   - `api.quote.set_on_bidask_fop_v1_callback(...)`
   - `api.quote.set_on_tick_stk_v1_callback(...)` (spot stock ticks)
   - `api.quote.set_on_quote_stk_v1_callback(...)` (market/index quote path)
4. Subscribe near-month futures contract:
   - `api.quote.subscribe(contract, quote_type=QuoteType.Tick, version=QuoteVersion.v1)`
   - `api.quote.subscribe(contract, quote_type=QuoteType.BidAsk, version=QuoteVersion.v1)`
5. Subscribe market index contract:
   - `api.quote.subscribe(index_contract, quote_type=QuoteType.Quote, version=QuoteVersion.v1)`

## Required environment

- `SHIOAJI_API_KEY`
- `SHIOAJI_SECRET_KEY`
- `REDIS_URL`
- `INGESTOR_ENABLED=true`
- `INGESTOR_ENV` (`dev` or `prod`)

## Redis stream contract

- Key format: `{env}:stream:{quote_type}:{code}`
- Examples:
  - `dev:stream:tick:MTX`
  - `dev:stream:bidask:MTX`
  - `dev:stream:quote:MTX`
  - `dev:stream:market:TSE001`
- Retention: approximate `MAXLEN ~` (default `100000`, tune per environment)

## Ordering and reliability scope

- Guaranteed: FIFO write order per stream key in single ingestor process.
- Not guaranteed:
  - Global ordering across multiple stream keys.
  - Continuous ordering across reconnect windows.

## Gap-signal interpretation

- `event_ts`: exchange event timestamp from quote payload.
- `recv_ts`: ingestion receive timestamp in UTC.
- `events_dropped_total`: queue overflow drops (newest drop policy).
- `ws_reconnect_count`: reconnect attempts observed.
- `queue_depth`: current in-memory queue depth.
- `ingest_lag_ms`: `now_utc - event_ts`.
- Spot ingestion metrics:
  - `ingestion_spot_events_total`
  - `ingestion_spot_queue_depth`
  - `ingestion_spot_publish_errors_total`
  - `ingestion_spot_lag_ms`

## Reconnect policy

- Exponential backoff with cap: `1, 2, 4, 8, 16, 30 ...` seconds.
- Recovery sequence per attempt:
  - login
  - refresh contract context
  - re-subscribe configured quote types

## Spot ingestion alert thresholds (cutover baseline)

- `ingestion_spot_queue_depth` sustained > 500 for 5 minutes: warn
- `ingestion_spot_queue_depth` sustained > 1000 for 5 minutes: critical
- `ingestion_spot_publish_errors_total` increase > 50 within 5 minutes: critical
- `ingestion_spot_lag_ms` sustained > 5000 for 5 minutes: warn
- `ingestion_spot_lag_ms` sustained > 10000 for 5 minutes: critical

## First-hour dashboard panels

- Futures queue depth (`queue_depth`)
- Spot queue depth (`ingestion_spot_queue_depth`)
- Spot publish error rate (`ingestion_spot_publish_errors_total`)
- Spot ingest lag (`ingestion_spot_lag_ms`)
- WS reconnect attempts (`ws_reconnect_count`)

## MVP boundaries

Deferred to phase 2:

- K-line correction/recompute.
- Multi-session sharding.

Historical backfill is operated by dedicated worker runtime:

- Start worker: `python -m workers.backfill_worker`
- Trigger jobs via admin API: `POST /api/admin/batch/backfill/jobs`

Batch workers now consume Redis list queues with blocking pop:

- Historical backfill queue: `queue:batch:historical_backfill`
- Market crawler queue: `queue:batch:market_crawler`

Shared admin batch job operations:

- Create backfill job: `POST /api/admin/batch/backfill/jobs`
- Create crawler job: `POST /api/admin/batch/crawler/jobs`
- List jobs: `GET /api/admin/batch/jobs`
- Get job detail: `GET /api/admin/batch/jobs/{job_id}`
