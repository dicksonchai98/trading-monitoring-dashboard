## ADDED Requirements

### Requirement: Fixed MVP TAIFEX Source Contract
The system SHALL use the TAIFEX open-data endpoint for the first crawler dataset:
`https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate`.

#### Scenario: MVP dataset execution starts
- **WHEN** dataset code `taifex_institution_open_interest_daily` is executed
- **THEN** the fetcher SHALL request the fixed TAIFEX endpoint using configured dataset source settings

### Requirement: Publication Window Scheduling
The system SHALL apply Taipei-time publication scheduling for the MVP dataset with retries from `13:50` to `18:00` every 15 minutes and one delayed retry at `T+1 08:30`.

#### Scenario: Data not available during first attempts
- **WHEN** a scheduled run classifies payload as `publication_not_ready`
- **THEN** subsequent scheduled retries SHALL follow configured publication windows

### Requirement: Canonical Open Interest Normalization Schema
The system SHALL normalize MVP records into `market_open_interest_daily` with canonical fields and idempotent upsert behavior.

#### Scenario: Valid CSV rows are processed
- **WHEN** parser output passes validation
- **THEN** persistence SHALL upsert rows keyed by `(data_date, market_code, instrument_code, entity_code, source)`

#### Scenario: Same date is rerun
- **WHEN** the same `dataset_code + target_date` is rerun
- **THEN** the final persisted logical rows SHALL remain deterministic without duplicates

### Requirement: MVP Open Interest Field Contract
The system SHALL persist normalized records with the following canonical fields: `data_date`, `market_code`, `instrument_code`, `entity_code`, `long_trade_oi`, `short_trade_oi`, `net_trade_oi`, `long_trade_amount_k`, `short_trade_amount_k`, `net_trade_amount_k`, `long_open_interest`, `short_open_interest`, `net_open_interest`, `long_open_interest_amount_k`, `short_open_interest_amount_k`, `net_open_interest_amount_k`, `source`, `parser_version`, and `ingested_at`.

#### Scenario: Record mapping is validated before persistence
- **WHEN** normalized records are produced from parser output
- **THEN** validator SHALL enforce presence and type compatibility for all canonical MVP fields before DB write
