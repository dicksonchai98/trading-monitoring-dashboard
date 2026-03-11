# Batch Shared Infrastructure Design

Version: v1.0
Status: Draft
Owner: Engineering

---

# 1. Purpose

This document defines the **shared infrastructure for batch data services** in the system.

Batch data services include but are not limited to:

- Historical Market Data Backfill
- Market Data Crawlers
- Future Research Dataset Builders
- Settlement Data Importers

These services share a common execution model and operational requirements, including:

- Background execution
- Job lifecycle management
- Retry and failure handling
- Observability
- Database persistence
- Configuration management

The goal of this shared infrastructure is to **avoid duplication of core runtime logic** while allowing each batch service to implement its own domain-specific pipeline.

---

# 2. Design Principles

The shared batch infrastructure follows the principles below.

## 2.1 Separation of Concerns

Shared infrastructure should only provide:

- execution framework
- lifecycle management
- infrastructure utilities

It should **not contain business logic** for specific pipelines.

Business pipelines remain implemented in their own modules:

- historical_backfill
- market_crawler

---

## 2.2 Service Isolation

Batch jobs must run in **separate worker processes** from the API server.

This prevents:

- API latency degradation
- resource contention
- crawler instability affecting API availability

Recommended runtime processes:

```
api process
backfill worker process
crawler worker process
```

---

## 2.3 Idempotent Execution

Batch infrastructure must support idempotent job execution.

Jobs should be able to:

- retry safely
- resume partially completed work
- rerun historical ranges without data corruption

Database writers should use **upsert semantics** where applicable.

---

## 2.4 Observability First

Batch execution must provide visibility through:

- structured logs
- job lifecycle status
- metrics
- error tracking

This allows operators to diagnose failures and monitor pipeline health.

---

# 3. Architecture Overview

Batch services follow a layered architecture:

```
Batch Worker Process
       ->
       ->
Batch Runtime Framework
       ->
       ->
Job Implementation
       ->
       ->
Data Source / Processing Logic
       ->
       ->
Repository Layer
       ->
       ->
PostgreSQL
```

Shared infrastructure exists in the **Batch Runtime Framework layer**.

---

# 4. Batch Runtime Model

Batch jobs follow a standardized execution lifecycle.

## 4.1 Job Lifecycle

A batch job moves through the following states:

```
CREATED
RUNNING
FAILED
COMPLETED
```

Optional intermediate states may include:

```
RETRYING
PARTIALLY_COMPLETED
```

---

## 4.2 Job Lifecycle Transitions

```
CREATED -> RUNNING -> COMPLETED
CREATED -> RUNNING -> FAILED
RUNNING -> RETRYING -> RUNNING
RETRYING -> FAILED
RUNNING -> PARTIALLY_COMPLETED -> RUNNING
```

---

## 4.3 Job Metadata

Each job execution should record metadata including:

- job_id
- job_type
- created_at
- started_at
- finished_at
- status
- rows_processed
- error_message

These records allow operators to audit execution history.

Metadata compatibility note:

- Shared canonical metric name: `rows_processed`.
- Service-level tables may use a different physical column name (for example `rows_written`) if mapped consistently in the repository layer.
- `job_type` should be present in shared runtime records; service-specific tables may infer it from module context when only one job type exists.

## 4.4 Checkpoint and Resume Contract

To support safe resume and partial rerun, shared runtime should persist checkpoint metadata:

- `checkpoint_cursor` (service-defined cursor, e.g. chunk id or date window)
- `processed_chunks`
- `total_chunks`
- `retry_count`
- `last_heartbeat_at`

This checkpoint contract is infrastructure-level; cursor format remains service-defined.

---

# 5. Worker Process Model

Batch jobs run in **dedicated worker processes**.

Each worker process is responsible for:

- receiving job triggers
- executing job pipelines
- updating job status
- logging progress

Example worker layout:

```
backfill-worker
crawler-worker
```

Each worker loads the same shared infrastructure but executes different job implementations.

---

# 6. Job Execution Framework

The batch runtime framework provides reusable execution components.

## 6.1 Job Runner

The Job Runner coordinates job lifecycle execution.

Responsibilities:

- initialize job record
- update job status
- execute job logic
- capture exceptions
- finalize job status

Pseudo execution flow:

```
create job record
mark job RUNNING
execute pipeline
if success -> mark COMPLETED
if error and retryable -> mark RETRYING
if error and not retryable -> mark FAILED
```

---

## 6.2 Retry Handling

Retry policy should support:

- configurable retry count
- exponential backoff
- retry logging

Retry should be applied to recoverable failures such as:

- network errors
- temporary API outages
- transient database conflicts

---

## 6.3 Progress Tracking

Long-running jobs should periodically update progress indicators such as:

- processed rows
- processed chunks
- percentage completion

This allows monitoring tools to detect stalled jobs.

---

# 7. Configuration Management

Batch services rely on centralized configuration management.

Configuration parameters include:

- database connection
- external API credentials
- retry policy
- logging level
- worker concurrency settings

Configuration should be loaded from:

```
environment variables
configuration files
```

This enables consistent deployment across environments.

---

# 8. Database Infrastructure

Batch jobs rely on PostgreSQL for persistence.

Shared database infrastructure includes:

- database connection management
- transaction helpers
- bulk insert utilities
- upsert helpers
- repository base classes

The repository layer isolates SQL operations from job execution logic.

---

# 9. Logging and Observability

Batch infrastructure must provide consistent logging.

## 9.1 Structured Logging

Logs should include:

- job_id
- job_type
- execution stage
- elapsed time
- error details

Structured logging allows easier monitoring and alerting.

---

## 9.2 Metrics

Recommended metrics include:

- job_duration_seconds
- job_failure_count
- rows_processed
- retry_count

Metrics should integrate with the system monitoring stack.

---

# 10. Error Handling

Batch runtime must handle failures gracefully.

Error handling strategy includes:

- catching pipeline exceptions
- logging error details
- updating job status
- preventing partial database corruption

Recoverable failures should trigger retries.

Non-recoverable failures should mark the job as FAILED.

---

# 11. Security Considerations

Batch services may access external APIs and databases.

Security guidelines include:

- credentials stored in environment variables
- secrets not logged
- restricted database permissions where applicable

---

# 12. Extensibility

The shared batch infrastructure should support additional batch services in the future.

Potential future services include:

- settlement data ingestion
- options statistics import
- institutional position analytics
- research dataset builders

These services should be able to reuse the same infrastructure without modifying the runtime framework.

---

# 13. Relationship With Batch Services

This document defines shared infrastructure only.

Service-specific pipelines are defined separately:

- Historical Backfill Job Design
- Market Crawler Design

Those documents describe the domain-specific logic built on top of this shared infrastructure.

---
