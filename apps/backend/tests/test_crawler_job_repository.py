from __future__ import annotations

from datetime import date

from app.db.session import SessionLocal
from app.models.crawler_job import CrawlerJobModel
from app.modules.batch_data.market_crawler.repositories.crawler_job_repository import (
    CrawlerJobRepository,
)


def test_crawler_job_repository_lifecycle() -> None:
    repo = CrawlerJobRepository(session_factory=SessionLocal)

    job_id = repo.start(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 9),
        trigger_type="manual",
    )
    repo.stage(job_id, "FETCH")
    repo.complete(job_id, rows_fetched=10, rows_normalized=8, rows_persisted=8)

    with SessionLocal() as session:
        row = session.query(CrawlerJobModel).filter(CrawlerJobModel.id == job_id).one()
        assert row.status == "COMPLETED"
        assert row.rows_fetched == 10
        assert row.rows_persisted == 8


def test_crawler_job_repository_fail_records_error_context() -> None:
    repo = CrawlerJobRepository(session_factory=SessionLocal)

    job_id = repo.start(
        dataset_code="taifex_institution_open_interest_daily",
        target_date=date(2026, 3, 9),
        trigger_type="manual",
    )
    repo.fail(job_id, "validation_error", "VALIDATE", "bad schema")

    with SessionLocal() as session:
        row = session.query(CrawlerJobModel).filter(CrawlerJobModel.id == job_id).one()
        assert row.status == "FAILED"
        assert row.error_category == "validation_error"
        assert row.error_stage == "VALIDATE"
