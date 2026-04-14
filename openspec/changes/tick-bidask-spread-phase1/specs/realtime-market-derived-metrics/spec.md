## ADDED Requirements

### Requirement: Tick amplitude fields SHALL be produced and persisted
The system SHALL compute `amplitude = high - low` and `amplitude_pct = (high - low) / open` from the current 1-minute bar and include these fields in tick realtime state and persisted minute bars.

#### Scenario: Tick minute update writes amplitude fields
- **WHEN** a valid tick event updates a current minute bar
- **THEN** the worker writes `amplitude` and `amplitude_pct` into `{env}:state:{code}:{trade_date}:k:current` and minute archive payloads.

#### Scenario: Tick minute rollover persists amplitude fields
- **WHEN** the minute rolls over and the archived bar is persisted
- **THEN** `kbars_1m` row includes `amplitude` and `amplitude_pct` values for that bar.

### Requirement: Bidask main force metric SHALL be produced with day-range strength
The system SHALL compute `main_force_big_order = total_bid_volume - total_ask_volume`, maintain intraday high/low, and produce strength as `(value - day_low)/(day_high - day_low)` clamped to `[0,1]` with `0.5` when `day_high == day_low`.

#### Scenario: Bidask latest metrics include main force family fields
- **WHEN** a valid bidask event is consumed
- **THEN** latest metrics payload contains `main_force_big_order`, `main_force_big_order_day_high`, `main_force_big_order_day_low`, and `main_force_big_order_strength`.

#### Scenario: Bidask persistence stores main force fields in payload
- **WHEN** bidask metrics are persisted for historical access
- **THEN** phase-1 persistence stores the main-force family fields in `bidask_metrics_1s.metric_payload`.

### Requirement: Spread SHALL be computed from market event and futures latest state
The system SHALL compute `spread = futures_price - index_value` in market summary updates using futures latest state source contract: `futures_code = AGGREGATOR_CODE`, state key `{env}:state:{futures_code}:{trade_date}:k:current`, field `close`.

#### Scenario: Spread computed when futures latest is fresh
- **WHEN** market summary processes an event and futures latest value is available within freshness threshold
- **THEN** snapshot includes `futures_code`, `futures_price`, `spread`, `spread_day_high`, `spread_day_low`, `spread_strength`, and `spread_status = ok`.

#### Scenario: Spread marked stale when futures latest is missing or old
- **WHEN** futures latest state is missing, invalid, or older than the configured freshness threshold
- **THEN** snapshot writes spread family numeric fields as `null` and sets `spread_status = stale_or_missing_futures`.

### Requirement: Payload compatibility SHALL be backward-safe
The system SHALL keep existing Redis key names and only extend payload fields so existing consumers that ignore unknown fields continue functioning.

#### Scenario: Existing key topology remains unchanged
- **WHEN** phase-1 features are enabled
- **THEN** workers continue writing to existing key patterns and do not rename state keys.

#### Scenario: Serving layer returns extended payload without breaking old consumers
- **WHEN** serving endpoints read Redis/DB state containing new fields
- **THEN** responses include extended fields while preserving existing fields and endpoint contracts.
