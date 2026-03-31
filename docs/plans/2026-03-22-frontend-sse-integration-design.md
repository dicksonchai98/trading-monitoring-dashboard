# Frontend SSE Integration Design (Phase 1 MVP)

## 1. Purpose

This document defines the Phase 1 MVP design for frontend SSE integration, aligned with current backend implementation.

Frontend stack:
- React
- Zod
- Zustand
- React Query

Backend stack:
- FastAPI
- SSE endpoint in `apps/backend/app/routes/serving.py`

Primary goal:
- Establish a shared, backend-aligned realtime stream contract and frontend management model.

Important boundary for this phase:
- Do not wire stream data into specific pages/features yet (deferred to next phase).

---

## 2. Scope

Phase 1 MVP includes:
- One shared SSE connection manager for frontend app scope.
- Backend contract alignment for event names and payload shape.
- Zod validation model for actual backend events.
- Zustand store shape for realtime cache and connection status.
- Basic reconnect/error strategy design.

Phase 1 MVP does not include:
- Page-level stream rendering integration.
- Per-widget/per-page selectors and optimization rollout.
- Advanced reconnect/backoff strategy tuning.
- Symbol-level dynamic subscription.

---

## 3. Design Goals

1. Reuse one SSE connection across dashboard surfaces.
2. Keep realtime state centralized and easy to consume.
3. Align frontend model with backend event contract exactly.
4. Defer UI integration work cleanly to next phase.

---

## 4. High-Level Architecture

```text
FastAPI REST API  -> React Query snapshot baseline
FastAPI SSE API   -> SSE Manager -> Zod validation -> Zustand realtime state -> UI hooks
```

Responsibility split:
- React Query:
  - Fetch initial snapshot/current state via REST.
- SSE Manager:
  - Own connection lifecycle.
  - Parse SSE event frames.
  - Validate/normalize payloads.
  - Write latest values to store.
- Zustand:
  - Store connection status.
  - Store latest `kbar_current`, `metric_latest`, and heartbeat timestamp.

---

## 5. Data Flow

Initial load:
1. Page loads.
2. React Query fetches snapshot/current REST data.
3. UI renders snapshot.
4. Shared SSE manager starts or reuses connection.

Realtime update:
1. SSE message received.
2. Parse event name + JSON payload.
3. Validate with Zod.
4. Write normalized data to Zustand.
5. UI consumes latest state through selector hooks.

---

## 6. Actual SSE Event Model (Backend-Aligned)

Source of truth endpoint:
- `GET /v1/stream/sse`

Backend currently emits:
1. `kbar_current`
2. `metric_latest`
3. `heartbeat`

Note:
- Backend does not emit direct `tick` or `bidask` event types on `/v1/stream/sse`.

### 6.1 `kbar_current` example

```json
{
  "code": "MTX",
  "trade_date": "2026-03-22",
  "minute_ts": 1774147800000,
  "open": 19532.0,
  "high": 19540.0,
  "low": 19530.0,
  "close": 19536.0,
  "volume": 123.0
}
```

### 6.2 `metric_latest` example

```json
{
  "bid": 19535.0,
  "ask": 19536.0,
  "mid": 19535.5,
  "spread": 1.0,
  "bid_size": 10.0,
  "ask_size": 8.0,
  "event_ts": "2026-03-22T12:00:01+08:00",
  "ts": 1774152001000
}
```

Field notes:
- Numeric fields may be absent depending on upstream data availability.
- `ts` is derived by backend when `event_ts` exists.

### 6.3 `heartbeat` example

```json
{
  "ts": 1774152001000
}
```

---

## 7. State Design (Baseline for Phase 2)

### 7.1 Connection State

```ts
type SseConnectionStatus = "idle" | "connecting" | "connected" | "error";
```

### 7.2 Realtime Payload State

```ts
type RealtimeStore = {
  connectionStatus: SseConnectionStatus;
  kbarCurrentByCode: Record<string, KbarCurrentPayload>;
  metricLatestByCode: Record<string, MetricLatestPayload>;
  lastHeartbeatTs: number | null;
};
```

---

## 8. Zod Validation

All incoming payloads should be validated before entering store:
- `KbarCurrentSchema`
- `MetricLatestSchema` (optional numeric fields)
- `HeartbeatSchema`

Validation failure policy:
- Ignore invalid event.
- Log error.
- Keep stream alive.

---

## 9. SSE Connection Management

Frontend should use one global SSE manager.

Responsibilities:
- open/close stream
- handle `onopen`, `onmessage`, `onerror`
- parse SSE event frames by event name
- validate payload with Zod
- write latest state to store
- trigger reconnect on recoverable failure

Rule:
- Do not create SSE connection inside individual page components.

---

## 10. Backend Runtime Constraints to Respect

From backend config/deps/routes:
- Auth required (`Authorization: Bearer <token>`) on `/v1/stream/sse`.
- Rate limit enforced (`SERVING_RATE_LIMIT_PER_MIN`, default `120/min`).
- SSE connection limit per client (`SERVING_SSE_CONN_LIMIT`, default `3`).
- Poll interval (`SERVING_POLL_INTERVAL_MS`, default `1000ms`, floor `50ms`).
- Heartbeat interval (`SERVING_HEARTBEAT_SECONDS`, default `15s`).
- `kbar_current` and `metric_latest` are pushed on change only.

---

## 11. Critical Integration Decision (Before Phase 2)

Current backend requires Bearer auth header for SSE.

Browser-native `EventSource` cannot attach custom Authorization headers, so Phase 2 must decide one of:
1. Use a header-capable SSE client (recommended), e.g. fetch-based SSE.
2. Change backend SSE auth transport (cookie/signed URL/session) and keep native `EventSource`.

Without this decision, authenticated frontend SSE connection cannot be implemented reliably.

---

## 12. React Query Integration Baseline

Use React Query for initial REST snapshot/current payload.

Merge rule for next phase:
- Prefer realtime value when present, fallback to snapshot otherwise.

Example:

```ts
const displayed = realtimeValue ?? snapshotValue;
```

---

## 13. Error Handling Baseline

- Invalid JSON: ignore + log, continue.
- Schema invalid: ignore + log, continue.
- SSE error/disconnect:
  - set status `error`/`retrying`
  - reconnect after fixed delay in MVP
- Auth/rate-limit failures (`401/429`):
  - surface deterministic status and stop aggressive retry loop.

---

## 14. Recommended Folder Structure

```text
src/
  features/
    realtime/
      schemas/
        serving-event.schema.ts
      services/
        realtime-manager.ts
      store/
        realtime.store.ts
      hooks/
        use-realtime-connection.ts
        use-kbar-current.ts
        use-metric-latest.ts
      types/
        realtime.types.ts
```

---

## 15. Phase Planning Summary

Phase 1 (this document):
- Contract alignment with backend actual SSE behavior.
- Realtime management baseline design.
- No page-level stream consumption implementation.

Phase 2:
- Implement manager/store/hooks.
- Wire stream data into target pages/features.
- Add integration tests and rerender/perf safeguards.
