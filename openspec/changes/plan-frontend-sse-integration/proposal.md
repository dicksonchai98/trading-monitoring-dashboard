## Why

Frontend currently lacks a backend-aligned SSE integration contract, which blocks consistent realtime architecture decisions and implementation sequencing. We need a Phase 1 change to define the exact stream contract, auth constraints, and frontend management baseline before wiring stream data into pages.

## What Changes

- Add a new frontend SSE integration capability focused on contract alignment with backend `/v1/stream/sse`.
- Define canonical event model for frontend consumption: `kbar_current`, `metric_latest`, `heartbeat`.
- Define Phase 1 boundaries: manager/store/validation architecture baseline only; no page-level stream rendering yet.
- Define runtime constraints the frontend must honor: Bearer auth requirement, rate limit, SSE slot limit, heartbeat/poll behavior.
- Capture the pre-implementation technical decision for Phase 2: header-capable SSE client vs backend SSE auth transport adjustment.

## Capabilities

### New Capabilities

- `frontend-sse-integration`: Define frontend SSE integration contract and architecture baseline aligned with backend serving SSE implementation.

### Modified Capabilities

- None.

## Impact

- Affected design/spec artifacts:
  - `docs/plans/2026-03-22-frontend-sse-integration-design.md`
  - New OpenSpec capability under `openspec/changes/plan-frontend-sse-integration/specs/frontend-sse-integration/spec.md`
- Affected frontend scope (next phase implementation target):
  - `apps/frontend/src/features/realtime/*` (manager/store/schemas/hooks)
  - integration points in dashboard-facing pages/components
- Affected backend contract dependency:
  - `apps/backend/app/routes/serving.py` SSE event contract and auth/rate-limit behavior are consumed as source of truth.
