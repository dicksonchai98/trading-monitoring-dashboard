# Domain PRD: Indicator and Realtime Delivery

- Domain: Indicator & Realtime Delivery
- Version: v1.0
- Date: 2026-02-16
- Parent: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain Goal
Consume normalized stream events, compute near-month futures snapshot, persist minimal state, and deliver realtime updates to frontend via SSE.

## 2. In Scope (MVP)
1. Consumer group read from `stream:near_month_txf`.
2. Minimal snapshot computation.
3. Write snapshot to Postgres and Redis latest cache.
4. SSE push every 1 second from Redis latest cache.

## 3. Out of Scope (MVP)
1. Complex multi-factor analytics.
2. WebSocket transport.
3. Historical large-scale aggregation.

## 4. Public Interfaces
1. Internal compute function
- Input: `TickEvent`
- Output: `Snapshot`

2. SSE endpoint
- `GET /realtime/near-month`

## 5. Processing Rules
1. Consumer must ack successful messages.
2. Failed messages must be retried and then dead-lettered.
3. Compute failure on one event must not stop the whole consumer.

## 6. Failure Modes
1. Consumer lag growth.
- Action: alert and scale consumer workers when needed.

2. Redis unavailable.
- Action: fail fast with retry strategy; keep metrics and logs.

## 7. Observability
1. Stream lag.
2. Compute latency.
3. SSE active connections.
4. SSE publish failure rate.

## 8. Test Scenarios
1. Tick event generates expected snapshot.
2. Dead-letter flow after repeated failures.
3. SSE returns timely data with expected payload shape.
4. 200-connection baseline behaves within expected limits.

## 9. Acceptance Criteria
1. Snapshot updates are visible in frontend every second.
2. Consumer flow survives intermittent failures.
3. Dead-letter mechanism receives repeatedly failing events.
