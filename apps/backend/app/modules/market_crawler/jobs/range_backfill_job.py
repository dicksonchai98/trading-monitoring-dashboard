"""Range backfill job for crawler datasets."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta

from app.modules.market_crawler.domain.contracts import CrawlerJobParams
from app.modules.market_crawler.registry import load_default_dataset_registry
from app.modules.batch_shared.jobs.interfaces import JobContext, JobResult
from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.batch_shared.repositories.job_repository import JobRepository


@dataclass
class RangeBackfillCrawlerJob:
    repository: JobRepository | None = None
    queue: RedisBatchQueue | None = None

    def execute(self, params: dict[str, object], context: JobContext) -> JobResult:
        job_params = _parse_job_params(params)
        dataset_registry = load_default_dataset_registry()
        dataset_registry.get(job_params.dataset_code)

        if self.repository is None or self.queue is None:
            raise RuntimeError("range backfill job requires shared repository and queue")

        count = 0
        cursor = job_params.start_date
        while cursor <= job_params.end_date:
            metadata = {
                "dataset_code": job_params.dataset_code,
                "target_date": cursor.isoformat(),
                "trigger_type": job_params.trigger_type,
            }
            dedupe_key = json.dumps(
                metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=True
            )
            existing = self.repository.find_active_job(
                worker_type="market_crawler",
                job_type="crawler-single-date",
                dedupe_key=dedupe_key,
            )
            job = existing or self.repository.create_job(
                worker_type="market_crawler",
                job_type="crawler-single-date",
                dedupe_key=dedupe_key,
                metadata=metadata,
            )
            if existing is None:
                self.queue.enqueue(worker_type="market_crawler", job_id=job.id)
            count += 1
            cursor += timedelta(days=1)
            context.update_progress(rows_processed=count)

        return JobResult(rows_processed=count)


def _parse_job_params(params: dict[str, object]) -> CrawlerJobParams:
    dataset_code = str(params.get("dataset_code", "taifex_institution_open_interest_daily"))
    start_date_raw = params.get("start_date")
    end_date_raw = params.get("end_date")
    trigger_type = str(params.get("trigger_type", "manual"))
    if start_date_raw is None or end_date_raw is None:
        raise ValueError("start_date and end_date are required")
    start_date = date.fromisoformat(str(start_date_raw))
    end_date = date.fromisoformat(str(end_date_raw))
    return CrawlerJobParams(
        dataset_code=dataset_code,
        target_date=start_date,
        trigger_type=trigger_type,
        start_date=start_date,
        end_date=end_date,
    )
