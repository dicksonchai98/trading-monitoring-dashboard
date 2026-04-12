# KBar Analytics Service - Backend Design

## 1. Overview

This service analyzes intraday futures k-bar data and provides:

- Event-based next-day behavior statistics
- Historical distribution analytics for selected metrics

Core architecture:

- FastAPI API service for query and job trigger
- Analytics worker for batch computation
- PostgreSQL for feature, sample, stats, and job storage

---

## 2. High-Level Architecture

Data pipeline:

`intraday_kbars` -> `kbar_daily_features` -> `event/distribution analytics` -> `stats tables`

Components:

- API Service
- Analytics Worker
- Cron Scheduler
- PostgreSQL

---

## 3. Data Flow

### Step 1: Raw Data Input

Source table: `intraday_kbars`

### Step 2: Feature Builder

Worker computes and upserts daily features into:

- `kbar_daily_features`

### Step 3: Event Analytics

- Detect event matches per `event_id`
- Generate per-sample rows into `kbar_event_samples`
- Compute next-day outcomes
- Aggregate event-level statistics into `kbar_event_stats`

### Step 4: Distribution Analytics

- Compute aggregate statistics (mean, percentiles, min/max)
- Compute histogram by configured bins
- Upsert metric-level rows into `kbar_distribution_stats`

---

## 4. Database Schema

### 4.1 `kbar_daily_features`

Fields:

- code
- trade_date
- day_open
- day_high
- day_low
- day_close
- day_volume
- day_return
- day_range
- day_return_pct
- day_range_pct
- gap_from_prev_close
- close_position
- created_at
- updated_at

Constraints and indexes:

- PK: `(code, trade_date)`
- Index: `(trade_date)`

### 4.2 `kbar_event_samples`

Fields:

- event_id
- code
- trade_date
- next_trade_date
- event_value
- event_day_return
- event_day_range
- next_day_open
- next_day_high
- next_day_low
- next_day_close
- next_day_return
- next_day_range
- next_day_gap
- next_day_category
- computed_at

Constraints and indexes:

- PK: `(event_id, code, trade_date)`
- Index: `(event_id, code, trade_date DESC)`
- Index: `(code, trade_date DESC)`

`next_day_category` rule:

- `up`: `next_day_return > 0`
- `down`: `next_day_return < 0`
- `flat`: `next_day_return = 0`

### 4.3 `kbar_event_stats`

Fields:

- event_id
- code
- start_date
- end_date
- sample_count
- up_count
- down_count
- flat_count
- up_probability
- down_probability
- flat_probability
- avg_next_day_return
- median_next_day_return
- avg_next_day_range
- avg_next_day_gap
- version
- computed_at

Constraints and indexes:

- PK: `(event_id, code, start_date, end_date, version)`
- Unique (latest): `(event_id, code, start_date, end_date, computed_at)`
- Index: `(event_id, code, computed_at DESC)`

### 4.4 `kbar_distribution_stats`

Fields:

- metric_id
- code
- start_date
- end_date
- sample_count
- mean
- median
- min
- max
- p25
- p50
- p75
- p90
- p95
- histogram_json
- version
- computed_at

Constraints and indexes:

- PK: `(metric_id, code, start_date, end_date, version)`
- Unique (latest): `(metric_id, code, start_date, end_date, computed_at)`
- Index: `(metric_id, code, computed_at DESC)`

Histogram rule:

- `histogram_json` stores `{bins, counts, min, max, bucket_size}`
- Default bin count is `20` unless metric-specific override exists

### 4.5 `analytics_jobs`

Fields:

- job_id
- job_type
- payload (json)
- status (`pending` / `running` / `success` / `failed`)
- created_at
- started_at
- finished_at
- error_message

Constraints and indexes:

- PK: `(job_id)`
- Index: `(status, created_at)`
- Index: `(job_type, created_at DESC)`

---

## 5. Event Registry

### Direction

- day_up_gt_100
- day_up_gt_200
- day_down_lt_minus_100
- day_down_lt_minus_200

### Range

- day_range_gt_200
- day_range_gt_300

### Close Strength

- close_position_gt_0_8
- close_position_lt_0_2

### Gap

- gap_up_gt_100
- gap_down_lt_minus_100

---

## 6. Metric Registry

- day_range
- day_range_pct
- day_return
- day_return_pct
- gap_from_prev_close
- close_position

---

## 7. API Design

### Registry

- `GET /analytics/events`
- `GET /analytics/metrics`

### Event

- `GET /analytics/events/{event_id}/stats?code=TXF&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&version=latest`
- `GET /analytics/events/{event_id}/samples?code=TXF&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&page=1&page_size=100&sort=-trade_date`

### Distribution

- `GET /analytics/distributions/{metric_id}?code=TXF&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&version=latest`

### Jobs

- `POST /analytics/jobs/rebuild-daily-features`
- `POST /analytics/jobs/recompute-event-stats`
- `POST /analytics/jobs/recompute-distribution-stats`

Response conventions:

- `202 Accepted` for async job trigger with returned `job_id`
- `400` for invalid params
- `404` for unknown `event_id` / `metric_id`

---

## 8. Job Design

### Execution Model

- Cron: daily full pipeline
- Manual trigger: async API

### Job Types (canonical)

- `rebuild_daily_features`
- `recompute_event_stats`
- `recompute_distribution_stats`

### Supported Parameters

- code
- start_date
- end_date
- event_ids
- metric_ids

### Idempotency and Retry

- Same job payload can be retried safely (upsert semantics)
- Worker marks failed jobs with `error_message`
- Retry policy: max 3 attempts with exponential backoff

---

## 9. Worker Design

Worker responsibilities:

- Build/refresh daily features
- Detect event matches and materialize samples
- Compute event/distribution stats
- Persist outputs with versioning
- Update job status lifecycle

Job status lifecycle:

`pending -> running -> success | failed`

---

## 10. Module Structure

Recommended backend layout:

- `app/api/analytics.py` (HTTP endpoints and request validation)
- `app/analytics/feature_builder/` (daily feature computations)
- `app/analytics/event_analytics/` (event detection, sample generation, event stats)
- `app/analytics/distribution_analytics/` (distribution stats and histograms)
- `app/analytics/registry/` (event/metric definitions)
- `app/analytics/jobs/` (job orchestration and enqueue)
- `app/analytics/schemas/` (Pydantic I/O models)
- `app/repositories/` (DB access layer)
- `app/workers/` (worker entrypoints and schedulers)

---

## 11. Design Principles

- Precompute statistics to keep reads fast
- Keep feature computation and analytics aggregation separated
- Event = filter condition, Metric = measured variable
- Keep event samples for traceability and explainability
- Keep distribution storage aggregated (no full raw mirror)
- Favor deterministic, idempotent batch jobs
