## Why

Current stream-processing modules cover generic latest-state projection, but they do not provide index attribution outputs (per-symbol contribution points, top/bottom ranking, sector aggregation, and minute snapshots) required by the Taiwan futures monitoring dashboard. Implementing a dedicated `index_contribution_worker` now closes this product gap and aligns with the MVP analytics path.

## What Changes

- Add a dedicated `index_contribution_worker` for `TSE001` attribution processing.
- Compute per-symbol contribution points from constituent spot latest updates using daily index inputs.
- Maintain real-time top 20 positive and top 20 negative contribution rankings.
- Maintain real-time sector contribution aggregates.
- Persist minute snapshots for symbol contributions, rankings, and sector aggregates.
- Define ordering/idempotency handling, minute-boundary persistence semantics, and warm-restart behavior.

## Capabilities

### New Capabilities
- `index-contribution-worker`: Real-time attribution pipeline and minute snapshot persistence for `TSE001` constituent contribution analytics.

### Modified Capabilities
- None.

## Impact

- Affected backend modules: stream processing workers, Redis state writer, PostgreSQL snapshot sinks, worker bootstrap/runtime config.
- New persistence artifacts: minute snapshot tables for symbol/ranking/sector attribution.
- Affected serving layer: downstream API can consume Redis + snapshot tables for contribution endpoints.
- Operational impact: additional worker lifecycle, observability metrics, and daily reset/reload procedures.
