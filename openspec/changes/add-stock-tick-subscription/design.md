## Context

Current ingestion supports futures tick/bidask only. The refactor plan requires extending `market_ingestion` to dual ingestion (futures + spot) with about 150 spot symbols, while preserving futures path stability and latency.  
The same process lifecycle can be shared, but futures and spot must be isolated in queueing, publish path, and observability so spot pressure does not degrade futures critical flow.

## Goals / Non-Goals

**Goals:**

- Add spot tick subscription and publish flow for a config-defined symbol set (~150).
- Establish strict startup validation for spot symbol registry and configurable failure policy.
- Define a stable spot stream event contract and stream naming convention.
- Ensure runtime isolation between futures and spot ingestion paths for backpressure and failure containment.
- Provide baseline spot metrics and structured logs for cutover and ongoing operations.

**Non-Goals:**

- No redesign of downstream workers (`tick-worker`, DB sinks, latest-state-worker) beyond enforcing the ingestion-side contract assumptions.
- No expansion to multi-instrument classes beyond spot + existing futures.
- No historical backfill, replay framework redesign, or billing/auth scope changes.

## Decisions

1. Use a file-based spot symbol registry with explicit runtime controls.
   - Decision: load symbols from `INGESTOR_SPOT_SYMBOLS_FILE` (default `infra/config/stock150.txt`) and validate non-empty, unique, regex `^\d{4}$`, and expected count constraints (`INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT`).
   - Rationale: aligns with rollout flexibility and keeps symbol management auditable and operationally simple.
   - Alternative considered: hard-code symbols in application config. Rejected due to high maintenance risk and poor staged-rollout ergonomics.

2. Introduce optional vs required spot ingestion startup mode.
   - Decision: on invalid spot config, fail fast when spot is required; otherwise disable spot path and keep futures running.
   - Rationale: supports strict production enforcement while allowing controlled staged deployments.
   - Alternative considered: always fail fast. Rejected because it increases rollout risk where spot enablement is phased.

3. Adopt per-symbol stream contract with monotonic `ingest_seq`.
   - Decision: spot events include `symbol`, `event_ts`, `last_price`, `source`, `ingest_seq`; stream key follows `{env}:stream:spot:{symbol}`.
   - Rationale: per-symbol `ingest_seq` provides ordering/idempotency anchor and keeps isolation natural at stream level.
   - Alternative considered: a single shared spot stream. Rejected due to higher contention, harder lag attribution, and weaker per-symbol isolation.

4. Keep separate internal queues/publishers for futures and spot.
   - Decision: runtime enforces distinct queue and publish execution paths by asset type.
   - Rationale: prevents spot overload or publish retries from consuming futures capacity.
   - Alternative considered: shared queue with priority. Rejected for higher tuning complexity and increased risk of starvation or coupling.

5. Add spot-specific observability as first-class signals.
   - Decision: add `ingestion_spot_events_total`, `ingestion_spot_queue_depth`, `ingestion_spot_publish_errors_total`, `ingestion_spot_lag_ms`, and structured logs with `asset_type`, `symbol`, `stream_key`, `ingest_seq`, `error_type`.
   - Rationale: needed for cutover gates, first-hour monitoring, and rapid fault localization.
   - Alternative considered: rely on generic ingestion metrics. Rejected because it cannot isolate spot-specific regressions.

## Risks / Trade-offs

- [Large symbol fanout increases resource pressure] -> Mitigation: isolate spot queue/publisher, track queue depth/lag, enforce alert thresholds during cutover.
- [Symbol registry drift or malformed entries] -> Mitigation: startup validation + strict mode count checks + optional-mode graceful disable.
- [Per-symbol streams increase Redis key cardinality] -> Mitigation: explicit naming convention and observability for lag/pending; validate infra capacity pre-cutover.
- [Ordering/idempotency regressions in downstream consumers] -> Mitigation: require monotonic `ingest_seq` per symbol and idempotent handling on replay paths.

## Migration Plan

1. Prepare and validate `infra/config/stock150.txt` and runtime env defaults.
2. Deploy ingestion changes with spot optional mode in lower/staging environments.
3. Validate spot metrics/log fields and alert thresholds.
4. Enable spot required mode in production cutover window when preconditions are met.
5. Execute cutover sequence from refactor plan; monitor first-hour dashboard and escalation policy.
6. Rollback by disabling new spot path / reverting ingestion deployment if sustained error, backlog growth, or lag threshold breach occurs.

## Open Questions

- Should spot-required vs spot-optional be controlled by a dedicated boolean env var or inferred from deployment profile?
- Do we need symbol-list hot reload, or is restart-only symbol update acceptable for MVP?
- Are per-symbol stream retention policies already standardized across environments, or should this change define defaults?
