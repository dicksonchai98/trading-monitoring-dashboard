## Phase 1 Completion Notes (Frontend SSE Integration)

Reference:
- `docs/plans/2026-03-22-frontend-sse-integration-design.md`
- `openspec/changes/plan-frontend-sse-integration/proposal.md`
- `openspec/changes/plan-frontend-sse-integration/design.md`
- `openspec/changes/plan-frontend-sse-integration/specs/frontend-sse-integration/spec.md`

## 1. Contract Verification Summary

- Serving SSE source of truth confirmed as `GET /v1/stream/sse`.
- Event contract confirmed as:
  - `kbar_current`
  - `metric_latest`
  - `heartbeat`
- Direct frontend stream assumptions for `tick` / `bidask` are excluded from Phase 1 contract artifacts.
- Backend runtime constraints explicitly documented in artifacts:
  - Bearer auth required
  - rate limit enforcement
  - SSE connection slot limit
  - poll interval and heartbeat behavior

## 2. Architecture Baseline Notes

### 2.1 Shared SSE manager boundary

Manager responsibilities:
- establish and close the SSE connection
- parse SSE frames (event + payload)
- route by event name (`kbar_current`, `metric_latest`, `heartbeat`)
- apply validation before state write
- update store with normalized latest state
- manage reconnect state transitions

Manager non-responsibilities:
- page-specific rendering logic
- component-level formatting
- business UI transformations tied to individual pages

### 2.2 Centralized realtime store contract

Baseline store fields for Phase 2 implementation:
- `connectionStatus`
- `kbarCurrentByCode`
- `metricLatestByCode`
- `lastHeartbeatTs`

This store is shared app-wide and consumed by selector hooks.

### 2.3 Validation boundary and failure policy

Validation occurs before entering the shared store:
- parse payload JSON
- validate against event-specific schemas
- if invalid: discard event, record diagnostic log, keep stream processing active

## 3. Phase 2 Prerequisite Decisions

### 3.1 Authenticated SSE transport strategy (decided)

Selected approach:
- Use a header-capable SSE client (fetch-based SSE) for Phase 2.

Reason:
- Backend requires `Authorization: Bearer <token>` on `/v1/stream/sse`.
- Browser-native `EventSource` cannot attach custom authorization headers.

### 3.2 Expected behavior for `401` and `429`

- `401 Unauthorized`:
  - set connection state to auth-failed/error
  - stop aggressive reconnect loop
  - require token/session refresh path before reconnect

- `429 Too Many Requests` / `sse_limit`:
  - set throttled state (or error with throttled reason)
  - retry with bounded delay strategy (minimum backoff window)
  - avoid immediate rapid retry cycles

### 3.3 Rollout boundary confirmation

- Phase 1 ends at contract + architecture + decision capture.
- Page-level stream wiring begins in the next implementation phase.

## 4. Phase 2 Handoff Checklist

### 4.1 Module targets under `apps/frontend/src/features/realtime/`

- `types/realtime.types.ts`
- `schemas/serving-event.schema.ts`
- `services/realtime-manager.ts`
- `store/realtime.store.ts`
- `hooks/use-realtime-connection.ts`
- `hooks/use-kbar-current.ts`
- `hooks/use-metric-latest.ts`

### 4.2 Initial verification checklist

- stream connects with valid auth header
- event routing parses all three event names
- invalid payload handling does not terminate stream
- reconnect behavior works after transport failure
- `401` handling stops retry storm and surfaces auth action
- `429` handling applies throttled retry behavior
- selector-level consumption avoids full-store rerender coupling

### 4.3 First integration targets for next phase

1. Realtime dashboard summary widgets that currently depend on REST snapshot fallback.
2. Components that consume current K-bar values (`kbar_current`).
3. Components that consume latest bid/ask derived metrics (`metric_latest`).

Integration sequence should remain incremental and preserve REST fallback in each step.
