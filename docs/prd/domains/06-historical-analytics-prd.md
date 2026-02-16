# Domain PRD: Historical Analytics (Post-MVP)

- Domain: Historical Analytics
- Version: v0.1
- Date: 2026-02-16
- Parent: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain Goal
Define the future domain for scheduled historical ingestion, storage, and analytics on futures/options indicators.

## 2. In Scope (Post-MVP)
1. Scheduler-based data collection jobs.
2. Long-term historical storage strategy.
3. Statistical queries and trend analysis endpoints.

## 3. Out of Scope (Current MVP)
1. Production-grade historical pipeline implementation.
2. Full backfill execution.
3. End-user analytics UI.

## 4. Candidate Interfaces
1. Scheduler jobs
- periodic ingestion tasks by symbol/timeframe

2. Analytics APIs (future)
- historical snapshots, rolling metrics, comparative windows

## 5. Data Architecture Decision Points
1. Keep Postgres only vs introduce TimescaleDB/ClickHouse.
2. Retention policy by granularity.
3. Reprocessing/replay strategy for corrected formulas.

## 6. Risks
1. High storage and query cost if schema is not time-series-optimized.
2. Backfill jobs can impact realtime performance.

## 7. Preparation Requirements
1. Preserve stable event contracts now.
2. Keep compute pipeline deterministic and replay-friendly.
3. Isolate historical workload from realtime SLA path.

## 8. Exit Criteria to Start This Domain
1. MVP realtime + subscription flows are stable.
2. Product confirms analytics KPIs and retention policy.
3. Data volume and query complexity justify dedicated historical design.
