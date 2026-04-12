## 1. API Contracts and Types

- [x] 1.1 Add analytics API client functions for registries, event stats, event samples, and distribution stats.
- [x] 1.2 Add centralized Zod schemas and TypeScript types for all analytics request/response payloads.
- [x] 1.3 Add request parameter builders for `start_date`, `end_date`, `version`, `page`, `page_size`, and `sort`.
- [x] 1.4 Add deterministic response parsing and error normalization for 400/401/403/404/5xx.

## 2. Routing and Access Integration

- [x] 2.1 Register `/analytics/events` and `/analytics/distributions` routes in frontend router.
- [x] 2.2 Apply guarded-route policy for analytics pages and ensure unauthorized/forbidden redirects are wired.
- [x] 2.3 Add analytics navigation entries and keep route metadata consistent with existing shell patterns.

## 3. Shared Analytics Filter Layer

- [x] 3.1 Implement `AnalyticsFilterBar` with shared fields (`code`, `start_date`, `end_date`).
- [x] 3.2 Implement registry-driven selectors for `event_id` and `metric_id` from backend registry queries.
- [x] 3.3 Implement event-specific `flat_threshold` input with client-side validation boundaries.
- [x] 3.4 Enforce client-side date-range validation and disable invalid submissions.

## 4. Event Analytics Page

- [x] 4.1 Implement event summary cards bound to event stats query results.
- [x] 4.2 Implement direction pie chart and return histogram rendering from backend payload fields.
- [x] 4.3 Implement event sample table with server pagination (`page`, `page_size`) and sorting (`sort`).
- [x] 4.4 Reset sample table page to 1 when request-shaping filters change.

## 5. Distribution Analytics Page

- [x] 5.1 Implement distribution summary cards bound to distribution stats query results.
- [x] 5.2 Implement histogram rendering directly from backend `histogram_json` payload.
- [x] 5.3 Implement metric definition section from registry metadata.
- [x] 5.4 Implement page-level empty state when distribution sample count is zero.

## 6. Query Keys and State Boundaries

- [x] 6.1 Add dedicated React Query keys for event registry, metric registry, event stats, event samples, and distribution stats.
- [x] 6.2 Ensure query keys include all request-shaping params to prevent cache collision.
- [x] 6.3 Keep server state in React Query and limit Zustand to UI-only state.
- [x] 6.4 Add cache invalidation/reset behavior for cross-filter transitions.

## 7. UX States and Resilience

- [x] 7.1 Add loading skeletons for summary/charts/table regions on both analytics pages.
- [x] 7.2 Add deterministic error components for validation, unauthorized, forbidden, not found, and server/network failure.
- [x] 7.3 Add retry affordance for recoverable failures without full page reload.

## 8. Verification and Tests

- [x] 8.1 Add unit tests for filter validation, query-key generation, and pagination reset behavior.
- [x] 8.2 Add integration/UI tests for registry-first loading and analytics page query flows.
- [x] 8.3 Add integration/UI tests for event sample pagination and sorting behavior.
- [x] 8.4 Add UI tests for 400/401/403/404 handling and guard-based redirects.
- [x] 8.5 Add contract tests for analytics response schema parsing (event stats/samples/distribution histogram).
