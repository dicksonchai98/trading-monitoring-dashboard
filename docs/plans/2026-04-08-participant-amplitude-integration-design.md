# 2026-04-08 Participant Amplitude Integration Design

## Context

The Participant Overview section currently uses hardcoded mock data for both the `Amplitude Summary` metrics and the `Participant Signals` chart. We need to replace this with backend-backed daily amplitude data and live intraday amplitude updates.

## Goals

- Connect Participant Overview to real daily amplitude data.
- Keep historical metrics based on closed trading days only.
- Show a live final candle for the current day using SSE amplitude fields.

## Scope

In scope:
- Extend existing daily amplitude API response to include daily OHLC and day amplitude.
- Frontend integration for:
  - Amplitude Summary metrics (5-day avg, 10-day avg, yesterday, 5-day max, 10-day max)
  - Participant Signals chart (19 closed daily candles + 1 live today candle)
- Error handling and tests for backend and frontend data flow.

Out of scope:
- Introducing new API path for daily candles.
- Persisting today realtime derived daily candle into DB in this change.
- Backfill or historical recomputation jobs.

## API Design

Endpoint: `GET /v1/kbar/1m/daily-amplitude`

Parameters:
- `code` (required)
- `n` (optional, default 19, range 1-365)

Semantics:
- Returns latest `n` closed trading days only.
- Does not include today realtime row.

Response item shape:
- `code`
- `trade_date` (`YYYY-MM-DD`)
- `open`
- `high`
- `low`
- `close`
- `day_amplitude` (= `high - low`)

Ordering:
- Backend returns descending by trade_date.
- Frontend reorders ascending before chart rendering.

## Frontend Data Flow

### 1) Historical daily source

- Fetch `n=19` closed days from daily-amplitude API.
- Build historical daily candle dataset and amplitude series.

### 2) Live today source

- Subscribe to existing SSE stream and read intraday daily amplitude from realtime payload.
- Build one synthetic "today" candle row for display (label as `MM-DD`).
- Merge: `19 closed + 1 realtime` for chart.

### 3) Summary metrics source

Summary uses closed days only:
- `5-day average amplitude`
- `10-day average amplitude`
- `yesterday amplitude`
- `5-day max amplitude`
- `10-day max amplitude`

All metrics are computed as point values (not percent).

## Participant Signals Chart Design

- Keep K-candle visual style in current chart area.
- X-axis labels use `MM-DD`.
- Render 20 items when live data is available, otherwise 19.
- Overlay amplitude line remains allowed, but moving averages for summary must be based on closed data only.

## Error Handling

- Invalid `n` -> `400` with deterministic error detail.
- No daily history -> `404`.
- DB failure -> `503`.
- Frontend fetch failure: show panel-level fallback state message.
- Missing realtime amplitude: show historical candles only (no hard failure).

## Testing Strategy

### Backend

- API route tests:
  - success response includes OHLC + amplitude
  - invalid `code` / invalid `n`
  - `404` no data
  - `503` db unavailable

### Frontend

- Hook tests:
  - transforms API rows into closed-day metric set
  - computes 5/10 avg, yesterday, 5/10 max correctly
  - merges realtime today candle when SSE payload exists
- Component tests:
  - summary values render with expected numbers
  - chart renders 19 vs 20 candles depending on realtime availability

## Rollout Notes

- Backward compatibility: existing endpoint path is preserved.
- Frontend should tolerate extra fields and missing realtime payload gracefully.
- If performance becomes a concern, daily aggregates can later be materialized into a dedicated daily table.
