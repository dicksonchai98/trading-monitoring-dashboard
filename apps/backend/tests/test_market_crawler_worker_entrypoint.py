from __future__ import annotations

from app.modules.batch_data.market_crawler.jobs.range_backfill_job import RangeBackfillCrawlerJob
from app.modules.batch_data.market_crawler.jobs.single_date_job import SingleDateCrawlerJob
from workers.crawler_worker import build_crawler_worker_runtime


def test_crawler_worker_registers_default_job() -> None:
    runtime = build_crawler_worker_runtime()

    assert "crawler-single-date" in runtime.registry
    assert "crawler-backfill" in runtime.registry
    assert isinstance(runtime.registry["crawler-single-date"], SingleDateCrawlerJob)
    assert isinstance(runtime.registry["crawler-backfill"], RangeBackfillCrawlerJob)
