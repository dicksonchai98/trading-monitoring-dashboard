from __future__ import annotations

from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.market_crawler.jobs.range_backfill_job import RangeBackfillCrawlerJob
from app.modules.market_crawler.jobs.single_date_job import SingleDateCrawlerJob
from workers.crawler_worker import CRAWLER_WORKER_TYPE, build_crawler_worker_runtime


class _FakeRedis:
    def lpush(self, queue_name: str, value: str) -> None:
        _ = (queue_name, value)

    def brpop(self, queue_name: str, timeout: int = 0):
        _ = (queue_name, timeout)
        return None


def test_crawler_worker_registers_default_job() -> None:
    runtime = build_crawler_worker_runtime(queue=RedisBatchQueue(client=_FakeRedis()))

    assert runtime.worker_type == CRAWLER_WORKER_TYPE
    assert "crawler-single-date" in runtime.registry
    assert "crawler-backfill" in runtime.registry
    assert isinstance(runtime.registry["crawler-single-date"], SingleDateCrawlerJob)
    assert isinstance(runtime.registry["crawler-backfill"], RangeBackfillCrawlerJob)
