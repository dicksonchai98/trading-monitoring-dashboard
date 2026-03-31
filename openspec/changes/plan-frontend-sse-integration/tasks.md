## 1. Contract and Artifact Alignment

- [x] 1.1 Verify the SSE source-of-truth endpoint and event set in artifacts (`/v1/stream/sse`, `kbar_current`, `metric_latest`, `heartbeat`).
- [x] 1.2 Ensure proposal/design/specs consistently exclude direct `tick`/`bidask` frontend event assumptions.
- [x] 1.3 Add explicit references in artifacts to backend constraints (Bearer auth, rate limit, SSE slot limit, heartbeat/poll behavior).

## 2. Frontend Architecture Baseline Definition

- [x] 2.1 Define the single shared SSE manager responsibility boundary (connect/parse/validate/reconnect/write-store) in implementation plan notes.
- [x] 2.2 Define the centralized realtime store contract fields (`connectionStatus`, `kbarCurrentByCode`, `metricLatestByCode`, `lastHeartbeatTs`) in implementation plan notes.
- [x] 2.3 Define validation boundary and failure policy for incoming SSE payloads before store write.

## 3. Phase 2 Prerequisite Decisions

- [x] 3.1 Decide and document the authenticated SSE transport strategy (header-capable SSE client vs backend auth transport adjustment).
- [x] 3.2 Define expected frontend behavior for `401` and `429` stream failures to avoid retry storms.
- [x] 3.3 Confirm rollout boundaries: Phase 1 ends at architecture/contracts, page-level stream integration starts in next phase.

## 4. Implementation Handoff Preparation

- [x] 4.1 Create a Phase 2 module target list under `apps/frontend/src/features/realtime/` (schemas, services, store, hooks, types).
- [x] 4.2 Define initial verification checklist for Phase 2 (event parsing, reconnect, auth failure handling, selector stability).
- [x] 4.3 Confirm the first page/function integration targets for next phase and record them in follow-up plan.
