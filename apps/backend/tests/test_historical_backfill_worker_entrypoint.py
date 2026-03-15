from __future__ import annotations

from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue
from app.modules.historical_backfill.job import HistoricalBackfillJobImplementation
from workers.backfill_worker import (
    BACKFILL_JOB,
    BACKFILL_WORKER_TYPE,
    build_backfill_worker_runtime,
)


class _FakeRedis:
    def lpush(self, queue_name: str, value: str) -> None:
        _ = (queue_name, value)

    def brpop(self, queue_name: str, timeout: int = 0):
        _ = (queue_name, timeout)
        return None


def test_backfill_worker_registers_default_job() -> None:
    runtime = build_backfill_worker_runtime(queue=RedisBatchQueue(client=_FakeRedis()))

    assert runtime.worker_type == BACKFILL_WORKER_TYPE
    assert BACKFILL_JOB in runtime.registry
    assert isinstance(runtime.registry[BACKFILL_JOB], HistoricalBackfillJobImplementation)
