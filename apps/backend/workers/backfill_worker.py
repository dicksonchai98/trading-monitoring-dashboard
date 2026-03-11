"""Historical backfill worker process entrypoint."""

from __future__ import annotations

import argparse

from app.config import (
    BACKFILL_FETCH_MIN_INTERVAL_SECONDS,
    BACKFILL_HEARTBEAT_INTERVAL_SECONDS,
    BACKFILL_RETRY_BACKOFF_SECONDS,
    BACKFILL_RETRY_MAX_ATTEMPTS,
)
from app.db.session import SessionLocal
from app.modules.batch_shared.runtime.worker import WorkerRuntime, build_worker_runtime
from app.modules.historical_backfill.fetcher import HistoricalFetcher
from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation

BACKFILL_JOB = "historical-backfill"


def build_backfill_worker_runtime() -> WorkerRuntime:
    runtime = build_worker_runtime()
    runtime.register_job(
        BACKFILL_JOB,
        HistoricalBackfillJobImplementation(
            session_factory=SessionLocal,
            fetcher=HistoricalFetcher(
                min_interval_seconds=float(BACKFILL_FETCH_MIN_INTERVAL_SECONDS)
            ),
            retry_max_attempts=BACKFILL_RETRY_MAX_ATTEMPTS,
            retry_backoff_seconds=float(BACKFILL_RETRY_BACKOFF_SECONDS),
            heartbeat_interval_seconds=float(BACKFILL_HEARTBEAT_INTERVAL_SECONDS),
        ),
    )
    return runtime


def main() -> None:
    parser = argparse.ArgumentParser(description="run historical backfill worker job")
    parser.add_argument("--job-type", default=BACKFILL_JOB)
    parser.add_argument("--params", nargs="*", default=[])
    args = parser.parse_args()

    params: dict[str, object] = {}
    for raw in args.params:
        if "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        params[key] = value

    runtime = build_backfill_worker_runtime()
    runtime.run_job(job_type=args.job_type, params=params)


if __name__ == "__main__":
    main()
