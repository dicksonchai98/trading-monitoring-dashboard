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

Both pipelines write into the same bar table: `kbars_1m`.

Time semantics:
- Timezone baseline: `Asia/Taipei` (aligned with current realtime pipeline).
- Minute key semantics: minute start timestamp (`minute_ts`), e.g. 09:30 bar uses `09:30:00+08:00`.

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

- code
- trade_date
- minute_ts
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

INSERT INTO kbars_1m (...)
ON CONFLICT (code, minute_ts)
DO UPDATE ...

Conflict resolution policy:
- When historical and realtime rows conflict on `(code, minute_ts)`, historical backfill data overwrites realtime values.

5. Database Schema

Table: kbars_1m

Field Description
code instrument code
trade_date trade date
minute_ts bar minute timestamp (Asia/Taipei, minute-start semantics)
open open price
high high price
low low price
close close price
volume trade volume

Unique key:
(code, minute_ts)

Table: historical_backfill_jobs

Field Description
job_id job id
code instrument code
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
