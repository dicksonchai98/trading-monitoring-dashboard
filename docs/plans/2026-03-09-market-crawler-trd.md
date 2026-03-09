# Market Crawler Technical Requirements Document (TRD)

| Field | Value |
| --- | --- |
| Version | v1.0 |
| Status | Draft |
| Owner | Engineering |

## References
- `docs/plans/2026-03-09-market-crawler-design.md`
- `docs/plans/2026-03-08-batch-shared-infrastructure-design.md`
- `docs/plans/2026-03-08-batch-shared-infrastructure-trd.md`

---

## 1. Purpose

This document defines the technical implementation details of the Market Crawler service.

The service is implemented as a layered batch pipeline inside one dedicated crawler worker process.

Layering model:

```text
Job Orchestrator
-> Fetcher
-> Parser
-> Normalizer
-> Validator
-> Persistence
```

This document specifies:
- module structure
- dataset registration model
- runtime execution flow
- repository interfaces
- table design
- trigger surface
- logging and metrics
- retry and failure behavior

## 2. Deployment Model

Crawler must run in its own worker process.

Recommended deployment units:
- api
- backfill-worker
- crawler-worker

The crawler worker shares codebase and batch shared infrastructure with other batch services, but executes independently.

## 3. Module Structure

Recommended module layout:

```text
backend/
  modules/
    batch_data/
      market_crawler/
        application/
        domain/
        infrastructure/
        jobs/
        registry/
        datasets/
        fetchers/
        parsers/
        normalizers/
        validators/
        repositories/
```

## 4. Module Responsibilities

### 4.1 application/

Use cases and orchestration entrypoints.

Examples:
- run_crawler_job.py
- run_crawler_backfill.py
- rerun_failed_crawler_job.py

Responsibilities:
- accept job input
- call orchestrator
- return execution result

### 4.2 domain/

Domain contracts and DTOs.

Examples:
- dataset_definition.py
- crawler_job_params.py
- parsed_row.py
- normalized_record.py
- validation_result.py

Responsibilities:
- define internal crawler contracts
- isolate shape of data passed between layers

### 4.3 infrastructure/

Technical integrations.

Examples:
- HTTP client
- file reader
- config loader
- date utility
- source-specific transport helper

### 4.4 jobs/

Concrete job execution implementations.

Examples:
- daily_dataset_job.py
- single_date_job.py
- date_range_backfill_job.py

Responsibilities:
- define job entry behavior
- map job input into orchestrator call

### 4.5 registry/

Runtime registries.

Examples:
- dataset_registry.py
- parser_registry.py
- normalizer_registry.py
- validator_registry.py

Responsibilities:
- load and validate dataset configs
- resolve parser / normalizer / validator names
- provide lookup by dataset_code

### 4.6 datasets/

Dataset YAML configuration files.

Recommended structure:

```text
datasets/
  taifex/
    institution_open_interest.yaml
    top5_top10.yaml
    put_call_ratio.yaml
```

Management model:
- one dataset = one YAML file
- YAML contains config only
- parser / normalizer / validator are code modules

### 4.7 fetchers/

Fetcher implementations.

Examples:
- http_fetcher.py
- download_fetcher.py

Responsibilities:
- issue requests
- return raw payload
- attach metadata such as status code or content type if needed

### 4.8 parsers/

Source-format parsers.

Examples:
- html_table_parser.py
- csv_parser.py
- xls_parser.py

Parser outputs parsed rows, not normalized records.

### 4.9 normalizers/

Dataset-specific normalization logic.

Examples:
- taifex_institution_open_interest_normalizer.py
- taifex_top5_normalizer.py

Responsibilities:
- map source field names to canonical names
- convert values to internal types
- emit normalized records

### 4.10 validators/

Validation logic.

Examples:
- base_validator.py
- taifex_institution_open_interest_validator.py

Responsibilities:
- validate normalized records
- return validation result and error details

### 4.11 repositories/

Database persistence.

Examples:
- crawler_job_repository.py
- crawler_dataset_repository.py
- market_open_interest_daily_repository.py

Responsibilities:
- write crawler job records
- persist dataset data
- update progress and status

## 5. Dataset Configuration Schema

Each dataset YAML should define:

```text
dataset_code:
dataset_name:
source_name:
enabled:

source:
  fetch_mode:
  method:
  endpoint_template:
  request_headers:
  request_params:
  response_format:
  encoding:

schedule:
  schedule_type:
  schedule_cron:
  expected_publication_time:
  retry_policy:
    max_attempts:
    retry_interval_minutes:

pipeline:
  parser:
  parser_version:
  normalizer:
  validator:

storage:
  table:
  write_mode:
  primary_key:
```

Notes:
- parser / normalizer / validator are symbolic names resolved through registries
- complex logic must not live in YAML
- one dataset config file corresponds to one logical dataset

### 5.1 MVP Dataset Fixed Configuration (institution_open_interest)

The first MVP dataset must use:
- `dataset_code`: `taifex_institution_open_interest_daily`
- `source_name`: `taifex_data_gov`
- `source.endpoint_template`: `https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate`
- `source.method`: `GET`
- `source.response_format`: `csv`
- `schedule.expected_publication_time`: `13:45-16:15 Asia/Taipei`
- `schedule.retry_policy.max_attempts`: `3` for immediate scheduled retries
- delayed publication compensation: every 15 minutes from `13:50` to `18:00`, plus one delayed retry at `T+1 08:30`

## 6. Dataset Registration Flow

Worker startup registration flow:

```text
scan datasets directory
-> load yaml files
-> validate config schema
-> ensure dataset_code uniqueness
-> register config into DatasetRegistry
-> validate parser / normalizer / validator references
-> mark worker ready
```

Failure in dataset registration must fail worker startup fast.

## 7. Runtime Sequence

### 7.1 Single-Date Job Sequence

```text
receive job request
-> create crawler job record
-> mark RUNNING
-> load dataset config from registry
-> build request from config
-> fetch raw payload
-> parse payload into parsed rows
-> normalize parsed rows
-> validate normalized records
-> persist records in transaction
-> update job progress
-> mark COMPLETED
```

### 7.2 Retry Sequence

```text
execute stage
-> recoverable error occurs
-> increment retry_count
-> wait according to retry policy
-> rerun stage
-> mark FAILED if retry exhausted
```

Retry is mainly applied to fetch stage and other transient operations.

## 8. Job Orchestrator Technical Responsibilities

Orchestrator implementation should:
- accept dataset_code, target date, and trigger type
- load dataset config
- create job row in crawler_jobs
- call fetcher, parser, normalizer, validator, repository in order
- capture stage-level errors
- write final status and counts

Recommended orchestrator interface:

```text
run(dataset_code: str, target_date: date, trigger_type: str) -> CrawlerJobResult
```

For range backfill:

```text
run_range(dataset_code: str, start_date: date, end_date: date, trigger_type: str)
```

Range backfill execution model for MVP:
- one range trigger creates one parent job id / correlation id
- `run_range` decomposes into per-date `run` calls
- one date = one persistence transaction boundary
- rerun and failure recovery operate at per-date granularity

## 9. Data Contracts Between Layers

### 9.1 Fetcher Output

```text
FetchedPayload:
  content: str | bytes
  content_type: str
  fetched_at: datetime
  source_url: str
```

### 9.2 Parser Output

```text
ParsedRow:
  raw_fields: dict[str, Any]
```

### 9.3 Normalizer Output

```text
NormalizedRecord:
  dataset_code: str
  data_date: date
  market_code: str
  instrument_code: str
  entity_code: str
  payload: dict[str, Any]
```

payload may later be expanded into typed DTOs for dataset-specific repositories.

### 9.4 Validation Output

```text
ValidationResult:
  is_valid: bool
  errors: list[str]
  normalized_records: list[NormalizedRecord]
```

## 10. Database Schema

### 10.1 crawler_jobs

Purpose:
- track execution of crawler jobs

Fields:
- id
- parent_job_id
- correlation_id
- job_type
- dataset_code
- target_date
- range_start
- range_end
- trigger_type
- status
- retry_count
- rows_fetched
- rows_normalized
- rows_persisted
- error_stage
- error_message
- created_at
- started_at
- finished_at

Indexes:
- (dataset_code, target_date)
- (status)
- (created_at)

### 10.2 crawler_raw_payloads

Optional table reserved for future use.

Fields:
- id
- job_id
- dataset_code
- target_date
- source_name
- content_type
- payload_text
- payload_hash
- fetched_at

This table may remain unused in MVP if raw payload storage is disabled.

### 10.3 market_open_interest_daily

Initial wide table for MVP dataset.

Suggested fields:
- id
- data_date
- market_code
- instrument_code
- entity_code
- long_trade_oi
- short_trade_oi
- net_trade_oi
- long_trade_amount_k
- short_trade_amount_k
- net_trade_amount_k
- long_open_interest
- short_open_interest
- net_open_interest
- long_open_interest_amount_k
- short_open_interest_amount_k
- net_open_interest_amount_k
- source
- parser_version
- ingested_at

Suggested uniqueness:
- (data_date, market_code, instrument_code, entity_code, source)

## 11. Transaction Strategy

Recommended transaction unit:
- one dataset
- one target date
- one persistence batch

Do not wrap large date-range backfill into one giant transaction.

Range backfill should be processed per date or per safe chunk.

## 12. Retry Strategy

Recommended retry policy for MVP:
- max attempts: 3
- interval: 15 minutes for delayed publication case
- exponential backoff for network failures

Retryable errors:
- timeout
- temporary connection failure
- transient HTTP 5xx
- publication-not-ready condition if explicitly supported

Non-retryable errors:
- parser mapping error
- invalid schema
- DB schema mismatch
- validation failure caused by code or source layout breakage

Retry precedence and counting rules:
- each scheduled trigger execution is one run context
- in one run context, transient fetch errors may retry up to max attempts (3)
- publication-window schedule (`13:50` to `18:00` + `T+1 08:30`) defines when new run contexts are created
- max-attempt counter is per run context, not global across the full publication window

Publication readiness classification rules (MVP):
- classify as `publication_not_ready` when fetch succeeds but source payload is not yet published/complete for target date
- candidate signals include: empty CSV body, header-only CSV, explicit "no data yet" marker, or parsed row count below dataset minimum
- classify as `source_format_error` when payload format is broken (unexpected columns, parse failure, encoding break)
- classification logic must be deterministic and dataset-specific in validator rules

## 13. Logging Specification

Each crawler execution stage should emit structured logs.

Required fields:
- job_id
- dataset_code
- target_date
- execution_stage
- status
- duration_ms
- rows_fetched
- rows_normalized
- rows_persisted
- retry_count
- error_message

Stages include:
- FETCH
- PARSE
- NORMALIZE
- VALIDATE
- PERSIST
- FINALIZE

## 14. Metrics Specification

Recommended metrics:
- crawler_job_duration_seconds
- crawler_job_failures_total
- crawler_rows_fetched_total
- crawler_rows_normalized_total
- crawler_rows_persisted_total
- crawler_retry_count_total
- crawler_stage_duration_seconds

Recommended tags / labels:
- dataset_code
- source_name
- job_type
- status

## 15. API / Trigger Surface

Protected admin endpoints may include:
- POST /admin/crawler/run
- POST /admin/crawler/backfill
- GET /admin/crawler/jobs
- GET /admin/crawler/jobs/{job_id}

Behavior:
- endpoint creates or queries jobs
- crawler execution does not run inline inside the request thread
- backend RBAC must protect these endpoints
- `POST /admin/crawler/backfill` returns parent job id / correlation id for range-level progress queries

## 16. Failure Handling Rules

### 16.1 Fetch Failure
- apply retry if recoverable
- mark FAILED if retry exhausted

### 16.2 Parse Failure
- mark FAILED
- include parser version and dataset_code in logs

### 16.3 Normalize Failure
- mark FAILED
- record first representative error and row sample if allowed

### 16.4 Validate Failure
- mark FAILED
- do not persist invalid records unless a future partial-accept policy is introduced

### 16.5 Persist Failure
- rollback transaction
- mark FAILED
- allow rerun after fix
