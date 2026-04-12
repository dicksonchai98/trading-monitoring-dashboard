# Spot Single-Stream + SSE List Design (2026-04-09)

## Goal

Unify spot ingestion from per-symbol Redis Streams to a single spot stream key, keep per-symbol latest state keys, and expose a frontend-friendly `spot_latest_list` over SSE.

## Confirmed Decisions

1. Spot ingestion stream uses one key, not per-symbol keys.
2. Latest state remains per-symbol key (`state:spot:{symbol}:latest`).
3. SSE provides a full list model for frontend consumption.
4. SSE pushes an initial snapshot immediately after connect, then pushes every 1 second.
5. List length is fixed to the registry size (currently 156 symbols).
6. Missing symbol state is represented as null-valued fields, but symbol stays present.
7. No dual-write migration; direct cutover is acceptable.
8. Day session window is `09:00` to `13:45` (Asia/Taipei) for display behavior.

## Current Problems

1. Spot stream fanout is per-symbol (`stream:spot:{symbol}`), increasing consumer discovery/management complexity.
2. Frontend wants list consumption, but backend currently serves single-symbol spot SSE only via query parameter.
3. Multi-symbol UI state management is harder than necessary under per-symbol SSE event model.

## Target Architecture

### 1. Ingestion

- Stream key changes from:
  - `{env}:stream:spot:{symbol}`
- To:
  - `{env}:stream:spot`
- Event payload remains per-tick/per-symbol:
  - includes `symbol`, `event_ts`, `last_price`, `ingest_seq`, `payload`, `asset_type`.

### 2. Latest State Worker

- Consume only `{env}:stream:spot`.
- Keep dedupe/ordering via `ingest_seq` per symbol.
- Keep write target unchanged:
  - `{env}:state:spot:{symbol}:latest`

### 3. Serving / SSE

- Add list aggregation in serving layer:
  - load symbol registry (fixed 156 symbols from configured file).
  - read each `{env}:state:spot:{symbol}:latest`.
  - build fixed-order list with null fallback for missing symbols.
- Add SSE event:
  - `event: spot_latest_list`
  - payload:
    - `ts` (epoch ms)
    - `items` (fixed-length list)
- Emit behavior:
  - immediate snapshot on connect
  - periodic snapshot every second

## Data Contracts

### Spot Stream Entry (single stream key)

```json
{
  "source": "shioaji",
  "symbol": "2330",
  "event_ts": "2026-04-09T13:25:58+08:00",
  "last_price": 612.0,
  "ingest_seq": 123,
  "recv_ts": "2026-04-09T05:25:57.705500+00:00",
  "payload": {},
  "asset_type": "spot"
}
```

### Spot Latest State (unchanged key model)

```json
{
  "symbol": "2330",
  "last_price": 612.0,
  "session_high": 620.0,
  "session_low": 600.0,
  "is_new_high": false,
  "is_new_low": false,
  "updated_at": "2026-04-09T13:25:58+08:00"
}
```

### SSE `spot_latest_list` Event

```json
{
  "ts": 1775713500000,
  "items": [
    {
      "symbol": "2330",
      "last_price": 612.0,
      "session_high": 620.0,
      "session_low": 600.0,
      "updated_at": 1775713500000
    },
    {
      "symbol": "2317",
      "last_price": null,
      "session_high": null,
      "session_low": null,
      "updated_at": null
    }
  ]
}
```

## Why This Architecture

1. Event model remains clean (per-tick symbol events), avoiding oversized list writes in ingestion.
2. Consumer model is simpler (single stream group) than managing many spot stream keys.
3. State reads remain efficient for targeted symbol lookup.
4. Frontend gets exactly the desired model (full fixed list), with minimal subscription management.

## Risks and Mitigations

1. Risk: abrupt cutover may leave old per-symbol streams stale.
   - Mitigation: update workers and serving to read new stream path only; validate keys in staging before prod rollout.
2. Risk: fixed list order mismatch with frontend expectation.
   - Mitigation: define deterministic order = registry file order.
3. Risk: missing state early after startup.
   - Mitigation: null placeholders for missing symbols; keep fixed list length.

## Acceptance Criteria

1. Spot ingestion writes only to `{env}:stream:spot`.
2. Latest-state worker consumes from single spot stream and updates per-symbol latest keys.
3. `/v1/stream/sse` emits `spot_latest_list` immediately and then every 1 second.
4. `spot_latest_list.items.length` is always 156.
5. Missing symbols appear with null fields, not omitted.
6. Existing futures/market SSE events continue to function unchanged.
