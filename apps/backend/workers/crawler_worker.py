"""Crawler worker process entrypoint."""

from __future__ import annotations

import argparse

from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.runtime.worker import QueueWorkerRuntime, build_worker_runtime
from app.modules.market_crawler.jobs.range_backfill_job import RangeBackfillCrawlerJob
from app.modules.market_crawler.jobs.single_date_job import SingleDateCrawlerJob

SINGLE_DATE_JOB = "crawler-single-date"
RANGE_BACKFILL_JOB = "crawler-backfill"
CRAWLER_WORKER_TYPE = "market_crawler"
TAIFEX_INSTITUTION_DATASET = "taifex_institution_open_interest_daily"


def build_crawler_worker_runtime(queue: RedisBatchQueue | None = None) -> QueueWorkerRuntime:
    runtime = build_worker_runtime(worker_type=CRAWLER_WORKER_TYPE, queue=queue)
    runtime.register_job(SINGLE_DATE_JOB, SingleDateCrawlerJob())
    runtime.register_job(
        RANGE_BACKFILL_JOB,
        RangeBackfillCrawlerJob(repository=runtime.repository, queue=runtime.queue),
    )
    return runtime


def main() -> None:
    parser = argparse.ArgumentParser(description="run market crawler worker queue consumer")
    _ = parser.parse_args()
    runtime = build_crawler_worker_runtime()
    runtime.run_forever()


if __name__ == "__main__":
    main()
