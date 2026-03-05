from __future__ import annotations

import asyncio

from app.market_ingestion.writer import RedisWriter
from app.services.metrics import Metrics


class FakeRedis:
    def __init__(self, fail_times: int = 0) -> None:
        self.last_maxlen: int | None = None
        self.last_approximate: bool | None = None
        self.fail_times = fail_times
        self.calls = 0

    def xadd(self, _key, _fields, maxlen, approximate):
        self.calls += 1
        self.last_maxlen = maxlen
        self.last_approximate = approximate
        if self.calls <= self.fail_times:
            raise RuntimeError("temporary redis error")
        return "1-0"


def test_writer_xadd_uses_maxlen_approximate() -> None:
    redis = FakeRedis()
    writer = RedisWriter(redis_client=redis, metrics=Metrics(), maxlen=100000)
    writer.write("dev:stream:tick:MTX", {"k": "v"})
    assert redis.last_maxlen == 100000
    assert redis.last_approximate is True


def test_writer_retries_three_times() -> None:
    redis = FakeRedis(fail_times=2)
    writer = RedisWriter(
        redis_client=redis,
        metrics=Metrics(),
        maxlen=100000,
        retry_attempts=3,
        retry_backoff_ms=1,
    )
    ok = asyncio.run(writer.write_with_retry("dev:stream:tick:MTX", {"k": "v"}))
    assert ok is True
    assert redis.calls == 3
