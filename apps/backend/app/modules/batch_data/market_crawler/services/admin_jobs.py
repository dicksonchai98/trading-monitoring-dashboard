"""Admin job creation helpers for market crawler."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from typing import Any

from app.modules.batch_shared.repositories.job_repository import JobRepository
from app.modules.batch_shared.services.admin_jobs import BatchJobAdminService


def _dump_dedupe_key(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


@dataclass(frozen=True)
class CrawlerCreateResult:
    job_id: int
    worker_type: str
    job_type: str
    status: str


@dataclass
class MarketCrawlerAdminJobService:
    repository: JobRepository
    batch_admin_service: BatchJobAdminService

    def create_single_date_job(
        self,
        *,
        dataset_code: str,
        target_date: date,
        trigger_type: str,
    ) -> CrawlerCreateResult:
        metadata = {
            "dataset_code": dataset_code,
            "target_date": target_date.isoformat(),
            "trigger_type": trigger_type,
        }
        return self._create_job(job_type="crawler-single-date", metadata=metadata)

    def create_backfill_job(
        self,
        *,
        dataset_code: str,
        start_date: date,
        end_date: date,
        trigger_type: str,
    ) -> CrawlerCreateResult:
        metadata = {
            "dataset_code": dataset_code,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "trigger_type": trigger_type,
        }
        return self._create_job(job_type="crawler-backfill", metadata=metadata)

    def _create_job(self, *, job_type: str, metadata: dict[str, Any]) -> CrawlerCreateResult:
        dedupe_key = _dump_dedupe_key(metadata)
        existing = self.repository.find_active_job(
            worker_type="market_crawler",
            job_type=job_type,
            dedupe_key=dedupe_key,
        )
        job = existing or self.batch_admin_service.create_and_enqueue(
            worker_type="market_crawler",
            job_type=job_type,
            dedupe_key=dedupe_key,
            metadata=metadata,
        )
        return CrawlerCreateResult(
            job_id=job.id,
            worker_type=job.worker_type,
            job_type=job.job_type,
            status=job.status,
        )
