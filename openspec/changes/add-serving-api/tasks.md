## 1. Serving API Surface

- [x] 1.1 Identify serving module boundaries and route grouping in the FastAPI app
- [x] 1.2 Add REST endpoints for intraday and history reads backed by Redis/Postgres state
- [x] 1.3 Add SSE endpoint to stream latest state updates

## 2. Data Access and State Reads

- [x] 2.1 Implement Redis state read helpers for current and intraday series
- [x] 2.2 Implement Postgres history read helpers for KBar history ranges
- [x] 2.3 Add response schema normalization for time formats (epoch ms or ISO)
- [x] 2.4 Resolve default code from latest stream payload when code is omitted

## 3. SSE Polling and Throttling

- [x] 3.1 Implement polling loop with configurable interval
- [x] 3.2 Add state change detection to avoid pushing unchanged data
- [x] 3.3 Add heartbeat event handling and reconnect-safe behavior
- [x] 3.4 Define SSE behavior during Redis/DB outages (heartbeat or disconnect)

## 4. Security and Rate Limiting (MVP)

- [x] 4.1 Add JWT access token auth guard for external endpoints
- [x] 4.2 Configure CORS allowlist for external consumers
- [x] 4.3 Add basic rate limiting for REST and SSE connection limits

## 5. Observability and Ops

- [x] 5.1 Add minimal metrics: REST latency, active SSE connections, SSE push rate
- [x] 5.2 Track Redis/DB error counts for serving paths
- [x] 5.3 Add basic health checks for serving dependencies
- [x] 5.4 Ensure metrics exposure endpoint is available to operators
