from __future__ import annotations

import pytest

from app.modules.batch_data.market_crawler.jobs.single_date_job import SingleDateCrawlerJob


class _Context:
    job_id = 1
    job_type = "crawler"


def test_single_date_job_maps_network_failure_to_connection_error() -> None:
    class _FakeOrchestrator:
        def run(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            _ = (args, kwargs)
            return {"status": "FAILED", "error_category": "network_error"}

    job = SingleDateCrawlerJob(orchestrator_factory=lambda _params: _FakeOrchestrator())

    with pytest.raises(ConnectionError):
        job.execute(
            params={
                "dataset_code": "taifex_institution_open_interest_daily",
                "target_date": "2026-03-09",
                "trigger_type": "manual",
            },
            context=_Context(),
        )


def test_single_date_job_maps_publication_not_ready_to_value_error() -> None:
    class _FakeOrchestrator:
        def run(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            _ = (args, kwargs)
            return {"status": "FAILED", "error_category": "publication_not_ready"}

    job = SingleDateCrawlerJob(orchestrator_factory=lambda _params: _FakeOrchestrator())

    with pytest.raises(ValueError):
        job.execute(
            params={
                "dataset_code": "taifex_institution_open_interest_daily",
                "target_date": "2026-03-09",
                "trigger_type": "scheduled",
            },
            context=_Context(),
        )


def test_single_date_job_returns_result_on_success() -> None:
    class _FakeOrchestrator:
        def run(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            _ = (args, kwargs)
            return {
                "status": "COMPLETED",
                "rows_fetched": 2,
                "rows_normalized": 2,
                "rows_persisted": 2,
            }

    job = SingleDateCrawlerJob(orchestrator_factory=lambda _params: _FakeOrchestrator())
    result = job.execute(
        params={
            "dataset_code": "taifex_institution_open_interest_daily",
            "target_date": "2026-03-09",
            "trigger_type": "manual",
        },
        context=_Context(),
    )

    assert result.normalized_rows_processed == 2
