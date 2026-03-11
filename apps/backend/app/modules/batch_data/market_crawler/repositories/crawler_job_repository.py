"""Crawler job repository for lifecycle tracking."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Callable
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.crawler_job import CrawlerJobModel


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class CrawlerJobRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def start(
        self,
        dataset_code: str,
        target_date: date,
        trigger_type: str,
        parent_job_id: int | None = None,
        correlation_id: str | None = None,
    ) -> int:
        with self._session_factory() as session:
            job = CrawlerJobModel(
                dataset_code=dataset_code,
                target_date=target_date,
                trigger_type=trigger_type,
                status="RUNNING",
                started_at=_utcnow(),
                parent_job_id=parent_job_id,
                correlation_id=correlation_id,
            )
            session.add(job)
            session.commit()
            session.refresh(job)
            return job.id

    def create_parent_range_job(
        self,
        dataset_code: str,
        start_date: date,
        end_date: date,
        trigger_type: str,
    ) -> tuple[int, str]:
        correlation_id = uuid4().hex
        with self._session_factory() as session:
            job = CrawlerJobModel(
                dataset_code=dataset_code,
                range_start=start_date,
                range_end=end_date,
                trigger_type=trigger_type,
                status="RUNNING",
                started_at=_utcnow(),
                correlation_id=correlation_id,
            )
            session.add(job)
            session.commit()
            session.refresh(job)
            return job.id, correlation_id

    def create_child_job(
        self,
        dataset_code: str,
        target_date: date,
        trigger_type: str,
        parent_job_id: int | None,
        correlation_id: str | None,
    ) -> int:
        with self._session_factory() as session:
            job = CrawlerJobModel(
                dataset_code=dataset_code,
                target_date=target_date,
                trigger_type=trigger_type,
                status="CREATED",
                parent_job_id=parent_job_id,
                correlation_id=correlation_id,
            )
            session.add(job)
            session.commit()
            session.refresh(job)
            return job.id

    def stage(self, job_id: int, stage: str) -> None:
        with self._session_factory() as session:
            job = session.get(CrawlerJobModel, job_id)
            if job is None:
                return
            job.status = "RUNNING"
            job.error_stage = stage
            if job.started_at is None:
                job.started_at = _utcnow()
            session.commit()

    def complete(
        self,
        job_id: int,
        rows_fetched: int,
        rows_normalized: int,
        rows_persisted: int,
    ) -> None:
        with self._session_factory() as session:
            job = session.get(CrawlerJobModel, job_id)
            if job is None:
                return
            job.status = "COMPLETED"
            job.rows_fetched = rows_fetched
            job.rows_normalized = rows_normalized
            job.rows_persisted = rows_persisted
            job.finished_at = _utcnow()
            session.commit()

    def fail(self, job_id: int, error_category: str, error_stage: str, message: str) -> None:
        with self._session_factory() as session:
            job = session.get(CrawlerJobModel, job_id)
            if job is None:
                return
            job.status = "FAILED"
            job.error_category = error_category
            job.error_stage = error_stage
            job.error_message = message
            job.finished_at = _utcnow()
            session.commit()

    def get(self, job_id: int) -> CrawlerJobModel | None:
        with self._session_factory() as session:
            return session.get(CrawlerJobModel, job_id)

    def list_jobs(self, dataset_code: str | None = None) -> list[CrawlerJobModel]:
        with self._session_factory() as session:
            query = session.query(CrawlerJobModel)
            if dataset_code:
                query = query.filter(CrawlerJobModel.dataset_code == dataset_code)
            return list(query.order_by(CrawlerJobModel.id.desc()).all())
