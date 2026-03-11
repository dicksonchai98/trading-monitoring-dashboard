## Why

We need a dedicated serving API to expose near-month market data to external users with low-latency reads and realtime updates. This unblocks product rollout for the MVP and formalizes the external contract.

## What Changes

- Add a new serving API surface for external consumers (REST + SSE) built on Redis state and Postgres history.
- Define behavior boundaries between compute (state generation) and serving (state read + fan-out).
- Introduce MVP-level non-functional requirements for availability, rate limiting, and observability.

## Capabilities

### New Capabilities
- `serving-api`: Provide external read access to market data (REST) and realtime updates (SSE), backed by Redis state and Postgres history.

### Modified Capabilities
- (none)

## Impact

- Backend modules: serving layer (new endpoints and SSE), integration with Redis/Postgres.
- Infra/ops: basic rate limiting, SSE connection tracking, minimal metrics.
- Docs/specs: new serving API capability specs and design docs referencing existing serving design/TRD.
