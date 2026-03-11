from __future__ import annotations

from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation
from workers.backfill_worker import BACKFILL_JOB, build_backfill_worker_runtime


def test_backfill_worker_registers_default_job() -> None:
    runtime = build_backfill_worker_runtime()

    assert BACKFILL_JOB in runtime.registry
    assert isinstance(runtime.registry[BACKFILL_JOB], HistoricalBackfillJobImplementation)
