# OTC Summary Worker Design

## 1. Scope

This change adds OTC index realtime support by reusing existing ingestion flow and introducing a dedicated worker-service path for OTC summary state.

In scope:
- Reuse `market_ingestion` to ingest OTC index events.
- Add dedicated `otc_summary_worker` (similar lifecycle to `market_summary_worker`).
- Persist OTC latest/today state to Redis.
- Expose independent serving endpoints:
  - `GET /v1/otc-summary/latest`
  - `GET /v1/otc-summary/today`
- Emit SSE event `otc_summary_latest`.

Out of scope:
- OTC history API.
- OTC DB persistence.
- Non-price derived metrics.

## 2. Data Contract (Minimal Price-Only)

Worker output payload (latest and today entries):
- `code`
- `trade_date`
- `minute_ts`
- `event_ts`
- `index_value`

No turnover/ratio/spread fields are included in OTC summary.

## 3. Architecture

```text
OTC feed
  -> market_ingestion (reuse existing process; add OTC code subscription)
  -> Redis stream: {env}:stream:market:{OTC_CODE}
  -> otc_summary_worker (consumer group: agg:otc)
  -> Redis state:
       {env}:state:{code}:{trade_date}:otc_summary:latest
       {env}:state:{code}:{trade_date}:otc_summary:zset
  -> serving:
       /v1/otc-summary/latest
       /v1/otc-summary/today
       SSE event: otc_summary_latest
```

## 4. Serving Behavior

### 4.1 REST
- `GET /v1/otc-summary/latest`
  - 200 with latest payload.
  - 404 `otc_summary_not_found` when missing.
- `GET /v1/otc-summary/today`
  - 200 with array payload.
  - Empty list allowed when no entries.

Error semantics:
- Redis failure -> `503 redis_unavailable`.
- Invalid query range -> existing serving validation behavior.

### 4.2 SSE
- Extend current `/v1/stream/sse` emission loop to include OTC summary latest changes.
- Event name: `otc_summary_latest`.
- Failure isolation remains per connection (same as current SSE design).

## 5. Redis Keys

Follow existing key convention:
- Latest:
  - `{env}:state:{code}:{trade_date}:otc_summary:latest`
- Intraday zset:
  - `{env}:state:{code}:{trade_date}:otc_summary:zset`
  - score: unix seconds
  - member: JSON payload

## 6. Worker Runtime Pattern

Use established stream worker pattern:
- `XAUTOCLAIM` pending recovery
- `XREADGROUP` new entries
- process -> write state -> `XACK`
- skip invalid event payloads with metrics

No DB sink path is introduced in this phase.

## 7. Configuration

Add OTC-focused config keys:
- `INGESTOR_OTC_ENABLED`
- `INGESTOR_OTC_CODE` (default `OTC001`)
- `OTC_SUMMARY_ENABLED`
- `OTC_SUMMARY_ENV`
- `OTC_SUMMARY_CODE` (default `OTC001`)
- `OTC_SUMMARY_GROUP` (default `agg:otc`)
- `OTC_SUMMARY_CONSUMER_NAME` (default `agg-otc-1`)
- `OTC_SUMMARY_READ_COUNT`
- `OTC_SUMMARY_BLOCK_MS`
- `OTC_SUMMARY_CLAIM_IDLE_MS`
- `OTC_SUMMARY_CLAIM_COUNT`
- `OTC_SUMMARY_STATE_TTL_SECONDS`

## 8. Testing

Minimum required coverage:
- Worker unit tests:
  - valid event writes latest/zset.
  - invalid event skipped safely.
- Serving API tests:
  - `/v1/otc-summary/latest` (200/404/503).
  - `/v1/otc-summary/today` (200 empty/non-empty/503).
- SSE tests:
  - emits `otc_summary_latest` event when state changes.

## 9. Rollout

1. Enable OTC ingest stream emission.
2. Deploy/start `backend-otc-summary-worker`.
3. Deploy serving route + SSE extension.
4. Verify latest/today and SSE event in staging.

Rollback:
- disable `OTC_SUMMARY_ENABLED` and `INGESTOR_OTC_ENABLED`.
- existing market summary flow remains unaffected.
