from __future__ import annotations

import asyncio

from app.market_ingestion.pipeline import IngestionPipeline
from app.market_ingestion.runner import MarketIngestionRunner
from app.market_ingestion.shioaji_client import ShioajiClient
from app.market_ingestion.writer import RedisWriter
from app.services.metrics import Metrics


class FakeRedis:
    def __init__(self) -> None:
        self.writes: list[tuple[str, dict[str, str]]] = []

    def xadd(self, key, fields, maxlen, approximate):
        _ = (maxlen, approximate)
        self.writes.append((key, fields))
        return "1-0"


def test_ingestor_flow_callback_to_redis_write() -> None:
    metrics = Metrics()
    pipeline = IngestionPipeline(queue_maxsize=4, metrics=metrics)
    redis = FakeRedis()
    writer = RedisWriter(redis_client=redis, metrics=metrics, maxlen=100000)
    event = pipeline.build_event(
        code="MTX",
        quote_type="tick",
        payload={"price": 20000},
        event_ts="2026-02-28T00:00:00+00:00",
    )
    assert pipeline.enqueue("dev:stream:tick:MTX", event) is True
    item = pipeline.queue.get_nowait()
    ok = asyncio.run(writer.drain_once(item))
    assert ok is True
    assert len(redis.writes) == 1
    assert redis.writes[0][0] == "dev:stream:tick:MTX"


class FakeQuote:
    def __init__(self) -> None:
        self.subscriptions: list[tuple[object, object, object | None]] = []
        self.tick_callback = None
        self.bidask_callback = None

    def set_on_tick_fop_v1_callback(self, callback) -> None:
        self.tick_callback = callback

    def set_on_bidask_fop_v1_callback(self, callback) -> None:
        self.bidask_callback = callback

    def subscribe(self, contract, quote_type, version=None) -> None:
        self.subscriptions.append((contract, quote_type, version))


class FakeAPI:
    def __init__(self) -> None:
        self.quote = FakeQuote()
        self.Contracts = type("Contracts", (), {"Futures": {"MTXR1": object(), "MTX": object()}})
        self.login_attempts = 0
        self.fail_first_login = True

    def login(self, **_kwargs):
        self.login_attempts += 1
        if self.fail_first_login:
            self.fail_first_login = False
            raise RuntimeError("disconnected")
        return ["ok"]

    def fetch_contracts(self, **_kwargs):
        return None

    def logout(self):
        return None


def test_reconnect_resubscribes_after_login_recovery() -> None:
    metrics = Metrics()
    api = FakeAPI()
    redis = FakeRedis()
    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(
            api=api,
            api_key="k",
            secret_key="s",
            simulation=True,
        ),
        redis_client=redis,
        metrics=metrics,
        queue_maxsize=8,
        stream_maxlen=100000,
        retry_attempts=1,
        retry_backoff_ms=0,
    )
    asyncio.run(runner.handle_disconnect(max_attempts=2))
    assert api.login_attempts == 2
    assert len(api.quote.subscriptions) >= 2
