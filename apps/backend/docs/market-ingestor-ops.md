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
4. Subscribe near-month futures contract:
   - `api.quote.subscribe(contract, quote_type=QuoteType.Tick, version=QuoteVersion.v1)`
   - `api.quote.subscribe(contract, quote_type=QuoteType.BidAsk, version=QuoteVersion.v1)`

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

## Reconnect policy

- Exponential backoff with cap: `1, 2, 4, 8, 16, 30 ...` seconds.
- Recovery sequence per attempt:
  - login
  - refresh contract context
  - re-subscribe configured quote types

## MVP boundaries

Deferred to phase 2:
- K-line correction/recompute.
- Multi-session sharding.

Historical backfill is operated by dedicated worker runtime:
- Start worker: `python -m app.historical_backfill_worker`
- Trigger jobs via admin API: `POST /api/admin/backfill/historical-jobs`

