# Domain PRD: Market Data Ingestion

- Domain: Market Data Ingestion
- Version: v1.0
- Date: 2026-02-16
- Parent: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain Goal
Ingest near-month Taiwan index futures data from Shioaji, normalize it into stable internal events, and append events into Redis Streams.

## 2. In Scope (MVP)
1. Single provider integration: Shioaji.
2. Near-month Taiwan index futures only.
3. Event normalization and validation.
4. Stream append to `stream:near_month_txf`.

## 3. Out of Scope (MVP)
1. Multi-provider aggregation.
2. Options/spot/institutional datasets.
3. Historical scraping jobs.

## 4. Public Interfaces
1. Internal adapter interface
- `connect()`
- `subscribe(symbol)`
- `on_message(payload)`

2. Event output contract
- `TickEvent { symbol, ts, price, volume, source, market_type }`

## 5. Processing Rules
1. Invalid payloads are rejected with structured error logs.
2. Timestamp normalization is required.
3. Provider disconnection triggers exponential-backoff reconnect.

## 6. Failure Modes
1. Provider unavailable.
- Action: retry with backoff, emit system event.

2. Stream write failure.
- Action: temporary retry and error alert.

## 7. Observability
1. Ingestion rate.
2. Stream write success/failure count.
3. Provider reconnect count.

## 8. Test Scenarios
1. Valid payload normalization.
2. Invalid payload rejection.
3. Reconnect after connection loss.
4. Stream append success and retry behavior.

## 9. Acceptance Criteria
1. Valid Shioaji tick is converted to `TickEvent` and appended to stream.
2. Connection interruptions recover automatically.
3. Errors are visible in logs/metrics.
