## 1. Aggregator Service Skeleton

- [ ] 1.1 Create aggregator module/package structure and config scaffolding
- [ ] 1.2 Define stream names, consumer group names, and Redis/PG connection wiring

## 2. Tick Stream Processing

- [ ] 2.1 Implement tick consumer loop with consumer group reads
- [ ] 2.2 Implement 1-minute K bar state machine and minute rollover
- [ ] 2.3 Write current K hash and intraday K ZSET updates to Redis
- [ ] 2.4 Persist completed 1-minute bars to Postgres
- [ ] 2.5 Add late/invalid event drop counters
- [ ] 2.6 Implement trade_date calculation based on Asia/Taipei 15:00 boundary

## 3. BidAsk Metrics Processing

- [ ] 3.1 Implement bidask consumer loop with consumer group reads
- [ ] 3.2 Implement metrics registry and latest metrics computation
- [ ] 3.3 Implement 1-second sampling with carry-forward writes to metric ZSET
- [ ] 3.4 Enforce series_fields whitelist for metric ZSET persistence
- [ ] 3.5 Compute delta_1s from prior sampled value
- [ ] 3.6 Write latest metrics JSON blob to Redis

## 4. Redis State TTL

- [ ] 4.1 Apply 24-hour TTL to intraday Redis keys and series

## 5. Reliability and Operations

- [ ] 5.1 ACK entries only after required writes succeed (tick: Redis+PG, bidask: Redis)
- [ ] 5.2 Ensure write failure leaves entries pending (no ACK)
- [ ] 5.3 Add startup pending scan and XAUTOCLAIM reclaim loop with idle_ms/claim_count
- [ ] 5.4 Add basic observability metrics (consume_rate, archive_rate, sampling_rate, stream_lag, write_errors, write_latency, late_tick_drops)

## 6. Integration and Validation

- [ ] 6.1 Add integration test: stream -> aggregator -> Redis state
- [ ] 6.2 Add integration test: stream -> aggregator -> Postgres kbars_1m
- [ ] 6.3 Add basic load/smoke test for long-running consumer stability
