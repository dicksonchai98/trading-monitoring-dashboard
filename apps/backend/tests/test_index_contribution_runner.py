from __future__ import annotations

import json
import sys
import types
from datetime import date, datetime, timezone
from typing import Any

import pytest
from app.index_contribution.runner import IndexContributionRunner
from app.services.metrics import Metrics


class _FakeRedis:
    def __init__(self) -> None:
        self.strings: dict[str, str] = {}
        self.zsets: dict[str, dict[str, float]] = {}
        self.expirations: dict[str, int] = {}
        self._claimed_entries: list[tuple[str, dict[str, Any]]] = []
        self._new_entries: list[tuple[str, dict[str, Any]]] = []
        self.acks: list[tuple[str, str, str]] = []
        self.groups: list[tuple[str, str]] = []

    def set(self, key: str, value: str) -> None:
        self.strings[key] = value

    def expire(self, key: str, ttl: int) -> None:
        self.expirations[key] = ttl

    def delete(self, key: str) -> None:
        self.zsets.pop(key, None)

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self.zsets.setdefault(key, {}).update(mapping)

    def xgroup_create(
        self,
        key: str,
        group: str,
        stream_id: str = "0-0",
        mkstream: bool = True,
    ) -> None:
        _ = (stream_id, mkstream)
        self.groups.append((key, group))

    def xautoclaim(
        self,
        key: str,
        group: str,
        consumer: str,
        min_idle_time: int,
        start_id: str = "0-0",
        count: int = 1,
    ):
        _ = (key, group, consumer, min_idle_time, start_id, count)
        entries = self._claimed_entries[:count]
        self._claimed_entries = self._claimed_entries[count:]
        return "0-0", entries, []

    def xreadgroup(
        self,
        groupname: str,
        consumername: str,
        streams: dict[str, str],
        count: int = 1,
        block: int = 0,
    ):
        _ = (groupname, consumername, streams, block)
        stream_key = next(iter(streams.keys()))
        entries = self._new_entries[:count]
        self._new_entries = self._new_entries[count:]
        return [(stream_key, entries)] if entries else []

    def xack(self, key: str, group: str, entry_id: str) -> int:
        self.acks.append((key, group, entry_id))
        return 1


class _FlakyRedis(_FakeRedis):
    def __init__(self) -> None:
        super().__init__()
        self._failed = False

    def set(self, key: str, value: str) -> None:
        if not self._failed:
            self._failed = True
            raise RuntimeError("redis unavailable")
        super().set(key, value)


def _build_runner() -> IndexContributionRunner:
    return IndexContributionRunner(
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        env="dev",
        group="index-contrib:spot",
        consumer="index-contrib-1",
        read_count=200,
        block_ms=1000,
        claim_idle_ms=30000,
        claim_count=200,
        index_code="TSE001",
        index_prev_close=22000.0,
        redis_ttl_seconds=3600,
        redis_max_retries=2,
        redis_retry_backoff_ms=0,
    )


def test_publish_symbol_latest_writes_json_and_ttl() -> None:
    runner = _build_runner()
    updated_at = datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc)
    runner.engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=950.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=updated_at,
        event_id="evt-100",
    )

    runner.publish_symbol_latest(trade_date=date(2026, 4, 6), symbol="2330")
    redis = runner._redis  # noqa: SLF001
    key = "dev:state:index_contrib:TSE001:2026-04-06:2330:latest"
    assert key in redis.strings
    payload = json.loads(redis.strings[key])
    assert payload["symbol"] == "2330"
    assert payload["symbol_name"] == "TSMC"
    assert redis.expirations[key] == 3600


def test_publish_rankings_and_sector_aggregate() -> None:
    runner = _build_runner()
    updated_at = datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc)
    runner.engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=950.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=updated_at,
        event_id="evt-101",
    )
    runner.engine.apply_update(
        symbol="2317",
        symbol_name="HonHai",
        mapping_sector="Electronics Manufacturing",
        table_sector="Electronics Manufacturing",
        last_price=200.0,
        prev_close=210.0,
        weight=0.05,
        updated_at=updated_at,
        event_id="evt-102",
    )

    runner.publish_rankings(trade_date=date(2026, 4, 6), limit=20)
    runner.publish_sector_aggregate(trade_date=date(2026, 4, 6))

    redis = runner._redis  # noqa: SLF001
    top_key = "dev:state:index_contrib:TSE001:2026-04-06:ranking:top"
    bottom_key = "dev:state:index_contrib:TSE001:2026-04-06:ranking:bottom"
    sector_key = "dev:state:index_contrib:TSE001:2026-04-06:sector"
    assert "2330" in redis.zsets[top_key]
    assert "2317" in redis.zsets[bottom_key]
    assert top_key in redis.expirations
    assert bottom_key in redis.expirations
    assert sector_key in redis.strings

    # Verify treemap data structure
    import json

    sector_data = json.loads(redis.strings[sector_key])
    assert isinstance(sector_data, list)
    assert len(sector_data) > 0
    # Find semiconductor sector
    semiconductor_sector = next((s for s in sector_data if s["name"] == "semiconductor"), None)
    assert semiconductor_sector is not None
    assert "children" in semiconductor_sector
    assert isinstance(semiconductor_sector["children"], list)
    # Check for 2330 in children
    symbol_2330 = next((c for c in semiconductor_sector["children"] if c["name"] == "2330"), None)
    assert symbol_2330 is not None
    assert "size" in symbol_2330
    assert "contribution_points" in symbol_2330


def test_publish_symbol_latest_retries_on_redis_failure() -> None:
    runner = IndexContributionRunner(
        redis_client=_FlakyRedis(),
        metrics=Metrics(),
        env="dev",
        group="index-contrib:spot",
        consumer="index-contrib-1",
        read_count=200,
        block_ms=1000,
        claim_idle_ms=30000,
        claim_count=200,
        index_code="TSE001",
        index_prev_close=22000.0,
        redis_ttl_seconds=3600,
        redis_max_retries=2,
        redis_retry_backoff_ms=0,
    )
    runner.engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=950.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc),
        event_id="evt-103",
    )

    runner.publish_symbol_latest(trade_date=date(2026, 4, 6), symbol="2330")

    assert runner._metrics.counters["index_contribution_redis_symbol_write_errors_total"] == 1  # noqa: SLF001
    assert runner._metrics.counters["index_contribution_redis_symbol_write_total"] == 1  # noqa: SLF001


def test_minute_boundary_and_late_event_policy_defaults() -> None:
    runner = _build_runner()
    now = datetime(2026, 4, 6, 10, 30, 45, tzinfo=timezone.utc)

    should_flush, minute_ts = runner.should_flush_minute(now)
    assert should_flush is True
    assert minute_ts.second == 0
    runner._last_flushed_minute_ts = minute_ts  # noqa: SLF001

    should_flush_again, _ = runner.should_flush_minute(now)
    assert should_flush_again is False

    old_event = datetime(2026, 4, 6, 10, 29, 30, tzinfo=timezone.utc)
    assert runner.should_accept_late_event_snapshot(old_event) is False


def test_daily_reset_clears_states_and_reloads_inputs() -> None:
    class _Loader:
        def __init__(self) -> None:
            self.calls = 0

        def load(self):
            self.calls += 1
            from app.index_contribution.daily_inputs import ConstituentMeta, DailyInputs

            return DailyInputs(
                index_prev_close=23000.0,
                constituents={
                    "2330": ConstituentMeta(
                        symbol="2330",
                        symbol_name="TSMC",
                        weight=0.3,
                        weight_version="v2",
                        weight_generated_at="2026-04-07T08:30:00+08:00",
                        table_sector="Semiconductor",
                    )
                },
                sector_mapping={"2330": "Semiconductor"},
            )

    loader = _Loader()
    runner = _build_runner()
    runner._daily_input_loader = loader  # noqa: SLF001
    runner.engine.symbol_state["2330"] = {"symbol": "2330"}
    runner.engine.sector_aggregate["Semiconductor"] = 1.23

    runner.daily_reset(new_trade_date=date(2026, 4, 7))

    assert runner._active_trade_date == date(2026, 4, 7)  # noqa: SLF001
    assert runner.engine.symbol_state == {}
    assert runner.engine.sector_aggregate == {}
    assert runner.engine.index_prev_close == 23000.0
    assert loader.calls == 1
    assert runner._metrics.counters["index_contribution_daily_reset_total"] == 1  # noqa: SLF001


def test_warm_restart_rebuild_prefers_redis_then_db() -> None:
    runner = _build_runner()

    source = runner.warm_restart_rebuild(
        from_redis=lambda _engine: True,
        from_db=lambda _engine: True,
    )
    assert source == "redis"

    source2 = runner.warm_restart_rebuild(
        from_redis=lambda _engine: False,
        from_db=lambda _engine: True,
    )
    assert source2 == "db"

    source3 = runner.warm_restart_rebuild(
        from_redis=lambda _engine: False,
        from_db=lambda _engine: False,
    )
    assert source3 == "empty"


def test_redis_alarm_triggers_after_threshold() -> None:
    alarms: list[dict[str, object]] = []
    runner = IndexContributionRunner(
        redis_client=_FlakyRedis(),
        metrics=Metrics(),
        env="dev",
        group="index-contrib:spot",
        consumer="index-contrib-1",
        read_count=200,
        block_ms=1000,
        claim_idle_ms=30000,
        claim_count=200,
        index_code="TSE001",
        index_prev_close=22000.0,
        redis_ttl_seconds=3600,
        redis_max_retries=1,
        redis_retry_backoff_ms=0,
        alarm_sink=alarms.append,
        redis_failure_alarm_threshold=1,
    )
    runner.engine.apply_update(
        symbol="2330",
        symbol_name="TSMC",
        mapping_sector="Semiconductor",
        table_sector="Semiconductor",
        last_price=950.0,
        prev_close=940.0,
        weight=0.31,
        updated_at=datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc),
        event_id="evt-104",
    )

    with pytest.raises(RuntimeError):
        runner.publish_symbol_latest(trade_date=date(2026, 4, 6), symbol="2330")

    assert alarms
    assert alarms[0]["channel"] == "redis"


def test_process_market_update_uses_constituents_and_metrics() -> None:
    runner = _build_runner()
    runner._constituents = {  # noqa: SLF001
        "2330": {
            "symbol_name": "TSMC",
            "weight": 0.31,
            "weight_version": "v1",
            "table_sector": "Semiconductor",
        }
    }
    runner._sector_mapping = {"2330": "Semiconductor"}  # noqa: SLF001

    accepted = runner.process_market_update(
        symbol="2330",
        last_price=950.0,
        prev_close=940.0,
        updated_at=datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc),
        event_id="evt-105",
    )
    dropped = runner.process_market_update(
        symbol="9999",
        last_price=10.0,
        prev_close=10.0,
        updated_at=datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc),
        event_id="evt-106",
    )

    assert accepted is True
    assert dropped is False
    assert runner._metrics.counters["index_contribution_events_accepted_total"] == 1  # noqa: SLF001
    assert runner._metrics.counters["index_contribution_events_dropped_non_constituent_total"] == 1  # noqa: SLF001


def test_end_to_end_event_to_redis_and_minute_flush(monkeypatch) -> None:
    recorded = {"symbol": 0, "ranking": 0, "sector": 0}

    fake_writer = types.ModuleType("app.index_contribution.writer")

    def _flush_symbol_snapshots(**_kwargs):
        recorded["symbol"] += 1

    def _flush_ranking_snapshots(**_kwargs):
        recorded["ranking"] += 1

    def _flush_sector_snapshots(**_kwargs):
        recorded["sector"] += 1

    fake_writer.flush_symbol_snapshots = _flush_symbol_snapshots  # type: ignore[attr-defined]
    fake_writer.flush_ranking_snapshots = _flush_ranking_snapshots  # type: ignore[attr-defined]
    fake_writer.flush_sector_snapshots = _flush_sector_snapshots  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "app.index_contribution.writer", fake_writer)

    class _DummySession:
        def __enter__(self):
            return self

        def __exit__(self, _exc_type, _exc, _tb):
            return False

        def commit(self) -> None:
            return None

    runner = IndexContributionRunner(
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        env="dev",
        group="index-contrib:spot",
        consumer="index-contrib-1",
        read_count=200,
        block_ms=1000,
        claim_idle_ms=30000,
        claim_count=200,
        index_code="TSE001",
        index_prev_close=22000.0,
        redis_ttl_seconds=3600,
        redis_max_retries=1,
        redis_retry_backoff_ms=0,
        session_factory=lambda: _DummySession(),
    )
    runner._constituents = {  # noqa: SLF001
        "2330": {
            "symbol_name": "TSMC",
            "weight": 0.31,
            "weight_version": "v1",
            "table_sector": "Semiconductor",
        }
    }
    runner._sector_mapping = {"2330": "Semiconductor"}  # noqa: SLF001

    accepted = runner.process_market_update(
        symbol="2330",
        last_price=950.0,
        prev_close=940.0,
        updated_at=datetime(2026, 4, 6, 10, 30, tzinfo=timezone.utc),
        event_id="evt-200",
    )
    assert accepted is True

    runner.publish_symbol_latest(trade_date=date(2026, 4, 6), symbol="2330")
    runner.publish_rankings(trade_date=date(2026, 4, 6))
    runner.publish_sector_aggregate(trade_date=date(2026, 4, 6))
    flushed = runner.flush_minute_snapshots(now=datetime(2026, 4, 6, 18, 30, tzinfo=timezone.utc))

    assert flushed is True
    assert recorded == {"symbol": 1, "ranking": 1, "sector": 1}


def test_parse_spot_entry_uses_raw_quote_close_when_last_price_zero() -> None:
    runner = _build_runner()
    parsed = runner._parse_spot_entry(  # noqa: SLF001
        "1775802833106-0",
        {
            "symbol": "6505",
            "event_ts": "2026-04-10T14:30:00",
            "last_price": "0",
            "payload": json.dumps({"raw_quote": {"close": "52", "price_chg": "-0.7"}}),
        },
    )
    assert parsed is not None
    assert parsed["symbol"] == "6505"
    assert parsed["last_price"] == 52.0


def test_consume_once_reads_spot_stream_and_acks_processed_entry() -> None:
    redis = _FakeRedis()
    redis._new_entries = [  # noqa: SLF001
        (
            "1775802833106-0",
            {
                "symbol": "2330",
                "event_ts": "2026-04-10T14:30:00",
                "last_price": "0",
                "ingest_seq": "10",
                "payload": json.dumps(
                    {
                        "raw_quote": {"close": "950", "price_chg": "10"},
                    }
                ),
            },
        )
    ]
    runner = IndexContributionRunner(
        redis_client=redis,
        metrics=Metrics(),
        env="dev",
        group="index-contrib:spot",
        consumer="index-contrib-1",
        read_count=200,
        block_ms=1000,
        claim_idle_ms=30000,
        claim_count=200,
        index_code="TSE001",
        index_prev_close=22000.0,
        redis_ttl_seconds=3600,
        redis_max_retries=1,
        redis_retry_backoff_ms=0,
        stream_key="dev:stream:spot",
    )
    runner._constituents = {  # noqa: SLF001
        "2330": {
            "symbol_name": "TSMC",
            "weight": 0.31,
            "weight_version": "v1",
            "table_sector": "Semiconductor",
        }
    }
    runner._sector_mapping = {"2330": "Semiconductor"}  # noqa: SLF001

    processed = runner.consume_once()

    assert processed == 1
    assert redis.acks == [("dev:stream:spot", "index-contrib:spot", "1775802833106-0")]
