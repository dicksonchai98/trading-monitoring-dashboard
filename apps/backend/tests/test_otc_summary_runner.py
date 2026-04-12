from __future__ import annotations

import json

from app.otc_summary.runner import OtcSummaryRunner
from app.services.metrics import Metrics


class _FakeRedis:
    def __init__(self, claim_entries=None, read_entries=None) -> None:
        self.claim_entries = claim_entries or []
        self.read_entries = read_entries or []
        self.created_groups: list[tuple[str, str, str]] = []
        self.acks: list[tuple[str, str, str]] = []
        self.writes: dict[str, dict[str, object]] = {}
        self.expired: list[tuple[str, int]] = []

    def xgroup_create(self, stream_key, group, id="0-0", mkstream=True):  # noqa: A002
        self.created_groups.append((stream_key, group, id))
        return True

    def xautoclaim(self, *_args, **_kwargs):
        return "0-0", list(self.claim_entries), []

    def xreadgroup(self, **_kwargs):
        stream_name = self.claim_entries[0][0] if self.claim_entries else "stream"
        return [(stream_name, list(self.read_entries))]

    def xack(self, stream_key, group, entry_id):
        self.acks.append((stream_key, group, entry_id))
        return 1

    def set(self, key, value):
        self.writes.setdefault(key, {})["set"] = value
        return True

    def zadd(self, key, mapping):
        self.writes.setdefault(key, {})["zadd"] = mapping
        return 1

    def expire(self, key, ttl):
        self.expired.append((key, ttl))
        return True


def _build_runner(redis: _FakeRedis) -> OtcSummaryRunner:
    return OtcSummaryRunner(
        redis_client=redis,
        metrics=Metrics(),
        env="dev",
        code="OTC001",
        group="agg:otc",
        consumer="agg-otc-1",
        read_count=100,
        block_ms=1000,
        claim_idle_ms=30000,
        claim_count=100,
        ttl_seconds=86400,
    )


def test_otc_summary_runner_writes_latest_and_today_from_pending_and_new_entries() -> None:
    pending = (
        "1-0",
        {
            "code": "OTC001",
            "event_ts": "2026-04-09T16:05:12+08:00",
            "payload": json.dumps({"index_value": 150.25}),
        },
    )
    new = (
        "2-0",
        {
            "code": "OTC001",
            "event_ts": "2026-04-09T16:06:12+08:00",
            "payload": json.dumps({"index_value": 150.5}),
        },
    )
    redis = _FakeRedis(claim_entries=[pending], read_entries=[new])
    runner = _build_runner(redis)

    processed = runner.consume_once()

    assert processed == 2
    latest_key = "dev:state:OTC001:2026-04-09:otc_summary:latest"
    zset_key = "dev:state:OTC001:2026-04-09:otc_summary:zset"
    assert latest_key in redis.writes
    assert zset_key in redis.writes
    latest_payload = json.loads(redis.writes[latest_key]["set"])
    assert latest_payload["code"] == "OTC001"
    assert latest_payload["index_value"] == 150.5
    assert len(redis.acks) == 2
    assert redis.acks[0] == ("dev:stream:market:OTC001", "agg:otc", "1-0")
    assert redis.acks[1] == ("dev:stream:market:OTC001", "agg:otc", "2-0")


def test_otc_summary_runner_skips_invalid_events_without_writes() -> None:
    redis = _FakeRedis(
        claim_entries=[
            (
                "1-0",
                {
                    "code": "OTC001",
                    "event_ts": "not-a-timestamp",
                    "payload": json.dumps({"index_value": 150.25}),
                },
            )
        ]
    )
    runner = _build_runner(redis)

    processed = runner.consume_once()

    assert processed == 1
    assert redis.writes == {}
    assert redis.acks == [("dev:stream:market:OTC001", "agg:otc", "1-0")]
    assert runner._metrics.counters["otc_summary_invalid_events_total"] == 1


def test_otc_summary_runner_ensures_consumer_group() -> None:
    redis = _FakeRedis()
    runner = _build_runner(redis)

    runner.ensure_consumer_group()

    assert redis.created_groups == [("dev:stream:market:OTC001", "agg:otc", "0-0")]
