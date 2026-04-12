## Why

We now have a concrete frontend design for KBar analytics, but there is no OpenSpec change that turns that design into an implementation contract. Without a dedicated frontend change artifact set, API integration details, route guard behavior, and test scope are likely to drift and cause rework.

## What Changes

- Add a new frontend analytics capability for event analytics and distribution analytics pages.
- Define frontend-to-backend API contracts for registries, event stats/samples, and distribution stats.
- Define frontend behavior for filter state, pagination/sorting, and query key isolation.
- Define deterministic UX behavior for 400/401/403/404 and empty/loading/error states.
- Define test coverage requirements for route protection, API contract parsing, and page interaction behavior.

## Capabilities

### New Capabilities
- `kbar-analytics-frontend`: Provide frontend pages and interaction contracts for KBar event/distribution analytics using precomputed backend APIs.

### Modified Capabilities
- None.

## Impact

- Frontend modules: analytics routes, page components, filter bar, charts, sample table, and API query hooks.
- Shared frontend infrastructure: query key conventions, zod schemas, and guarded-route integration.
- API usage: consumes `/analytics/events`, `/analytics/metrics`, `/analytics/events/{event_id}/stats`, `/analytics/events/{event_id}/samples`, and `/analytics/distributions/{metric_id}`.
- Testing: add unit/integration/UI tests for filtering, pagination/sorting, route guards, and error-state handling.
