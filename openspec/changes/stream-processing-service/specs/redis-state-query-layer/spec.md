## ADDED Requirements

### Requirement: Maintain current K state
The service SHALL store the current forming 1-minute K bar in a Redis hash for fast read access.

#### Scenario: Current K update
- **WHEN** a tick event updates the current minute bar
- **THEN** the Redis hash reflects the updated OHLCV values

### Requirement: Maintain intraday K series
The service SHALL store intraday 1-minute K bars in a Redis ZSET scored by Unix seconds for range queries.

#### Scenario: Intraday K append
- **WHEN** a 1-minute bar is archived
- **THEN** it is added to the intraday K ZSET with score equal to the bar minute timestamp

### Requirement: Maintain latest metrics blob
The service SHALL store latest bidask-derived metrics as a single JSON value in Redis for one-fetch UI reads.

#### Scenario: Metrics update
- **WHEN** a bidask event updates computed metrics
- **THEN** the latest metrics JSON is updated in Redis

### Requirement: Maintain per-second metric series
The service SHALL write one metric point per second to a Redis ZSET scored by Unix seconds, carrying forward the last value if no events arrive in that second.

#### Scenario: Sampling gap carry-forward
- **WHEN** a second has no bidask events
- **THEN** the metric ZSET receives a point with the previous second's value

### Requirement: Use Unix seconds for ZSET scores
The service SHALL use Unix seconds (int) for Redis ZSET scores for K bars and metric series.

#### Scenario: ZSET score format
- **WHEN** a K bar or metric point is written
- **THEN** the score is stored as Unix seconds

### Requirement: Apply TTL to intraday state
The service SHALL apply a 24-hour TTL to intraday Redis state keys and series to prevent unbounded growth.

#### Scenario: TTL set on intraday keys
- **WHEN** intraday Redis keys are created or updated
- **THEN** their TTL is set to 24 hours

### Requirement: Use metric registry with whitelist
The service SHALL compute bidask metrics via a registry and SHALL only persist series fields listed in a series_fields whitelist.

#### Scenario: Non-whitelisted metric field
- **WHEN** a computed metric is not in series_fields
- **THEN** it is excluded from metric ZSET persistence

### Requirement: Compute delta_1s from prior sample
The service SHALL compute delta_1s using the previous second's sampled value as the baseline.

#### Scenario: Delta uses previous sample
- **WHEN** the current second is sampled
- **THEN** delta_1s is computed against the prior sampled value
