from __future__ import annotations

import threading
import time
from datetime import date

import pytest
from app.db.session import SessionLocal
from app.modules.batch_shared.jobs.interfaces import JobResult
from app.modules.historical_backfill.logging import redact_secrets
from app.modules.historical_backfill.repository import (
    BackfillCreateRequest,
    HistoricalBackfillJobRepository,
)
from app.modules.historical_backfill.worker import HistoricalBackfillWorkerRuntime


def _seed_job(day: int) -> int:
    repo = HistoricalBackfillJobRepository(session_factory=SessionLocal)
    job = repo.create_or_get_active(
        BackfillCreateRequest(
            code="TXF",
            start_date=date(2026, 3, day),
            end_date=date(2026, 3, day),
            overwrite_mode="closed_only",
        )
    )
    return job.id


def test_worker_run_once_updates_metrics(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_job(1)

    class _FakeImplementation:
        def __init__(self, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
            _ = args
            _ = kwargs

        def execute(self, params, context):  # type: ignore[no-untyped-def]
            _ = params
            context.update_progress(
                rows_processed=3,
                rows_written=2,
                rows_failed_validation=1,
                rows_skipped_conflict=0,
                checkpoint_cursor="2026-03-01",
                processed_chunks=1,
                total_chunks=1,
            )
            return JobResult(rows_processed=3, rows_written=2)

    monkeypatch.setattr(
        "app.modules.historical_backfill.worker.HistoricalBackfillJobImplementation",
        _FakeImplementation,
    )

    runtime = HistoricalBackfillWorkerRuntime(session_factory=SessionLocal, max_concurrency=1)
    runtime.run_once()

    assert runtime.metrics.counters["backfill_rows_processed_total"] == 3
    assert runtime.metrics.counters["backfill_job_failure_count"] == 0
    assert runtime.metrics.counters["backfill_job_duration_seconds"] >= 0


def test_worker_heartbeat_updates_while_running(monkeypatch: pytest.MonkeyPatch) -> None:
    job_id = _seed_job(4)

    class _SlowImplementation:
        def __init__(self, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
            _ = args
            _ = kwargs

        def execute(self, params, context):  # type: ignore[no-untyped-def]
            _ = params
            _ = context
            time.sleep(1.2)
            return JobResult(rows_processed=1, rows_written=1)

    monkeypatch.setattr(
        "app.modules.historical_backfill.worker.HistoricalBackfillJobImplementation",
        _SlowImplementation,
    )

    runtime = HistoricalBackfillWorkerRuntime(
        session_factory=SessionLocal,
        max_concurrency=1,
        heartbeat_interval_seconds=1,
    )
    runtime.run_once()

    repo = HistoricalBackfillJobRepository(session_factory=SessionLocal)
    job = repo.get(job_id)
    assert job is not None
    assert job.started_at is not None
    assert job.last_heartbeat_at is not None
    assert job.last_heartbeat_at >= job.started_at


def test_worker_concurrency_runs_multiple_jobs(monkeypatch: pytest.MonkeyPatch) -> None:
    first_id = _seed_job(2)
    second_id = _seed_job(3)
    lock = threading.Lock()
    executed_job_ids: list[int] = []

    class _ConcurrentImplementation:
        def __init__(self, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
            _ = args
            _ = kwargs

        def execute(self, params, context):  # type: ignore[no-untyped-def]
            _ = params
            with lock:
                executed_job_ids.append(context.job_id)
            time.sleep(0.01)
            context.update_progress(
                rows_processed=1,
                rows_written=1,
                rows_failed_validation=0,
                rows_skipped_conflict=0,
                checkpoint_cursor="2026-03-02",
                processed_chunks=1,
                total_chunks=1,
            )
            return JobResult(rows_processed=1, rows_written=1)

    monkeypatch.setattr(
        "app.modules.historical_backfill.worker.HistoricalBackfillJobImplementation",
        _ConcurrentImplementation,
    )

    runtime = HistoricalBackfillWorkerRuntime(session_factory=SessionLocal, max_concurrency=2)
    runtime.run_once()
    assert sorted(executed_job_ids) == sorted([first_id, second_id])


def test_redact_secrets_removes_shioaji_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.modules.historical_backfill.logging.SHIOAJI_API_KEY",
        "api-secret",
    )
    monkeypatch.setattr(
        "app.modules.historical_backfill.logging.SHIOAJI_SECRET_KEY", "secret-secret"
    )
    message = "failed login api-secret and secret-secret"
    assert redact_secrets(message) == "failed login *** and ***"
