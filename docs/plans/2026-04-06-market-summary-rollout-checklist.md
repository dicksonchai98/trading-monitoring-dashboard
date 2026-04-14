# Market Summary Rollout Checklist (2026-04-06)

## 1. Pre-Deploy

- Confirm migration `20260406_01_add_market_summary_1m.py` is applied in staging.
- Confirm `backend-market-summary-worker` image can start and connect to Redis/Postgres.
- Confirm ingest source supports market feed callbacks for `TSE001`.

## 2. Feature Flag Enable Order

1. Set ingestion flags:
   - `INGESTOR_MARKET_ENABLED=true`
   - `INGESTOR_MARKET_CODE=TSE001`
2. Set worker flags:
   - `MARKET_SUMMARY_ENABLED=true`
   - `MARKET_CODE=TSE001`
   - `MARKET_GROUP=agg:market`
   - `MARKET_CONSUMER_NAME=agg-market-1`
3. Start `backend-market-summary-worker`.
4. Verify Redis keys are updated:
   - `*:state:TSE001:*:market_summary:latest`
   - `*:state:TSE001:*:market_summary:zset`
5. Enable/verify serving read path (`/v1/market-summary/*`) for internal users.

## 3. Smoke Checks

- `GET /v1/market-summary/latest` returns `200` with expected fields.
- `GET /v1/market-summary/today` returns non-empty list during session.
- `GET /v1/market-summary/history` returns data after minute rollover flush.
- SSE stream includes `market_summary_latest` event on change.

## 4. Operational Checks

- Monitor metrics:
  - `market_summary_events_processed_total`
  - `market_summary_invalid_events_total`
  - `market_summary_stream_lag_ms`
  - `market_summary_db_sink_errors_total`
  - `market_summary_db_sink_dead_letter_total`
- Confirm dead-letter stream remains empty in steady state:
  - `*:stream:dead-letter:market-summary`

## 5. Rollback Plan

1. Stop `backend-market-summary-worker`.
2. Set `MARKET_SUMMARY_ENABLED=false` and `INGESTOR_MARKET_ENABLED=false`.
3. Keep serving routes deployed but expect `404`/empty responses for market summary reads.
4. Preserve DB rows and dead-letter entries for postmortem.

## 6. Post-Deploy Follow-up

- Capture 1 trading day of data quality metrics (ratio bounds, estimate drift).
- Review adjustment factor (`MARKET_ADJUSTMENT_FACTOR`) with domain stakeholders.
- Decide whether to proceed to phase-2 session segmentation.
