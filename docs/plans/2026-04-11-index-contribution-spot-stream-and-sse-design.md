# Index Contribution Spot Stream Consumption and SSE Serving Design

Date: 2026-04-11

## 1. Summary

This design updates `index_contribution_worker` to consume a single spot stream key `dev:stream:spot` (configurable by env), process a projected 150-symbol feed, and publish contribution state for downstream serving.

Serving remains state-based and extends existing `GET /v1/stream/sse` with index contribution events:
- `index_contrib_ranking`
- `index_contrib_sector`

## 2. Goals

- Consume spot events from one stream key and maintain stable throughput for 150 subscribed symbols.
- Keep contribution computation deterministic with idempotency and stale-event protection.
- Preserve existing Redis/DB output contract for contribution state.
- Include contribution updates in existing serving SSE endpoint without creating a second SSE channel.

## 3. Non-Goals

- No direct worker-owned HTTP API.
- No multi-index support in this phase (still `TSE001` only).
- No frontend UI redesign in this phase.

## 4. Input Stream Contract

## 4.1 Stream key

- Primary key: `dev:stream:spot`
- Must be configurable by env (do not hardcode runtime to `dev`).

## 4.2 Observed event shape

Top-level fields:
- `symbol`
- `event_ts`
- `last_price`
- `ingest_seq`
- `recv_ts`
- `payload` (JSON string)
- `asset_type=spot`

`payload.raw_quote` includes `close` and other quote details.

## 4.3 Price extraction rule

- Preferred: top-level `last_price` when `last_price > 0`
- Fallback: `payload.raw_quote.close` when top-level `last_price <= 0`
- If both invalid/missing, drop event and record metric.

## 5. Consumption Model

## 5.1 Consumer topology

- Single stream consumer group: `INDEX_CONTRIBUTION_GROUP` (default `index-contrib:spot`)
- Start with single consumer instance for deterministic ordering and lower state-race risk.
- Scale to multiple consumers later only if lag metrics prove insufficient.

## 5.2 Read loop

For each cycle:
1. `XAUTOCLAIM` pending entries for reclaim/retry path
2. `XREADGROUP` new entries
3. Parse -> validate -> compute -> publish state
4. `XACK` only after successful state write path

Default tuning (initial):
- `read_count=200`
- `block_ms=1000`
- `claim_idle_ms=30000`
- `claim_count=200`

## 5.3 Idempotency and ordering

- Primary idempotency key: Redis stream entry ID (e.g. `1775802833106-0`)
- Stale protection: per-symbol `updated_at` must be strictly increasing
- Sequence protection: if `ingest_seq` exists, drop lower/equal sequence for same symbol

## 5.4 Symbol filtering

- Process only symbols in current daily `TSE001` constituent set.
- Drop non-constituents early with dedicated metric.

## 6. State and Persistence

## 6.1 In-memory state

- `symbol_state`
- `sector_aggregate`
- top/bottom ranking derivation
- processed event IDs cache

## 6.2 Redis state

- Symbol latest:
  - `{env}:state:index_contrib:TSE001:{trade_date}:{symbol}:latest`
- Ranking top ZSET:
  - `{env}:state:index_contrib:TSE001:{trade_date}:ranking:top`
- Ranking bottom ZSET:
  - `{env}:state:index_contrib:TSE001:{trade_date}:ranking:bottom`
- Sector aggregate JSON:
  - `{env}:state:index_contrib:TSE001:{trade_date}:sector`

Write optimization:
- Symbol latest updates per accepted symbol event
- Ranking and sector use short coalescing window (dirty flag + periodic flush) to reduce write amplification

## 6.3 DB minute snapshots

Keep current 1m snapshot tables:
- `index_contribution_snapshot_1m`
- `index_contribution_ranking_1m`
- `sector_contribution_snapshot_1m`

No schema changes required in this design.

## 7. Serving Design (Including SSE)

## 7.1 Endpoint strategy

- Reuse existing `GET /v1/stream/sse`
- Do not create new SSE endpoint

## 7.2 New SSE events

Add two event types:
- `index_contrib_ranking`
- `index_contrib_sector`

Push policy:
- Poll Redis on existing serving interval
- Push only when payload changed vs last emitted payload
- Heartbeat remains unchanged

## 7.3 Event schemas

`index_contrib_ranking`:
```json
{
  "index_code": "TSE001",
  "trade_date": "2026-04-10",
  "top": [
    {"rank_no": 1, "symbol": "2330", "contribution_points": 3.19}
  ],
  "bottom": [
    {"rank_no": 1, "symbol": "2881", "contribution_points": -0.82}
  ],
  "ts": 1775802833106
}
```

`index_contrib_sector`:
```json
{
  "index_code": "TSE001",
  "trade_date": "2026-04-10",
  "sectors": {
    "Semiconductor": 4.3,
    "Finance": -1.2
  },
  "ts": 1775802833106
}
```

## 8. Error Handling and Reliability

- Parse errors: drop entry, increment parse-failure metric, ACK to avoid poison-loop
- Business-invalid event (price/weight/prev_close): drop with reason metric, ACK
- Redis write transient failure: retry by existing policy; if exhausted, do not ACK
- DB flush failure: keep existing retry and dead-letter strategy
- Alarm on consecutive Redis/DB failures over threshold

## 9. Observability

Required metrics additions/confirmations:
- Stream consume counts, drops by reason, lag, pending reclaim count
- Price fallback usage count (`last_price -> raw_quote.close`)
- Ranking/sector redis write latency and error counts
- SSE push count per new event type

## 10. Testing Plan

- Unit:
  - event parser and price fallback behavior
  - idempotency + stale + ingest_seq guards
- Integration:
  - stream read -> compute -> redis keys -> ack
  - reclaim path (`XAUTOCLAIM`) behavior
- API/SSE:
  - `/v1/stream/sse` emits `index_contrib_ranking` and `index_contrib_sector`
  - no-change no-push behavior
- Non-functional:
  - synthetic 150-symbol stream burst and lag observation

## 11. Rollout Plan

1. Land consumer loop behind config flag if needed.
2. Enable in staging with stream replay.
3. Verify lag, drop ratio, and SSE push stability.
4. Roll out production with single consumer first.
5. Scale consumers only if lag SLA is not met.

## 12. Open Decisions

- Whether ranking payload should be symbol-only (minimal) or enriched with `symbol_name/sector` in SSE.
- Final production stream key naming convention (environmentized equivalent of `dev:stream:spot`).
