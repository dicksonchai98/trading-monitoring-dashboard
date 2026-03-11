"""Crawler worker process entrypoint."""

from __future__ import annotations

import argparse

from app.modules.batch_data.market_crawler.jobs.range_backfill_job import RangeBackfillCrawlerJob
from app.modules.batch_data.market_crawler.jobs.single_date_job import SingleDateCrawlerJob
from app.modules.batch_shared.runtime.worker import WorkerRuntime, build_worker_runtime

SINGLE_DATE_JOB = "crawler-single-date"
RANGE_BACKFILL_JOB = "crawler-backfill"


def build_crawler_worker_runtime() -> WorkerRuntime:
    runtime = build_worker_runtime()
    runtime.register_job(SINGLE_DATE_JOB, SingleDateCrawlerJob())
    runtime.register_job(RANGE_BACKFILL_JOB, RangeBackfillCrawlerJob())
    return runtime


def main() -> None:
    parser = argparse.ArgumentParser(description="run market crawler worker job")
    parser.add_argument("--job-type", required=True)
    parser.add_argument("--params", nargs="*", default=[])
    args = parser.parse_args()

    params: dict[str, object] = {}
    for raw in args.params:
        if "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        params[key] = value

    runtime = build_crawler_worker_runtime()
    runtime.run_job(job_type=args.job_type, params=params)


if __name__ == "__main__":
    main()
