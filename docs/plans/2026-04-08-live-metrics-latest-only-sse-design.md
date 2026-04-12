# Live Metrics Latest-Only SSE Mapping Design

Date: 2026-04-08  
Status: Approved

## 1. Goal

Wire four metrics into `LIVE METRICS` on frontend and show latest values only (no intraday history rendering):

- 振幅 -> `day_amplitude` (tick)
- ?估量 -> `estimated_turnover` (market summary)
- 价差 -> `spread` (market summary)
- 主力大? -> `main_force_big_order_strength` (bidask)

## 2. Scope

In scope:
- Frontend realtime event/schema/store extension for `market_summary_latest`.
- Frontend `LIVE METRICS` binding from realtime store to latest-value cards.
- Missing-value behavior: keep last valid value per field.

Out of scope:
- New backend endpoint or transport.
- Historical charts for these 4 fields.
- Recomputing backend metrics on frontend.

## 3. Architecture Decision

Use existing authenticated SSE stream (`/v1/stream/sse`) as the single realtime source.

Required event-to-field mapping:
- `kbar_current.day_amplitude`
- `market_summary_latest.spread`
- `market_summary_latest.estimated_turnover`
- `metric_latest.main_force_big_order_strength`

Why:
- Already aligned with backend event model.
- No additional polling load.
- Meets "latest only" requirement directly.

## 4. Data Flow

1. SSE manager receives `kbar_current`, `metric_latest`, `market_summary_latest`.
2. Each payload is validated by Zod schema.
3. Realtime Zustand store upserts latest payload by code.
4. `LIVE METRICS` reads store selectors and formats display values.
5. Per-field sticky fallback applies when new payload omits a field.

## 5. UI Behavior

### 5.1 Latest-only rendering

`LIVE METRICS` displays only current card values for the four metrics.
No time-series arrays and no historical panel behavior in this block.

### 5.2 Missing value policy

- Before first valid sample: show `--`.
- After at least one valid sample: if a later payload has `null/undefined`, keep the previous valid value for that metric.
- Fallback is per metric field and independent across fields.

### 5.3 Formatting

- `day_amplitude`, `spread`: fixed 2 decimals.
- `estimated_turnover`: grouped integer display.
- `main_force_big_order_strength`: percentage display from `[0,1]` value.

## 6. Error Handling

- Invalid SSE payload: ignore event, keep stream alive (existing rule).
- Unknown/missing field in payload: keep prior valid field value if present.
- No backend contract change in this phase.

## 7. Testing Plan

- Schema tests for newly accepted fields/events.
- SSE manager tests for `market_summary_latest` ingestion and store update.
- `LIVE METRICS` component tests for:
  - initial `--`
  - correct mapping after valid payloads
  - sticky fallback behavior on missing values
  - latest-only (no history series rendering)

## 8. Acceptance Criteria

- Four cards in `LIVE METRICS` show mapped values from realtime sources.
- `spread` and `estimated_turnover` update from `market_summary_latest` event.
- `day_amplitude` updates from `kbar_current`.
- `main_force_big_order_strength` updates from `metric_latest`.
- Missing values keep last valid value per field.
- No historical data display in this block.
