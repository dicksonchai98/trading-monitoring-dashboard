## Context

Current MVP architecture handles realtime ingestion (`Shioaji WS -> Redis Streams -> indicator pipeline`) but does not provide a controlled historical backfill path. Missing historical 1-minute bars currently require ad-hoc fixes, increasing operational risk and inconsistency.

This change introduces a dedicated historical backfill service as a batch workflow, aligned with existing backend principles: FastAPI API boundary, backend RBAC as source of truth, PostgreSQL as persistent store, and isolated worker execution. The service must coexist safely with realtime writes to `kbars_1m`.

Key constraints:
- Historical and realtime pipelines share the same target table (`kbars_1m`).
- Admin-only trigger and management API must be enforced by backend RBAC and audited.
- Backfill execution must be idempotent, resumable, and isolated from API/realtime availability.
- Time semantics must remain consistent with existing Taiwan futures processing (`Asia/Taipei`, minute-start bars, exchange session boundaries).

## Goals / Non-Goals

**Goals:**
- Provide an admin-triggered historical backfill workflow for 1-minute bars.
- Define deterministic write semantics for overlaps with realtime data (`closed_only` default; optional `force`).
- Ensure safe retry/resume behavior via chunk-level execution and persisted checkpoints.
- Standardize job lifecycle visibility (status/progress/heartbeat) for operations and troubleshooting.
- Keep runtime isolation so batch failures do not degrade API response path or realtime ingestion.

**Non-Goals:**
- No scheduled/cron backfill in this change.
- No multi-vendor abstraction or vendor failover in this change.
- No automatic gap detection algorithm in this change.
- No extension to non-1-minute bar granularities in this change.
- No frontend UX redesign beyond consuming existing admin APIs.

## Decisions

1. Dedicated worker process for historical jobs
- Decision: Execute backfill jobs in a separate worker process from FastAPI API process.
- Rationale: Prevent CPU/IO contention and long-running task impact on API latency/realtime path.
- Alternative considered: Run background tasks in API process.
- Why not: Simpler deployment but insufficient isolation and poorer failure containment.

2. Shared storage table with idempotent upsert
- Decision: Write historical results into existing `kbars_1m` using `ON CONFLICT (code, minute_ts)`.
- Rationale: Keeps a single source table for downstream consumers and supports safe reruns.
- Alternative considered: Separate historical table + later merge.
- Why not: Adds merge complexity and duplicated query logic.

3. Conflict policy with safe default
- Decision: Introduce `overwrite_mode` with default `closed_only`; allow `force` for explicit override.
- Rationale: Protect open-session data freshness while still enabling controlled corrections.
- Alternative considered: Always overwrite.
- Why not: High risk of replacing realtime values during active session.

4. Canonical normalization boundary before dedup/upsert
- Decision: Convert fetched timestamps to timezone-aware `minute_ts` (`Asia/Taipei`) and enforce minute alignment before keying/writing.
- Rationale: Prevent duplicate logical bars caused by format/timezone mismatch.
- Alternative considered: Normalize inside SQL only.
- Why not: Harder to validate upstream and less transparent error accounting.

5. Chunking and checkpoint contract for resume
- Decision: Execute one trading-day chunk per transaction; persist `processed_chunks`, `total_chunks`, `checkpoint_cursor`, and heartbeat.
- Rationale: Localizes failure impact and enables restart-safe progress recovery.
- Alternative considered: Whole-range single transaction.
- Why not: Long lock duration, large rollback blast radius, poor operability.

6. API and security boundary
- Decision: Expose admin APIs for trigger/list/detail and enforce RBAC/audit at backend API boundary.
- Rationale: Aligns with project security baseline (backend RBAC source of truth, auditable admin actions).
- Alternative considered: Internal-only CLI trigger.
- Why not: Lower traceability and weaker standardized access control.

7. Observability baseline for operations
- Decision: Require structured logs and metrics (`duration`, `failure_count`, `rows_processed_total`, `chunk_retry_total`, `active_jobs`) and heartbeat update <= 30s.
- Rationale: Enables detection of stuck jobs, retry storms, and data-quality regressions.
- Alternative considered: Log-only, no metrics baseline.
- Why not: Limited alerting and trend visibility.

## Risks / Trade-offs

- [Realtime overlap still possible at session boundaries] -> Mitigation: enforce exchange-calendar boundary and default `closed_only`; require explicit `force` for overrides.
- [Provider rate limiting may extend completion time] -> Mitigation: configurable concurrency + exponential backoff with jitter; monitor retry metrics.
- [Checkpoint drift or corruption may cause partial reprocessing] -> Mitigation: transaction-per-chunk, idempotent upsert key, and startup reconciliation of checkpoint vs committed chunks.
- [Schema/index mismatch can break upsert performance] -> Mitigation: preflight migration check for unique key `(code, minute_ts)` and recommended `(code, trade_date)` index.
- [Admin API misuse (large accidental ranges)] -> Mitigation: request validation (max range guardrails) and mandatory audit logging.

## Migration Plan

1. Add/verify DB prerequisites:
- Ensure `kbars_1m` unique constraint on `(code, minute_ts)`.
- Add/verify `historical_backfill_jobs` columns for lifecycle/progress/checkpoint metadata.
- Add recommended index `(code, trade_date)` if missing.

2. Implement backend modules and worker runtime:
- Job controller, chunker, fetcher, transformer, writer.
- Integrate shared Shioaji session factory and shared batch infrastructure contracts.

3. Add admin API endpoints and RBAC policy wiring:
- Trigger/list/detail endpoints.
- Audit logging integration for trigger actions.

4. Rollout strategy:
- Deploy with worker disabled by default flag.
- Enable in staging; run controlled backfill windows; validate metrics/data consistency.
- Enable in production with conservative concurrency defaults.

5. Rollback strategy:
- Disable worker via feature/config flag.
- Keep API endpoints returning maintenance/disabled response if needed.
- Re-run failed ranges safely once issue is fixed (idempotent upsert contract).

## Open Questions

- What explicit max request range (days) should be enforced at API validation layer?
- Should `force` mode require an additional approval flag or reason field for auditability?
- Which exchange-calendar source/module will be canonical for day/night session boundaries?
- Do we need per-symbol concurrency limits in addition to per-job concurrency?
- Should job listing API include lightweight chunk-level failure summaries for operator UX?
