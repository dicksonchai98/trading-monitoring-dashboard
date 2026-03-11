# Market Crawler Design

| Field | Value |
| --- | --- |
| Version | v1.1 |
| Status | Draft |
| Owner | Engineering |
| Last Updated | 2026-03-09 |

## References
- `docs/plans/2026-02-16-futures-dashboard-design.md`
- `docs/plans/2026-03-08-historical-backfill-job-design.md`
- `docs/plans/2026-03-08-batch-shared-infrastructure-design.md`
- `docs/plans/2026-03-08-batch-shared-infrastructure-trd.md`
- `docs/plans/2026-03-09-market-crawler-trd.md`

---

## 1. Purpose

This document defines the design of the Market Crawler service.

Market Crawler is a batch pipeline that fetches low-frequency public market datasets (for example TAIFEX open data), transforms them into canonical internal records, validates quality, and persists them into PostgreSQL.

The crawler is designed for:
- historical research datasets
- backtesting support
- strategy support datasets
- supplementary analytics

The crawler is explicitly isolated from the realtime ingestion and SSE path.

## 2. Scope

### 2.1 In Scope

- scheduled crawler jobs
- admin manual rerun jobs
- date-range backfill (decomposed into per-date jobs)
- fetch, parse, normalize, validate, persist pipeline
- job lifecycle tracking
- retry and failure classification
- structured logs and metrics

### 2.2 MVP Dataset

MVP dataset is fixed to:
- TAIFEX `Market Data of Major Institutional Traders - Details of Futures Contracts By the Date`

MVP storage target:
- `market_open_interest_daily` (wide table)

### 2.3 Out of Scope

- realtime SSE output
- Redis Streams integration
- signal/factor generation
- generalized analytics warehouse
- distributed multi-node crawler orchestration

## 3. Architecture Boundary

### 3.1 Position in Platform

Existing realtime path (unchanged):

`Shioaji -> market_ingestion -> Redis Streams -> indicator_engine -> Redis/PostgreSQL -> SSE`

Crawler path (new batch path):

`Scheduler/Admin -> crawler-worker -> PostgreSQL`

### 3.2 Isolation Rules

- crawler runs in dedicated worker process
- crawler must not run on API request thread
- crawler failure must not affect realtime ingestion/SSE
- crawler does not write Redis Streams or realtime snapshot keys

Recommended process layout:

```text
api process
backfill worker process
crawler worker process
```

## 4. Runtime and Trigger Model

Crawler jobs are triggered by:
- scheduler trigger
- admin manual trigger
- admin date-range backfill trigger

All trigger surfaces only create jobs. Execution is asynchronous in crawler worker.

For date-range backfill:
- request range is split into per-date jobs
- each date is an independent idempotent execution unit
- failure and rerun happen at per-date granularity
- range trigger must create one parent job/correlation id, and all per-date jobs must reference it

## 5. Canonical Pipeline

Single canonical execution pipeline:

```text
Job Orchestrator
-> Fetcher
-> Parser
-> Normalizer
-> Validator
-> Persistence
```

Responsibilities:

- Job Orchestrator
  - manage lifecycle status
  - resolve dataset config by `dataset_code`
  - execute stages and track counts
  - classify and record failure stage
- Fetcher
  - build request from config
  - fetch raw payload with timeout/retry
  - return content + source metadata
- Parser
  - parse source format (CSV/HTML/XLS/JSON)
  - output source-shaped rows
- Normalizer
  - map source labels into canonical internal fields
  - coerce types and codes
  - attach dataset metadata
- Validator
  - validate required fields and types
  - validate uniqueness/logical consistency
  - reject malformed records before DB write
- Persistence
  - execute per-date transaction
  - upsert target rows
  - update job progress/final status

## 6. Dataset Contract and Registry

### 6.1 Dataset Contract (Design Level)

Each dataset config must define:
- `dataset_code`
- `dataset_name`
- `source_name`
- `enabled`
- source spec: endpoint template, method, response format, encoding
- schedule spec: expected publication window, retry policy
- pipeline bindings: parser, normalizer, validator, parser_version
- storage spec: table name, write mode, uniqueness key

Config holds metadata only. Business logic remains in Python modules.

### 6.2 Registry Rules

Dataset Registry startup behavior:
- scan dataset config directory
- validate schema
- enforce unique `dataset_code`
- resolve parser/normalizer/validator references
- fail fast on invalid config

Job runtime must only reference `dataset_code`, not direct config file path.

## 7. Data, Timezone, and Idempotency

### 7.1 Idempotent Persistence

Persistence mode is upsert.

MVP uniqueness key (`market_open_interest_daily`):
- `(data_date, market_code, instrument_code, entity_code, source)`

Rerunning same `dataset_code + target_date` must produce deterministic final rows.

### 7.2 Time and Date Semantics

- system scheduling timezone: `Asia/Taipei`
- `target_date` means market trade date in `Asia/Taipei`
- daily job execution key: `dataset_code + target_date`

### 7.3 Publication Window Semantics

For MVP TAIFEX dataset:
- expected first availability window: `13:45-16:15` (`Asia/Taipei`)
- scheduled retries: every `15` minutes from `13:50` to `18:00`
- delayed retry: `T+1 08:30`

`publication_not_ready` is treated as retryable only within configured publication retry windows.

Publication readiness classification rules (MVP):
- classify as `publication_not_ready` when fetch succeeds but source payload is not yet published/complete for target date
- candidate signals include: empty CSV body, header-only CSV, explicit "no data yet" marker, or parsed row count below dataset minimum
- classify as `source_format_error` when payload format is broken (unexpected columns, parse failure, encoding break)
- classification logic must be deterministic and dataset-specific in validator rules

### 7.4 MVP Normalized Schema (Design Baseline)

For `market_open_interest_daily`, MVP normalized fields are:
- `data_date: date`
- `market_code: text`
- `instrument_code: text`
- `entity_code: text`
- `long_trade_oi: bigint`
- `short_trade_oi: bigint`
- `net_trade_oi: bigint`
- `long_trade_amount_k: numeric`
- `short_trade_amount_k: numeric`
- `net_trade_amount_k: numeric`
- `long_open_interest: bigint`
- `short_open_interest: bigint`
- `net_open_interest: bigint`
- `long_open_interest_amount_k: numeric`
- `short_open_interest_amount_k: numeric`
- `net_open_interest_amount_k: numeric`
- `source: text`
- `parser_version: text`
- `ingested_at: timestamptz`

## 8. Job Lifecycle and Error Model

### 8.1 Lifecycle States

Required states:
- `CREATED`
- `RUNNING`
- `COMPLETED`
- `FAILED`

Optional extension states:
- `RETRYING`
- `PARTIALLY_COMPLETED` (reserved, not required in MVP)

### 8.2 Failure Categories

Failure types:
- `network_error` (retryable)
- `publication_not_ready` (retryable within policy window)
- `source_format_error` (non-retryable until parser/config fix)
- `validation_error` (non-retryable)
- `persistence_error` (retryability depends on error class)

Each failed job must persist:
- error category
- error stage (`FETCH|PARSE|NORMALIZE|VALIDATE|PERSIST`)
- representative error message

### 8.3 Retry Rules (MVP)

- transient network/HTTP 5xx: exponential backoff, max 3 attempts
- publication-not-ready: use scheduled window retries and delayed retry slot
- parser/validation/schema mismatch: fail fast, no blind retry

Retry precedence and counting rules:
- each scheduled trigger execution is one run context
- in one run context, transient fetch errors may retry up to 3 attempts with exponential backoff
- publication-window schedule (`13:50` to `18:00` + `T+1 08:30`) defines when new run contexts are created
- max-attempt counter is per run context, not global across the full publication window

## 9. Observability and Operations

### 9.1 Structured Log Context

Required fields:
- `job_id`
- `dataset_code`
- `source_name`
- `target_date`
- `execution_stage`
- `parser_version`
- `rows_fetched`
- `rows_normalized`
- `rows_persisted`
- `retry_count`

### 9.2 Metrics

Required metrics:
- `crawler_job_duration_seconds`
- `crawler_job_failures_total`
- `crawler_rows_fetched_total`
- `crawler_rows_normalized_total`
- `crawler_rows_persisted_total`
- `crawler_retry_count_total`
- `crawler_stage_duration_seconds`

Recommended labels:
- `dataset_code`
- `source_name`
- `job_type`
- `status`

## 10. Security and Access Control

- manual trigger and backfill APIs are admin-only (backend RBAC enforced)
- trigger actions and reruns must be audit logged
- DB and external credentials come from environment-managed config
- secrets must never appear in logs

## 11. MVP Fixed Decisions

MVP fixed decisions:
- first dataset code: `taifex_institution_open_interest_daily`
- endpoint:
  - `https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate`
- response format: `csv`
- normalized table: `market_open_interest_daily`
- uniqueness key: `(data_date, market_code, instrument_code, entity_code, source)`
- date-range backfill available in v1 and decomposed per date
- raw payload persistence is optional in MVP, but extension point is reserved

## 12. Acceptance Criteria

Design is considered implementable when all items below are met:

- crawler can execute single-date run by `dataset_code + target_date`
- date-range request is split and tracked as per-date jobs
- date-range request provides a parent job/correlation id to query aggregated progress/result
- rerun of same date is idempotent (no duplicate logical rows)
- retry behavior distinguishes retryable vs non-retryable failures
- publication_not_ready vs source_format_error classification is deterministic by dataset rules
- publication-window retries follow defined Taipei-time schedule
- admin trigger endpoints are RBAC-protected and audit logged
- observability fields/metrics are available for operations
- crawler execution remains isolated from realtime ingestion and SSE

## 13. Relationship to TRD

This design document defines architecture boundary and executable design rules.

`docs/plans/2026-03-09-market-crawler-trd.md` provides implementation-level details (module structure, interfaces, table definitions, API surface).

Design-level rules in this document are the source of truth. TRD must not conflict with these rules.
