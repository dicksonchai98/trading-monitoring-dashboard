# Futures Market Ingestion Design (2026-02-27)

## Scope

- Domain: `01-market-data-ingestion`
- Instrument: Futures near-month continuous contract (`TXFR1`)
- Data mode: Realtime only (no backfill/gap-fill in this version)
- Quote types: `tick`, `bidask`, `quote`
- Downstream goal: 1-minute K-line is built from `tick` stream only

## Context and Constraints

- Shioaji documentation is integration reference, not system-of-record data storage.
- Current MVP page focuses on realtime data from "now onward"; no frontfill at page-open.
- Historical data display belongs to a separate page and API path.
- This design must remain aligned with:
  - `docs/plans/2026-02-16-futures-dashboard-design.md`
  - `docs/prd/domains/01-market-data-ingestion-prd.md`

## Architecture

### Module Boundaries

- `market_ingestion/adapters/shioaji_futures_adapter.py`
  - Connect/reconnect and subscriptions for three quote types.
- `market_ingestion/normalizers/tick_normalizer.py`
  - Raw `tick` payload -> internal `TickEvent`.
- `market_ingestion/normalizers/bidask_normalizer.py`
  - Raw `bidask` payload -> internal `BidAskEvent`.
- `market_ingestion/normalizers/quote_normalizer.py`
  - Raw `quote` payload -> internal `QuoteEvent`.
- `market_ingestion/publishers/redis_stream_publisher.py`
  - Publish normalized events to Redis Streams.
- `market_ingestion/observability/metrics.py`
  - Counters/gauges for ingestion, publish, reconnect.

### Stream Topology

- `stream:futures:txfr1:tick`
- `stream:futures:txfr1:bidask`
- `stream:futures:txfr1:quote`

Rationale:
- Keep event-type isolation.
- Allow downstream consumer specialization.
- Avoid unified-stream filter complexity.

## Event Contract Strategy

Use layered mapping instead of direct 1:1 raw passthrough:

1. `required core`
- Mandatory, stable fields for downstream contract.

2. `optional mapped`
- Useful fields when present; nullable and non-blocking.

3. `raw_payload`
- Trimmed raw fields for trace/debug.

### TickEvent (primary for 1m K-line)

Required:
- `symbol: string`
- `ts_event: string` (ISO-8601 with timezone)
- `price: number` (`> 0`)
- `volume: number` (trade size)
- `cum_volume: number` (cumulative volume)

Optional:
- `source: "shioaji"`
- `market_type: "futures"`
- `session: "day" | "night"` (current version is day-only operation, keep field for extension)
- `ingest_seq: integer`

Trace:
- `raw_payload: object`

### BidAskEvent

Required:
- `symbol`
- `ts_event`
- `bid_price`
- `ask_price`

Optional:
- `bid_volume`
- `ask_volume`
- `source`
- `market_type`
- `session`
- `ingest_seq`

Trace:
- `raw_payload`

### QuoteEvent

Required:
- `symbol`
- `ts_event`
- `last_price`

Optional:
- Additional mapped quote fields based on futures quote payload
- `source`
- `market_type`
- `session`
- `ingest_seq`

Trace:
- `raw_payload`

## Realtime Data Flow

1. Adapter connects to Shioaji.
2. Subscribe `TXFR1` for `tick`, `bidask`, `quote`.
3. Dispatch raw messages by `quote_type`.
4. Normalize to internal event schema.
5. Publish to dedicated Redis stream.
6. Downstream `indicator/realtime` consumes `tick` stream for 1m aggregation.

## Validation and Error Handling

### Validation Policy

- Policy: strict on required fields, lenient on optional fields.
- Required invalid/missing:
  - Drop event.
  - Emit structured error log with `quote_type` and `reason`.
- Optional invalid/missing:
  - Set null/default.
  - Emit warning log.

### Reliability Rules

- Reconnect with exponential backoff:
  - `1s -> 2s -> 4s ...` with cap at `30s`.
- Redis publish failure:
  - Retry short bursts (e.g. 3 attempts: `100ms`, `300ms`, `500ms`).
  - On failure, emit error metric/log.
- Per-message isolation:
  - Single malformed event must not block main ingestion loop.
- Current version explicitly excludes gap fill/backfill.

## Observability

- `ingestion_events_total{quote_type,status}`
- `redis_publish_total{quote_type,status}`
- `reconnect_total`
- `connection_status`
- Periodic throughput summary logs (by quote type)

## Testing Strategy

### Unit Tests

- Normalizer mapping correctness for each quote type.
- Required-field validation drop path.
- Optional-field fallback behavior.

### Integration Tests

- Mock raw messages -> Redis stream publish verification.
- Redis transient failures and retry behavior.

### Resilience Tests

- Simulated disconnect/reconnect backoff.
- Malformed message isolation (no pipeline stall).

## Alternatives Considered

1. Single unified stream with `event_type`
- Rejected for higher downstream coupling and weaker fault isolation.

2. Raw stream + normalized stream (two-layer)
- Deferred due to higher MVP complexity.

3. Selected: three normalized streams by quote type
- Best balance for MVP simplicity, isolation, and extension.

## Out of Scope (This Version)

- Gap fill after reconnect.
- Historical backfill and schedule jobs.
- Night session specific handling logic.
- Frontfill for realtime page initial load.

## Acceptance Criteria

1. System subscribes `TXFR1` for `tick/bidask/quote` and receives realtime events.
2. Valid events are normalized and published to the three Redis streams.
3. Invalid required fields are dropped with structured observability.
4. Disconnect triggers exponential-backoff reconnect without manual intervention.
5. Tick stream remains suitable input for downstream 1-minute aggregation.

