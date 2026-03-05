## 1. Serving API Surface

- [ ] 1.1 Identify serving module boundaries and route grouping in the FastAPI app
- [ ] 1.2 Add REST endpoints for intraday and history reads backed by Redis/Postgres state
- [ ] 1.3 Add SSE endpoint to stream latest state updates

## 2. Data Access and State Reads

- [ ] 2.1 Implement Redis state read helpers for current and intraday series
- [ ] 2.2 Implement Postgres history read helpers for KBar history ranges
- [ ] 2.3 Add response schema normalization for time formats (epoch ms or ISO)

## 3. SSE Polling and Throttling

- [ ] 3.1 Implement polling loop with configurable interval
- [ ] 3.2 Add state change detection to avoid pushing unchanged data
- [ ] 3.3 Add heartbeat event handling and reconnect-safe behavior
- [ ] 3.4 Define SSE behavior during Redis/DB outages (heartbeat or disconnect)

## 4. Security and Rate Limiting (MVP)

- [ ] 4.1 Add simple bearer token auth guard for external endpoints
- [ ] 4.2 Configure CORS allowlist for external consumers
- [ ] 4.3 Add basic rate limiting for REST and SSE connection limits

## 5. Observability and Ops

- [ ] 5.1 Add minimal metrics: REST latency, active SSE connections, SSE push rate
- [ ] 5.2 Track Redis/DB error counts for serving paths
- [ ] 5.3 Add basic health checks for serving dependencies
- [ ] 5.4 Ensure metrics exposure endpoint is available to operators
