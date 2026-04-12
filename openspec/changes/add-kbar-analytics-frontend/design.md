## Context

The project already has a backend analytics design and frontend design draft for KBar analytics, but no OpenSpec frontend change defines implementation constraints and testable behavior. Current frontend architecture uses React + TypeScript strict, React Query for server state, Zod for schema validation, and guarded routes for auth UX. This change formalizes the frontend analytics capability so implementation aligns with backend API contracts and project RBAC/error-handling baselines.

## Goals / Non-Goals

**Goals:**
- Deliver two guarded analytics views: event analytics and distribution analytics.
- Keep frontend requests strictly aligned with backend analytics contracts and registry endpoints.
- Separate UI state and server state responsibilities to prevent cache drift and stale renders.
- Standardize deterministic UX for loading, empty, validation, auth, forbidden, and not-found states.
- Define test coverage for contract parsing, route guards, and interaction flows.

**Non-Goals:**
- Realtime SSE analytics or replacing existing SSE dashboard flows.
- New backend analytics formulas, job orchestration, or table schema changes.
- Expanding product scope beyond existing analytics and MVP domain boundaries.

## Decisions

### Decision 1: Add dedicated analytics routes with guarded access
- Decision: Introduce two frontend routes (`/analytics/events`, `/analytics/distributions`) under existing guarded route patterns.
- Rationale: Keeps analytics navigation explicit and aligned with backend protected analytics domain.
- Alternative considered: Embed analytics into an existing historical page. Rejected due to mixed concerns and ambiguous access behavior.

### Decision 2: Use registry-first loading for filter options
- Decision: Load `event_id` and `metric_id` options from `/analytics/events` and `/analytics/metrics` before running dependent queries.
- Rationale: Prevents hardcoded IDs and keeps frontend synchronized with backend canonical registries.
- Alternative considered: Hardcoded local registry constants. Rejected due to drift risk and operational maintenance burden.

### Decision 3: Query keys include all request-shaping parameters
- Decision: React Query keys include identity fields (`event_id`/`metric_id`, code/date window, version) and sample-table controls (`page`, `page_size`, `sort`).
- Rationale: Avoids cache collisions and stale mix-ups when filters or pagination change.
- Alternative considered: Coarse keys per page type. Rejected due to high stale-data risk.

### Decision 4: Enforce deterministic API-error UX mapping
- Decision: Map `400/401/403/404` to explicit UI states and redirect behavior.
- Rationale: Matches project frontend guard requirements and avoids ambiguous fallback behavior.
- Alternative considered: Generic error toast for all failures. Rejected because auth/permission semantics must be explicit.

### Decision 5: Keep frontend compute-light for analytics rendering
- Decision: Render summary and histogram from backend-precomputed payloads; frontend only performs presentation transforms.
- Rationale: Preserves backend as analytics source of truth and avoids client-side formula drift.
- Alternative considered: Recompute histogram bins client-side from samples. Rejected due to inconsistency and performance overhead.

## Risks / Trade-offs

- [Risk] Backend endpoint fields evolve and break schema parsing -> Mitigation: Centralized Zod schemas + contract tests for all analytics payloads.
- [Risk] Route-guard policy mismatch with backend RBAC -> Mitigation: Keep frontend guard as UX-only and rely on deterministic `401/403` handling.
- [Risk] Registry query delay blocks initial rendering -> Mitigation: staged loading skeletons and query dependency gating.
- [Risk] Query-key over-parameterization increases cache footprint -> Mitigation: scope analytics caches with reasonable staleTime and controlled page sizes.

## Migration Plan

1. Add analytics API client layer and Zod schemas for registry, event stats/samples, and distribution stats.
2. Add route entries and page shells with guarded access.
3. Implement shared filter bar and registry-driven selectors.
4. Implement event analytics page with summary/cards/charts and paginated sample table.
5. Implement distribution page with summary/cards/histogram/metric definition.
6. Add deterministic error-state components and wire status mapping (`400/401/403/404/5xx`).
7. Add tests for query key behavior, route guards, API contract parsing, and UI interaction flows.
8. Roll out behind normal frontend release path; rollback by removing new route registrations if necessary.

## Open Questions

- Should analytics routes be visible to `visitor` role in MVP, or strictly `member/admin` only?
- Should `flat_threshold` be passed to backend in this phase, or held as future-compatible UI field pending backend support?
- Should `version` remain hidden with fixed `latest`, or exposed in advanced filters for operators?
