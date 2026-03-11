# Historical Backfill Job Design (2026-03-08)

Reference: `docs/plans/2026-03-08-historical-backfill-job-trd.md`
## 1. Design Overview
Build an admin-triggered historical backfill job that runs as a background batch service. It reuses the ingestion pipeline's core data model but bypasses Redis Streams and the realtime indicator flow. The job fetches historical market data (1-minute bars), transforms it into the unified bar schema, and writes directly to PostgreSQL.

## 2. System Architecture

### Realtime pipeline
Shioaji WS -> Ingestor -> Redis Streams -> Aggregator -> PostgreSQL

### Historical pipeline
Shioaji Historical API -> Historical Backfill Job -> PostgreSQL

The historical pipeline writes to the same `market_1m_bars` table as realtime data, using upsert semantics.

## 3. Execution Model
- The job executes asynchronously as a background batch process.
- Historical API fetch and DB writes are performed per chunk (date-based).
- API request returns immediately with a job id; work is done by background workers.

## 4. Internal Module Design

Backfill service modules:
- Job Controller
- Range Chunker
- Historical Fetcher
- Bar Transformer
- PostgreSQL Writer

### 4.1 Job Controller
Responsibilities:
- Accept job requests
- Manage lifecycle state
- Aggregate progress and errors

### 4.2 Range Chunker
Responsibilities:
- Split date range into daily chunks
- Control concurrency and retries
- Coordinate DB write boundaries

Example:
- 2024-01-01 ~ 2024-12-31 -> 365 daily chunks

### 4.3 Historical Fetcher
Responsibilities:
- Call Shioaji historical API
- Retry on transient failures
- Return raw historical data

### 4.4 Bar Transformer
Responsibilities:
- Map raw data into normalized schema

Output fields:
- symbol
- bar_time
- open
- high
- low
- close
- volume
- source

### 4.5 PostgreSQL Writer
Responsibilities:
- Write to PostgreSQL with upsert

SQL example:
```sql
INSERT INTO market_1m_bars (...)
ON CONFLICT (symbol, bar_time)
DO UPDATE SET ...;
```

## 5. Database Schema

### Table: `market_1m_bars`
Fields:
- symbol: instrument code
- bar_time: bar timestamp
- open
- high
- low
- close
- volume
- source: data source
- created_at
- updated_at

Unique key:
- (symbol, bar_time)

### Table: `historical_backfill_jobs`
Fields:
- job_id
- symbol
- start_time
- end_time
- status
- rows_written
- error_message
- created_at
- finished_at

## 6. Shared Infrastructure
Shared components and cross-service infrastructure are defined in:
- `docs/plans/2026-03-08-batch-shared-infrastructure-design.md`

## 6.1 Shioaji Session Alignment (with Market Ingestion)
Shioaji login + API key alignment with market ingestion:
- Reuse the existing `ShioajiClient` wrapper from `app/market_ingestion/shioaji_client.py` to keep the login contract consistent.
- Credentials and mode MUST use the same env vars as ingestion:
  - `SHIOAJI_API_KEY`
  - `SHIOAJI_SECRET_KEY`
  - `SHIOAJI_SIMULATION`
- Login flow should follow the ingestion sequence:
  - `api.login(api_key=..., secret_key=..., fetch_contract=False)`
  - `api.fetch_contracts(contract_download=True)` when historical calls need contract context

Implementation note:
- Shared factory lives in `app/services/shioaji_session.py` (`build_shioaji_api()` / `build_shioaji_client()`). Backfill should use this to share credentials and session setup with ingestion.

## 7. Failure Handling
- Retry per chunk up to N times
- On permanent failure, mark job status as `failed`
- Log failure details for audit and debugging

## 8. Future Extensions
- Automatic gap detection
- Scheduled backfill
- Multi-symbol backfill
- Multiple data vendors
- Data validation pipeline
