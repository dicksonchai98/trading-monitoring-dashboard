from __future__ import annotations

from app.modules.batch_shared.queue.redis_queue import RedisBatchQueue


class FakeRedis:
    def __init__(self) -> None:
        self.lpush_calls: list[tuple[str, str]] = []
        self.brpop_result: tuple[str, str] | None = None

    def lpush(self, queue_name: str, value: str) -> None:
        self.lpush_calls.append((queue_name, value))

    def brpop(self, queue_name: str, timeout: int = 0) -> tuple[str, str] | None:
        _ = timeout
        if self.brpop_result is None:
            return None
        return (queue_name, self.brpop_result[1])


def test_queue_name_maps_from_worker_type() -> None:
    queue = RedisBatchQueue(client=FakeRedis())
    assert queue.queue_name("historical_backfill") == "queue:batch:historical_backfill"


def test_enqueue_pushes_job_id_payload() -> None:
    client = FakeRedis()
    queue = RedisBatchQueue(client=client)

    queue.enqueue("market_crawler", job_id=42)

    assert client.lpush_calls == [("queue:batch:market_crawler", "42")]


def test_dequeue_blocking_returns_job_id() -> None:
    client = FakeRedis()
    client.brpop_result = ("queue:batch:historical_backfill", "41")
    queue = RedisBatchQueue(client=client)

    assert queue.dequeue_blocking("historical_backfill", timeout_seconds=1) == 41
