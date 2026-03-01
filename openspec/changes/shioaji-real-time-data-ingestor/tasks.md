## 1. Interface and Configuration Baseline

- [ ] 1.1 Confirm Shioaji login and subscription API contract via Context7 and document exact SDK call sequence for login, quote callback registration, and subscribe.
- [ ] 1.2 Add ingestion configuration schema for Shioaji credentials, contract targets, quote types, queue size, reconnect backoff, and stream `MAXLEN`.
- [ ] 1.3 Wire environment variables and infra templates for credentials and stream namespace prefix (`{env}`).

## 2. Shioaji Session Lifecycle

- [ ] 2.1 Implement ingestor startup flow that performs Shioaji login before any subscriptions are created.
- [ ] 2.2 Implement configured topic subscriptions for `tick` and `bidask` by contract code.
- [ ] 2.3 Implement reconnect loop with capped exponential backoff and automatic re-login/re-subscribe.
- [ ] 2.4 Add structured logging and counters for auth failures, reconnect attempts, and subscription restore outcomes.

## 3. Queue and Redis Stream Publishing

- [ ] 3.1 Implement callback handlers that only perform non-blocking enqueue (`put_nowait`) into bounded `asyncio.Queue`.
- [ ] 3.2 Implement single writer task that dequeues events and writes to Redis Streams with key format `{env}:stream:{quote_type}:{code}`.
- [ ] 3.3 Add envelope normalization (`source`, `code`, `quote_type`, `event_ts`, `recv_ts`) while preserving raw payload.
- [ ] 3.4 Apply approximate `MAXLEN ~` trimming on every `XADD` using environment-configured retention targets.

## 4. Ordering, Backpressure, and Fault Handling

- [ ] 4.1 Enforce per-stream ordering contract through FIFO queue and single writer execution model.
- [ ] 4.2 Implement queue overflow policy to drop newest event and increment `events_dropped_total`.
- [ ] 4.3 Implement Redis write retry policy (bounded attempts + short backoff) with failure logging and continuation behavior.
- [ ] 4.4 Document explicit limits: no global cross-stream ordering and no continuity guarantee across reconnect windows.

## 5. Observability and Verification

- [ ] 5.1 Add metrics: `events_received_total`, `events_written_redis_total`, `redis_write_latency_ms`, `ws_reconnect_count`, `queue_depth`, `ingest_lag_ms`, `events_dropped_total`.
- [ ] 5.2 Add ingest lag computation and emit latest lag based on `now_utc - event_ts`.
- [ ] 5.3 Add unit tests for envelope normalization, stream key generation, queue overflow behavior, and retry logic.
- [ ] 5.4 Add integration tests for login-subscribe-ingest path and reconnect re-subscription flow against Redis Streams.
- [ ] 5.5 Add non-functional verification for sustained ingest throughput and 3-hour replay retention behavior under expected event rates.
