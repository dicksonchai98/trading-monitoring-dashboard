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
from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.runtime.worker import QueueWorkerRuntime, build_worker_runtime
from app.modules.historical_backfill.fetcher import HistoricalFetcher
from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation

BACKFILL_JOB = "historical-backfill"
BACKFILL_WORKER_TYPE = "historical_backfill"


def build_backfill_worker_runtime(queue: RedisBatchQueue | None = None) -> QueueWorkerRuntime:
    runtime = build_worker_runtime(worker_type=BACKFILL_WORKER_TYPE, queue=queue)
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
    parser = argparse.ArgumentParser(description="run historical backfill worker queue consumer")
    _ = parser.parse_args()
    runtime = build_backfill_worker_runtime()
    runtime.run_forever()


if __name__ == "__main__":
    main()
