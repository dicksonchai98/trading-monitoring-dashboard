## Context

The frontend currently has no finalized architecture for consuming backend SSE from the serving API. Existing backend behavior is now clear: `/v1/stream/sse` emits `kbar_current`, `metric_latest`, and `heartbeat`, with auth, rate-limit, and SSE slot constraints enforced server-side.  

The reference design in `docs/plans/2026-03-22-frontend-sse-integration-design.md` defines a phased approach:
- Phase 1: finalize backend-aligned contract and frontend management baseline.
- Phase 2: wire stream data into concrete pages/features.

This change implements the OpenSpec artifacts for Phase 1 planning so implementation can proceed in a controlled way.

## Goals / Non-Goals

**Goals:**
- Define a single frontend SSE management architecture aligned to backend `/v1/stream/sse`.
- Define canonical frontend event model for `kbar_current`, `metric_latest`, and `heartbeat`.
- Define baseline store contract and validation boundary (Zod + Zustand + manager responsibilities).
- Capture runtime constraints and integration prerequisites (auth header handling, rate-limit, connection limits).
- Keep Phase 1 output implementation-ready for the next phase.

**Non-Goals:**
- Implementing page-level realtime rendering in dashboard pages.
- Optimizing per-widget selector performance and rerender behavior in production components.
- Introducing advanced reconnect/backoff or worker-based processing.
- Changing backend SSE event contract in this change.

## Decisions

### 1) Use backend serving SSE endpoint as source of truth

Decision:
- Frontend contract will target `GET /v1/stream/sse` as the market-serving stream endpoint.

Rationale:
- This endpoint contains the actual production-oriented market stream behavior.
- `/realtime/*` routes are auxiliary/demo style and not the serving contract.

Alternatives considered:
- Use `/realtime/weighted` or `/realtime/strength` as frontend contract baseline.
- Rejected because payload semantics and lifecycle differ from serving stream.

### 2) Standardize event union on `kbar_current | metric_latest | heartbeat`

Decision:
- Frontend event model and schemas will only include these three events for this capability.

Rationale:
- Backend currently pushes these events on `/v1/stream/sse`.
- Prevents drift from historical assumptions (`tick`/`bidask` direct push).

Alternatives considered:
- Keep generic `tick`/`bidask` event model in frontend.
- Rejected because it mismatches actual backend output and creates translation ambiguity.

### 3) Single app-level SSE manager + centralized Zustand store

Decision:
- Adopt one shared connection manager and one centralized realtime store contract.

Rationale:
- Avoids duplicate SSE connections and inconsistent reconnection logic across pages.
- Creates a stable contract for future page hooks/selectors.

Alternatives considered:
- Open SSE per page/component.
- Rejected due to duplicated connections, higher failure surface, and coordination complexity.

### 4) Keep React Query for initial snapshot/current baseline

Decision:
- Snapshot/current data remains REST-driven via React Query; stream updates overlay latest realtime values.

Rationale:
- Guarantees usable first render before first stream event.
- Keeps responsibilities clear between query cache and realtime store.

Alternatives considered:
- SSE-only rendering without REST baseline.
- Rejected because cold-start UX and fallback behavior become brittle.

### 5) Declare auth transport decision as Phase 2 prerequisite

Decision:
- Explicitly record a blocking technical decision: header-capable SSE client vs backend auth transport change.

Rationale:
- Backend requires Bearer header, while native `EventSource` cannot attach custom Authorization headers.
- This decision materially impacts implementation path and dependency choices.

Alternatives considered:
- Proceed with native `EventSource` without decision.
- Rejected because it cannot satisfy current backend auth requirements reliably.

## Risks / Trade-offs

- [Auth transport mismatch] Native `EventSource` cannot send Bearer headers → Mitigation: choose and document one path before coding (fetch-based SSE client recommended, or backend auth transport adjustment).
- [Contract drift] Backend event payload fields evolve and frontend schemas become stale → Mitigation: treat serving route + store normalizers as contract reference and include schema update checklist in next phase tasks.
- [Over-scoping Phase 1] Team may start page-level wiring before contract artifacts stabilize → Mitigation: mark page integration as explicit non-goal and keep specs scoped to architecture baseline.
- [Reconnect behavior ambiguity] MVP reconnect policy may not cover all production failure modes → Mitigation: keep baseline reconnect simple in Phase 2 and capture advanced strategy as follow-up change.

## Migration Plan

1. Finalize this change artifacts (`proposal`, `design`, `specs`, `tasks`) for frontend SSE integration capability.
2. In next phase, implement manager/store/schema modules under `apps/frontend/src/features/realtime/`.
3. Introduce stream integration in target pages incrementally after manager contract is stable.
4. Validate behavior under auth failures (`401`), rate-limit (`429`), and SSE slot limits.
5. Rollback strategy:
   - Keep existing REST snapshot-only rendering path intact.
   - Gate realtime integration behind feature-level composition so stream wiring can be disabled without breaking baseline pages.

## Open Questions

- Which authenticated SSE client approach will be selected for Phase 2 implementation?
  - fetch-based SSE client with headers
  - backend auth transport adjustment for native `EventSource`
- Should connection ownership live in app bootstrap/provider layer or in a dedicated feature bootstrap hook?
- What is the minimum acceptable reconnect policy for MVP (fixed interval only vs bounded exponential backoff)?
- Which dashboard pages will be the first rollout targets once Phase 2 starts?
