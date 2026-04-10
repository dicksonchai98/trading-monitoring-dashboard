# Market Thermometer Spot Latest Integration Design (2026-04-10)

## Goal

Replace Market Thermometer page mock stock panels with real-time `spot_latest_list` data from SSE, and simplify card content to only show symbol + latest price + change numbers with high/low color emphasis.

## Confirmed Decisions

1. Data source is frontend realtime store `spotLatestList` (from SSE `spot_latest_list`).
2. Remove page-level mock generators and sparkline visuals from Market Thermometer page.
3. Render list via loop over real symbols that currently have numeric `last_price`.
4. Card content keeps only:
   - stock symbol
   - last price
   - `price_chg`
   - `pct_chg`
5. Color rule:
   - `is_new_high == true` -> red tone
   - `is_new_low == true` -> green tone
   - otherwise neutral
6. Extend backend spot state + serving payload to include `price_chg` and `pct_chg` from Shioaji tick.
7. Extend frontend schema/types to accept `price_chg`, `pct_chg`, `is_new_high`, `is_new_low`.

## Current Problems

1. `MarketThermometerPage` is static mock content and does not reflect real spot SSE data.
2. Spot list currently does not carry `price_chg` / `pct_chg` through full backend->frontend path.
3. High/low highlight fields exist in backend worker state but are not guaranteed in frontend schema/presentation.

## Target Architecture

### 1. Backend Ingestion

- In spot ingestion (`market_ingestion.runner`), extract and preserve:
  - `price_chg`
  - `pct_chg` (and common aliases if needed)
- Include them in spot event payload written to Redis stream.

### 2. Latest State Worker

- In `latest_state.runner`, when consuming spot stream entries:
  - persist `price_chg`, `pct_chg` in symbol latest state
  - keep `is_new_high`, `is_new_low` updates as source of card tone
- Continue writing to `{env}:state:spot:{symbol}:latest`.

### 3. Serving / SSE

- In `serving_store.fetch_spot_latest_list`, include in each item:
  - `price_chg`
  - `pct_chg`
  - `is_new_high`
  - `is_new_low`
- Keep fixed registry order and null fallbacks for missing states.

### 4. Frontend Realtime Contract

- Extend `SpotLatestListSchema` and inferred types with new fields.
- Existing realtime manager/store flow remains unchanged:
  - parse -> batch -> `state.spotLatestList`.

### 5. Market Thermometer UI

- Remove mock panel builders and sparkline rendering.
- Derive render list from `useSpotLatestList()` by filtering `last_price` finite values.
- Render simple card list with symbol + last price + change numbers.
- Apply card tone by `is_new_high` / `is_new_low` rules.

## Data Contract Delta

Per `spot_latest_list.items[]` adds/uses:

```json
{
  "symbol": "2330",
  "last_price": 612.0,
  "price_chg": 5.0,
  "pct_chg": 0.82,
  "is_new_high": false,
  "is_new_low": false
}
```

## Error Handling and Fallbacks

1. If `last_price` is null/non-numeric, item is not rendered in Market Thermometer list.
2. If `price_chg` / `pct_chg` missing, UI shows placeholder (`--`) but card still renders.
3. If both `is_new_high` and `is_new_low` are false/missing, use neutral style.
4. If SSE temporarily drops, page keeps last known store snapshot.

## Testing Strategy

### Backend

1. Ingestion unit tests:
   - verify spot payload carries `price_chg` and `pct_chg`.
2. Latest-state worker tests:
   - verify fields are persisted in latest state key.
3. Serving store tests:
   - verify `fetch_spot_latest_list` includes new fields and null fallback shape.

### Frontend

1. Realtime schema/manager tests:
   - verify `spot_latest_list` with new fields parses and stores correctly.
2. Market Thermometer page tests:
   - renders only items with numeric `last_price`
   - symbol/last price/change values visible
   - color branch for `is_new_high` and `is_new_low`
   - no sparkline/mock block remains.

## Acceptance Criteria

1. Market Thermometer no longer uses local mock stock panel data.
2. Page list is driven by realtime `spotLatestList` store data.
3. Only symbol + last price + change numbers are shown per card.
4. Card background/label tone follows `is_new_high` red, `is_new_low` green.
5. Backend->SSE->frontend contract includes `price_chg` and `pct_chg`.
6. Tests pass for updated backend and frontend paths.
