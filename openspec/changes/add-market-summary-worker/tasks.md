## 1. Ingestion Extension (Market Feed)

- [x] 1.1 Extend `market_ingestion` contracts/callback wiring to support `quote_type=market` events for `TSE001`
- [x] 1.2 Publish normalized market envelope to `{env}:stream:market:TSE001` using existing queue->writer pipeline
- [x] 1.3 Add ingest config toggles/defaults for market feed enablement and source binding
- [x] 1.4 Add unit tests for market event normalization and stream-key publishing

## 2. Market Summary Worker Runtime

- [x] 2.1 Create market-summary worker module and entrypoint process (parallel to existing workers)
- [x] 2.2 Implement consumer-group read loop with `XAUTOCLAIM` + `XREADGROUP` + ack-after-success semantics
- [x] 2.3 Implement metric computation (`completion_ratio`, `estimated_turnover`) with clamp/divide-safe behavior
- [x] 2.4 Implement session-time handling (`MARKET_TRADING_START/END`) and out-of-session semantics
- [x] 2.5 Add dedicated `market_summary_*` observability metrics and structured logging

## 3. Redis State and DB Sink

- [x] 3.1 Implement Redis latest/zset writes using shared key format `{env}:state:{code}:{trade_date}:{suffix}`
- [x] 3.2 Implement event-time minute rollover buffer and flush logic
- [x] 3.3 Add `market_summary_1m` SQLAlchemy model and Alembic migration with unique key `(market_code, minute_ts)`
- [x] 3.4 Implement batch DB sink with retry/backoff and dead-letter stream on exhaustion
- [x] 3.5 Add duplicate-conflict tolerance tests for replay/idempotency

## 4. Serving API and SSE

- [x] 4.1 Add serving-store read helpers for market summary latest/today/history (Redis + DB)
- [x] 4.2 Add independent REST routes: `/v1/market-summary/latest`, `/today`, `/history`
- [x] 4.3 Add SSE push event `market_summary_latest` with change-detection behavior
- [x] 4.4 Normalize response timestamps to epoch ms and align error contracts (`redis_unavailable` / `db_unavailable`)
- [x] 4.5 Add API tests for auth/rate-limit/dependency-failure behavior on market-summary routes

## 5. Runtime Wiring and Configuration

- [x] 5.1 Add market-summary config keys in `app/config.py` with safe defaults
- [x] 5.2 Wire runner construction in `app/state.py` and expose worker runtime builder
- [x] 5.3 Register worker process entrypoint in deployment/runtime scripts
- [x] 5.4 Update env examples/docs for new market-summary configuration

## 6. Verification and Rollout

- [x] 6.1 Add integration test for end-to-end path: ingest -> stream -> market_summary_worker -> Redis/DB
- [x] 6.2 Add non-functional test coverage for reconnect/retry/dead-letter and SSE isolation behavior
- [x] 6.3 Run `openspec validate add-market-summary-worker --strict` and fix all validation findings
- [x] 6.4 Prepare staged rollout checklist with feature-flag enable order and rollback steps
