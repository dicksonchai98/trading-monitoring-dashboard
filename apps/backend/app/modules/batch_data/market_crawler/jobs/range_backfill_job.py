"""Range backfill job for crawler datasets."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from app.db.session import SessionLocal
from app.modules.batch_data.market_crawler.domain.contracts import CrawlerJobParams
from app.modules.batch_data.market_crawler.registry import load_default_dataset_registry
from app.modules.batch_data.market_crawler.repositories.crawler_job_repository import (
    CrawlerJobRepository,
)
from app.modules.batch_shared.jobs.interfaces import JobContext, JobResult


@dataclass
class RangeBackfillCrawlerJob:
    def execute(self, params: dict[str, object], context: JobContext) -> JobResult:
        job_params = _parse_job_params(params)
        dataset_registry = load_default_dataset_registry()
        dataset_registry.get(job_params.dataset_code)

        repo = CrawlerJobRepository(session_factory=SessionLocal)
        parent_id, correlation_id = repo.create_parent_range_job(
            dataset_code=job_params.dataset_code,
            start_date=job_params.start_date,
            end_date=job_params.end_date,
            trigger_type=job_params.trigger_type,
        )

        count = 0
        cursor = job_params.start_date
        while cursor <= job_params.end_date:
            repo.create_child_job(
                dataset_code=job_params.dataset_code,
                target_date=cursor,
                trigger_type=job_params.trigger_type,
                parent_job_id=parent_id,
                correlation_id=correlation_id,
            )
            count += 1
            cursor += timedelta(days=1)

        # Mark parent as completed once children are enqueued.
        repo.complete(parent_id, rows_fetched=0, rows_normalized=0, rows_persisted=0)
        context.update_progress(count)
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
