# KBar Analytics Frontend Design

## 1. Overview

This frontend capability provides:

- Event-based next-day behavior analytics
- Metric distribution analytics

Baseline alignment:

- React + TypeScript (strict)
- shadcn/ui
- React Query (@tanstack/react-query)
- Zustand (UI-only global state)
- Zod (request/response validation and type narrowing)

Data source and boundaries:

- Backend analytics APIs are the source of truth.
- Frontend does not recompute analytics metrics from raw k-bars.
- This design is for analytics query pages, not SSE realtime replacement.

---

## 2. Information Architecture

### Route 1: Event Analytics

- Path: `/analytics/events`
- Access: guarded route, same protected policy as analytics domain (`member` or `admin`; backend remains source of truth)

### Route 2: Distribution Analytics

- Path: `/analytics/distributions`
- Access: guarded route, same protected policy as analytics domain (`member` or `admin`; backend remains source of truth)

---

## 3. API Contract Mapping

Registry APIs:

- `GET /analytics/events` (load event registry for selector)
- `GET /analytics/metrics` (load metric registry for selector)

Event analytics APIs:

- `GET /analytics/events/{event_id}/stats?code=...&start_date=...&end_date=...&version=latest`
- `GET /analytics/events/{event_id}/samples?code=...&start_date=...&end_date=...&page=1&page_size=100&sort=-trade_date`

Distribution analytics API:

- `GET /analytics/distributions/{metric_id}?code=...&start_date=...&end_date=...&version=latest`

Contract notes:

- Frontend filter model uses `start_date` + `end_date` (not `date_range`).
- `version` defaults to `latest`.
- Event sample table must include server-side pagination and sorting params.
- Unknown `event_id`/`metric_id` surfaces backend `404` deterministically.

---

## 4. Shared Filter Bar

Component: `AnalyticsFilterBar`

Common filters:

- `code`
- `start_date`
- `end_date`

Event page filters:

- `event_id`
- `flat_threshold`

Distribution page filters:

- `metric_id`

Field behavior:

- `event_id` and `metric_id` options come from registry APIs, not hardcoded constants.
- `flat_threshold` is explicit UI input and sent only to event stats/samples requests when backend endpoint accepts it.
- Invalid date ranges (`start_date > end_date`) are blocked client-side.

---

## 5. Event Analytics Page

Sections:

1. Filter Bar
2. Summary Cards
3. Charts
4. Sample Table

Summary cards:

- `sample_count`
- `up_probability` / `down_probability` / `flat_probability`
- `avg_next_day_return`
- `avg_next_day_range`
- optional: `computed_at` and `version`

Charts:

- Direction pie chart (up/down/flat)
- Histogram (`next_day_return` distribution from backend payload)

Sample table:

- Data source: `event_samples`
- Server pagination: `page`, `page_size`
- Server sorting: default `-trade_date`
- Empty-state message when no sample matches filter

---

## 6. Distribution Analytics Page

Sections:

1. Filter Bar
2. Summary Cards
3. Histogram
4. Metric Definition

Summary cards:

- `sample_count`
- `mean`
- `median`
- `p75` / `p90` / `p95`
- `min` / `max`
- optional: `computed_at` and `version`

Histogram:

- Render from backend `histogram_json` payload (`bins`, `counts`, `min`, `max`, `bucket_size`)
- Client does not re-bin raw series

Metric definition:

- `metric_id`
- metric formula/description from registry metadata

---

## 7. State Management

Zustand (global UI-only state):

- current tab/page mode if shared
- selected `code`, `start_date`, `end_date`
- selected `event_id` / `metric_id`
- `flat_threshold`
- event sample table local UI state (`page`, `page_size`, `sort`)

React Query (server state):

- event registry
- metric registry
- event stats
- event samples
- distribution stats

Principle:

- Do not duplicate server truth from React Query into Zustand.

---

## 8. Query Key Design

Registry:

- `["analytics-events-registry"]`
- `["analytics-metrics-registry"]`

Event stats:

- `["analytics-event-stats", { event_id, code, start_date, end_date, version, flat_threshold }]`

Event samples:

- `["analytics-event-samples", { event_id, code, start_date, end_date, page, page_size, sort, flat_threshold }]`

Distribution:

- `["analytics-distribution", { metric_id, code, start_date, end_date, version }]`

Rules:

- Keys must include every request-shaping parameter to avoid cache collision.
- Changing filters resets event sample page back to `1`.

---

## 9. Error Handling and UX States

Deterministic handling:

- `400`: show validation error banner (invalid date range, bad params)
- `401`: redirect/login flow with session-expired message
- `403`: redirect to forbidden page
- `404`: show "unknown event/metric or no published analytics" message
- network/5xx: retry affordance + non-blocking error state

Loading/empty states:

- skeleton for summary cards and charts
- empty table/chart state when `sample_count = 0`

UX principles:

- Consistent filters between pages
- Always show `sample_count`
- Keep event and distribution contexts clearly separated
- Fast interaction via precomputed backend reads

---

## 10. Testing Plan (Frontend)

Unit:

- filter schema validation (`start_date`, `end_date`, `flat_threshold`)
- query-key builder determinism
- pagination reset logic when filters change

Integration/UI:

- event and distribution pages load registry then data queries in correct order
- event samples pagination and sorting behavior
- error-state rendering for 400/401/403/404
- protected route behavior (`member/admin` allowed, others blocked per guard policy)

Contract tests:

- response schema validation for event stats, event samples, and distribution histogram payload

---

## 11. Component Structure

- `AnalyticsFilterBar`
- `EventStatsSummaryCards`
- `DistributionStatsSummaryCards`
- `DirectionPieChart`
- `HistogramChart`
- `EventSampleTable`
- `MetricDefinitionCard`
- `AnalyticsErrorState`
- `AnalyticsEmptyState`

---

## 12. Future Extensions

- Event comparison page
- Distribution comparison
- Percentile overlay
- Strategy backtesting integration
