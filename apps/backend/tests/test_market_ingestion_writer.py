from __future__ import annotations

import asyncio

from app.market_ingestion.contracts import IngestionEvent, QueueItem
from app.market_ingestion.writer import RedisWriter
from app.services.metrics import Metrics


class FakeRedis:
    def __init__(self, fail_times: int = 0) -> None:
        self.last_maxlen: int | None = None
        self.last_approximate: bool | None = None
        self.last_fields: dict[str, str] | None = None
        self.fail_times = fail_times
        self.calls = 0

    def xadd(self, _key, _fields, maxlen, approximate):
        self.calls += 1
        self.last_maxlen = maxlen
        self.last_approximate = approximate
        self.last_fields = _fields
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


def test_spot_event_written_with_contract_fields() -> None:
    redis = FakeRedis()
    writer = RedisWriter(redis_client=redis, metrics=Metrics(), maxlen=100000)
    item = QueueItem(
        stream_key="dev:stream:spot:2330",
        event=IngestionEvent(
            source="shioaji",
            code="2330",
            asset_type="spot",
            quote_type="spot",
            event_ts="2026-03-21T00:00:00+00:00",
            recv_ts="2026-03-21T00:00:01+00:00",
            ingest_seq=7,
            payload={"last_price": 900.5, "symbol": "2330"},
        ),
    )
    ok = asyncio.run(writer.drain_once(item))
    assert ok is True
    assert redis.last_fields is not None
    assert redis.last_fields["symbol"] == "2330"
    assert redis.last_fields["source"] == "shioaji"
    assert redis.last_fields["ingest_seq"] == "7"
    assert redis.last_fields["last_price"] == "900.5"
