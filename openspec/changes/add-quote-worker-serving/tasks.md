## 1. Quote Ingestion and Worker Contract

- [x] 1.1 Extend ingestion quote-type handling to support futures `quote` subscription and stream publish to `{env}:stream:quote:{code}`
- [x] 1.2 Add quote worker runtime entrypoint and configuration surface (`enabled`, `target_code`, `group`, `consumer`, retry/backoff options)
- [x] 1.3 Implement quote consume loop with `XAUTOCLAIM` pending reclaim and `XREADGROUP` new-message reads
- [x] 1.4 Enforce ACK gating: ack only after compute success, Redis state write success, and sink handoff success

## 2. Quote State Aggregation and Persistence

- [x] 2.1 Implement 1-second quote aggregation bucket for `main_chip` and `long_short_force`
- [x] 2.2 Implement day high/day low/strength tracking with `day_high == day_low` fallback behavior
- [x] 2.3 Write quote latest state to Redis key `quote_features:latest`
- [x] 2.4 Write quote intraday second snapshots to Redis key `quote_features:zset`
- [x] 2.5 Implement minute-boundary flush that persists only the minute's last emitted second snapshot
- [x] 2.6 Add `quote_features_1m` DB model and migration with key/index design
- [x] 2.7 Implement quote DB sink retry/backoff and dead-letter behavior for terminal failures

## 3. Quote Serving REST APIs

- [x] 3.1 Add serving-store reader for quote latest state from Redis
- [x] 3.2 Add serving-store reader for quote intraday second range from Redis zset
- [x] 3.3 Add serving-store reader for quote minute history from `quote_features_1m`
- [x] 3.4 Add serving-store aggregate query for `min/max/avg/last/count` on both quote features
- [x] 3.5 Add `GET /v1/quote/latest` route with existing auth/rate-limit dependencies
- [x] 3.6 Add `GET /v1/quote/today` route with existing auth/rate-limit dependencies
- [x] 3.7 Add `GET /v1/quote/history` route with existing auth/rate-limit dependencies and required range validation
- [x] 3.8 Add `GET /v1/quote/aggregates` route with existing auth/rate-limit dependencies and required range validation
- [x] 3.9 Align quote route error mapping with serving conventions (`redis_unavailable`, `db_unavailable`)

## 4. SSE Extension and Compatibility

- [x] 4.1 Extend existing `/v1/stream/sse` polling loop to read quote latest state
- [x] 4.2 Emit `quote_latest` only on state change and avoid duplicate emissions
- [x] 4.3 Preserve existing `kbar_current`, `metric_latest`, and `heartbeat` emission behavior
- [x] 4.4 Verify SSE behavior under Redis dependency failure follows current reconnect/disconnect policy

## 5. Validation, Tests, and Ops Updates

- [x] 5.1 Add unit tests for quote aggregation formulas, strength computation, and minute flush rules
- [x] 5.2 Add worker reliability tests for pending reclaim, ACK gating, retry, and dead-letter flows
- [x] 5.3 Add serving API tests for quote latest/today/history/aggregates success and error paths
- [x] 5.4 Add SSE tests covering `quote_latest` emission and backward compatibility of existing events
- [x] 5.5 Update backend docs/runbook for quote worker runtime, new keys/table, and serving endpoints/events
- [x] 5.6 Run targeted backend test suite for quote worker and quote serving contracts before rollout
