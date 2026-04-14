# TXF Order Flow Realtime Integration Design (2026-04-08)

## 1. Goal

Integrate real backend data into the dashboard `MARKET OVERVIEW > Order Flow` card for `TXF` using a two-stage flow:

1. Load today's intraday baseline data first.
2. Continue with live updates via SSE.

The chart must keep the existing frontend visual type and only replace mock data with real data.

## 2. Confirmed Scope

In scope:

- Instrument code fixed to `TXF`.
- Time window fixed to "today intraday only" (from session start to now).
- Only `Order Flow` card is wired in this phase.
- Both series in `Order Flow` follow the same data strategy:
  - baseline from REST
  - then incremental updates from SSE

Out of scope:

- Other `MARKET OVERVIEW` cards.
- Symbol switching UI.
- Date-range selector.
- Backend API changes.

## 3. Inputs and Contracts

### 3.1 REST baseline

- `GET /v1/kbar/1m/today?code=TXF`
- `GET /v1/metric/bidask/today?code=TXF`

### 3.2 SSE incremental updates

- `GET /v1/stream/sse?code=TXF`
- Existing events used:
  - `kbar_current`
  - `metric_latest`
  - `heartbeat` (connection health only)

### 3.3 Series mapping for Order Flow

- Price line (index line): minute `close` from `kbar`.
- Flow line/bar source: `main_force_big_order` from bidask metrics.
- Per-minute alignment rule: use the **last bidask sample in each minute**.

## 4. Architecture

Keep the current app-level realtime topology:

- `RealtimeBootstrap` keeps one SSE connection for the app.
- `realtime-manager` keeps parsing/validation/reconnect behavior.
- `realtime.store` remains the single source for live SSE payload cache.

Add a reusable data layer in dashboard feature (TXF + today only for now):

- `features/dashboard/api/market-overview.ts`
  - Fetches baseline REST payloads.
- `features/dashboard/lib/market-overview-mapper.ts`
  - Converts and aligns baseline + incremental payloads into chart points.
- `features/dashboard/hooks/use-market-overview-timeline.ts`
  - Orchestrates:
    - initial baseline fetch
    - subscription to realtime store changes
    - minute-level merge without full re-compute

`OrderFlowChart` consumes processed timeline points only (render-only component).

## 5. Data Flow

### 5.1 Initial load

1. Dashboard page enters.
2. Hook loads `kbar today` and `bidask today` in parallel for `TXF`.
3. Mapper groups data by minute.
4. For each minute:
   - set `indexPrice` from kbar close
   - set `chipDelta` from latest `main_force_big_order` in that minute
5. Chart renders baseline timeline.

### 5.2 Realtime updates

1. App-level SSE receives `kbar_current`/`metric_latest`.
2. Realtime store updates current values.
3. Order-flow hook listens selected `TXF` slices from realtime store.
4. Hook patches only the affected minute point:
   - `kbar_current` updates minute price
   - `metric_latest.main_force_big_order` updates minute chip value
5. Chart updates incrementally.

## 6. Validation and Fault Tolerance

- Extend frontend metric schema/type to include optional `main_force_big_order`.
- Invalid SSE payloads remain ignored (existing rule).
- If a minute has kbar but no bidask value yet, `chipDelta` defaults to `0`.
- If both dimensions are unavailable for a minute, no chart point is emitted.
- SSE disconnect behavior keeps existing reconnect strategy and preserves last rendered data.

## 7. Testing Strategy

Unit:

- Mapper minute alignment:
  - bidask same-minute multiple samples -> last one wins.
  - missing bidask minute -> `chipDelta = 0`.
- Realtime event parse/store:
  - `metric_latest.main_force_big_order` survives validation and enters store.

Hook/component:

- Hook builds baseline from REST responses for `TXF`.
- Hook applies incremental SSE updates to the current minute only.
- `OrderFlowChart` renders from real hook data instead of generated mock series.

Regression:

- Existing dashboard page section rendering tests remain passing.
- Existing SSE chart section behavior remains unchanged.

## 8. Rollout Notes

- This phase is additive and frontend-only.
- No backend contract change required.
- Subsequent cards can reuse the same timeline/api/mapper layer in later phases.
