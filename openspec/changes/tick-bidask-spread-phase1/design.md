## Context

This change operationalizes the design in `docs/plans/2026-04-06-tick-bidask-extensions-and-spread-design.md` on top of the current worker architecture established in `docs/plans/2026-02-16-futures-dashboard-design.md`. The implementation must preserve existing stream topology and worker boundaries while extending payload contracts and persistence.

Current architecture already provides:
- tick and bidask stream consumption in stream processing worker(s)
- market summary worker consuming `{env}:stream:market:TSE001`
- Redis realtime serving state and Postgres minute/second persistence

## Goals / Non-Goals

**Goals:**
- Deliver phase-1 derived metrics with fixed formulas and deterministic edge-case behavior.
- Keep existing key topology and consumer-group flow unchanged.
- Ensure stale futures handling for spread is explicit and observable.
- Provide migration-safe additive schema updates and test coverage.

**Non-Goals:**
- No new standalone spread worker.
- No multi-pair spread engine.
- No spread_ratio in phase 1.
- No frontend-specific API shape redesign.

## Decisions

1. Extend existing workers instead of adding new workers.
- Decision: Implement amplitude in tick path, main_force_big_order in bidask path, spread in market summary path.
- Rationale: minimizes operational complexity and preserves current deployment/runtime model.
- Alternative rejected: dedicated spread worker now; rejected due single-pair scope.

2. Fix spread source contract to futures latest state, not dual-stream consume.
- Decision: `futures_code = AGGREGATOR_CODE`, read `{env}:state:{futures_code}:{trade_date}:k:current` field `close`.
- Rationale: avoids dual-stream ordering complexity while reusing canonical tick-derived latest price.
- Alternative rejected: market+tick dual stream align in one worker; rejected due replay and latency complexity.

3. Define deterministic stale behavior.
- Decision: apply 5-second freshness check from market event to futures latest timestamp; on failure write null spread fields with `spread_status=stale_or_missing_futures`.
- Rationale: keeps outputs explicit and prevents silently misleading spread values.

4. Keep bidask DB schema stable in phase 1.
- Decision: write new bidask fields into existing `metric_payload` JSON.
- Rationale: lower migration risk and faster delivery; promote to dedicated columns in phase 2 if query pressure requires.

## Risks / Trade-offs

- [Trade-date mismatch between workers] -> Reuse shared trade_date helper from stream processing in spread path and add integration tests crossing day boundary.
- [Stale spread spikes during futures gaps] -> Emit `market_spread_stale_total` and alert on stale ratio threshold.
- [Client compatibility risk from payload extension] -> Keep keys unchanged, add fields only, and retain tolerant normalization in serving store.
- [DB nullability premature hardening] -> Use additive nullable migration first, enforce strict constraints only after observed stable fill rates.

## Migration Plan

1. Add additive DB migrations for `kbars_1m` and `market_summary_1m` new fields.
2. Deploy worker code writing new fields (including stale handling).
3. Enable/monitor metrics and alert thresholds.
4. Validate payload/DB fill rates via integration checks.
5. Optional follow-up migration for stricter nullability or dedicated bidask columns.

Rollback:
- Roll back worker release/config first.
- Keep additive schema in place (non-destructive); serving remains tolerant to missing/extra fields.

## Open Questions

- Confirm NUMERIC precision/scale conventions for new DB columns.
- Confirm exact timestamp field used in `k:current` for freshness comparison if event timestamp is absent.
- Confirm final alert thresholds with operations owner.
