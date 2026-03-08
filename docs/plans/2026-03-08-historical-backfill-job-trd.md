1. Design Overview

Historical Backfill Job

Provide a background batch job service for the ingestion pipeline.

- Fetch historical data.
- Transform into bar data (OHLCV).
- Write to PostgreSQL.

2. System Architecture

The market data system has two pipelines:

Real-time pipeline
Shioaji WS
|
v
Ingestor
|
v
Redis Streams
|
v
Aggregator
|
v
PostgreSQL

Historical pipeline
Shioaji Historical API
|
v
Historical Backfill Job
|
v
PostgreSQL

Both pipelines write into the same bar table.

3. Execution Model

Historical Backfill Job runs as a background batch job.

- Historical API fetch is async.
- DB writes are async.
- The job is not on the request path.
- The job runs in a background worker.

4. Internal Module Design

Backfill Service

- Job Controller
- Range Chunker
- Historical Fetcher
- Bar Transformer
- PostgreSQL Writer

4.1 Job Controller

- Accept job requests.
- Manage job lifecycle.
- Update job status.

4.2 Range Chunker

Split the time range into chunks, for example:

2024-01-01 ~ 2024-12-31
=
365 daily chunks

Responsibilities:

- Respect API rate limits.
- Retry failed chunks.
- Coordinate DB writes.

4.3 Historical Fetcher

- Call Shioaji historical API.
- Retry on failure.
- Return raw historical data.

4.4 Bar Transformer

Transform raw data into the bar schema:

- symbol
- bar_time
- open
- high
- low
- close
- volume
- source

4.5 PostgreSQL Writer

- Write to PostgreSQL.
- Use UPSERT.

SQL example:

INSERT INTO market_1m_bars (...)
ON CONFLICT (symbol, bar_time)
DO UPDATE ...

5. Database Schema

Table: market_1m_bars

Field Description
symbol instrument symbol
bar_time bar timestamp
open open price
high high price
low low price
close close price
volume trade volume
source data source
created_at created time
updated_at updated time

Unique key:
(symbol, bar_time)

Table: historical_backfill_jobs

Field Description
job_id job id
symbol instrument symbol
start_time start time
end_time end time
status job status
rows_written rows written
error_message error
created_at job start time
finished_at job end time

6. Shared Infrastructure

Backfill service shares infrastructure with other services:

- Config
- Shioaji client
- Database connection
- Bar model
- Repository layer
- Workflow orchestration

7. Failure Handling

- Retry failed chunks up to N times.
- If retries are exhausted, set job status to failed.
- Job failures must be isolated from realtime services.

8. Future Extensions

- Automatic gap detection.
- Scheduled backfill.
- Multi-symbol backfill.
- Multiple data vendors.
- Data validation pipeline.
