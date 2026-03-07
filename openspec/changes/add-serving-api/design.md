## Context

The MVP needs a serving API that exposes near-month market data to external users with low-latency reads and realtime updates. The compute layer (L3) already produces state in Redis and history in Postgres; the serving layer (L4) must provide stable REST and SSE access without taking on event-stream complexity. Detailed behavior is documented in `docs/plans/2026-03-05-serving-design.md` and `docs/plans/2026-03-05-serving-trd.md`.

## Goals / Non-Goals

**Goals:**
- Provide an external serving surface (REST + SSE) backed by Redis state and Postgres history.
- Keep serving responsibilities read-only, separating compute (state generation) from delivery.
- Define MVP-level non-functional guardrails: rate limiting, availability behavior, and minimal observability.

**Non-Goals:**
- Guarantee delivery of every intermediate update (event-level completeness).
- Implement event-driven fan-out or Redis Streams consumption in MVP.
- Support multi-instrument subscription protocols or complex client routing.

## Decisions

- Use Redis state polling for SSE (L4 reads state only).
  - Alternative: consume Redis Streams and push events directly.
  - Rationale: state polling is simpler, faster to ship, and sufficient for "latest state" UI needs.

- Separate intraday reads (Redis) from historical reads (Postgres).
  - Alternative: serve all ranges from a single store.
  - Rationale: Redis provides low-latency intraday access while Postgres stores durable history.

- Provide REST + SSE as the external surface for MVP.
  - Alternative: WebSocket only.
  - Rationale: SSE is simpler for one-way updates and fits the MVP scope; WS can be optional later.

- Enforce MVP safety controls (rate limiting, basic auth token, CORS allowlist).
  - Alternative: no controls until scale issues appear.
  - Rationale: external exposure requires minimal guardrails for stability and abuse prevention.

## Risks / Trade-offs

- [Polling may skip intermediate updates] -> Accept for MVP; guarantee latest state only.
- [Redis/DB outage impacts read availability] -> Return clear errors; keep SSE heartbeat or disconnect to trigger reconnect.
- [High SSE connection count increases load] -> Per-IP concurrent connection limit; monitor active connections.
- [Inconsistent time formats across endpoints] -> Standardize on epoch ms or ISO and enforce in response schema.

## Migration Plan

- Deploy serving endpoints behind configuration flags or environment toggles.
- Roll out to a limited environment or allowlisted clients first.
- Rollback by disabling serving routes and SSE polling while keeping L3 state generation intact.

## Open Questions

- What are the default polling interval and maximum acceptable latency for SSE?
- Should SSE keep heartbeat on backend errors or close the connection to force reconnect?
- Final rate limit values (REST per IP per minute, SSE concurrent connections).
- Is a simple bearer token sufficient for external access in the MVP?
