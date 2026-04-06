## ADDED Requirements

### Requirement: Event analytics page consumes canonical backend contracts
The frontend SHALL provide an event analytics page that queries backend event stats and samples using canonical request parameters and validated response schemas.

#### Scenario: Event stats query uses canonical parameters
- **WHEN** a user applies filters on the event analytics page
- **THEN** the frontend sends `event_id`, `code`, `start_date`, `end_date`, and `version` to the event stats endpoint

#### Scenario: Event samples query is paginated and sortable
- **WHEN** a user opens the event sample table
- **THEN** the frontend sends `page`, `page_size`, and `sort` parameters and renders only that page of backend results

### Requirement: Distribution analytics page renders backend precomputed statistics
The frontend SHALL provide a distribution analytics page that renders precomputed summary statistics and histogram payloads from backend APIs without recomputing analytics from raw bars.

#### Scenario: Distribution stats are rendered from backend payload
- **WHEN** a user selects a metric and date window
- **THEN** the frontend queries distribution stats by `metric_id`, `code`, `start_date`, `end_date`, and `version`

#### Scenario: Histogram renders server-provided bins
- **WHEN** distribution response includes histogram payload
- **THEN** the frontend renders chart bins/counts directly from backend-provided histogram fields

### Requirement: Event and metric selectors are registry-driven
The frontend SHALL source selectable `event_id` and `metric_id` values from analytics registry endpoints.

#### Scenario: Event registry populates selector
- **WHEN** the analytics UI initializes
- **THEN** the frontend loads `GET /analytics/events` and uses returned IDs/metadata for event selection

#### Scenario: Metric registry populates selector
- **WHEN** the analytics UI initializes
- **THEN** the frontend loads `GET /analytics/metrics` and uses returned IDs/metadata for metric selection

### Requirement: Query key isolation prevents stale or mixed analytics data
The frontend SHALL scope React Query keys to all request-shaping parameters for each analytics endpoint.

#### Scenario: Filter change invalidates prior cache scope
- **WHEN** any request-shaping filter changes
- **THEN** the frontend uses a different query key and does not reuse mismatched cached data

#### Scenario: Sample table pagination state is independent
- **WHEN** event sample table page or sort changes
- **THEN** the frontend resolves data through query keys that include pagination and sort parameters

### Requirement: Error and access behavior is deterministic
The frontend SHALL handle analytics API and authorization failures with deterministic user-visible behavior.

#### Scenario: Unauthorized response
- **WHEN** analytics APIs return `401`
- **THEN** the frontend redirects to login/session recovery UX

#### Scenario: Forbidden response
- **WHEN** analytics APIs return `403`
- **THEN** the frontend redirects to forbidden UX

#### Scenario: Unknown registry or analytics identifier
- **WHEN** analytics APIs return `404` for unknown `event_id` or `metric_id`
- **THEN** the frontend shows a deterministic not-found analytics state

#### Scenario: Invalid filter request
- **WHEN** analytics APIs return `400`
- **THEN** the frontend shows a deterministic validation error state without app crash
