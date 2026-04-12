from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import suppress
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from zoneinfo import ZoneInfo

from app.stream_processing.runner import build_state_key, trade_date_for, unix_seconds

logger = logging.getLogger(__name__)

TZ_TAIPEI = ZoneInfo("Asia/Taipei")


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _parse_json(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _parse_event_ts(event_ts: str) -> datetime | None:
    text = event_ts.strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
        for fmt in (
            "%Y/%m/%d %H:%M:%S.%f",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        ):
            with suppress(ValueError):
                parsed = datetime.strptime(text, fmt)
                break
        if parsed is None:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ_TAIPEI)
    return parsed.astimezone(TZ_TAIPEI)


def _extract_number(payload: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


@dataclass(frozen=True)
class OtcSummarySnapshot:
    code: str
    trade_date: date
    minute_ts: datetime
    event_ts: datetime
    index_value: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "trade_date": self.trade_date.isoformat(),
            "minute_ts": self.minute_ts.isoformat(),
            "event_ts": self.event_ts.isoformat(),
            "index_value": self.index_value,
        }


class OtcSummaryRunner:
    _stream_refresh_seconds = 5.0

    def __init__(
        self,
        redis_client: Any,
        metrics: Any,
        env: str,
        code: str,
        group: str,
        consumer: str,
        read_count: int,
        block_ms: int,
        claim_idle_ms: int,
        claim_count: int,
        ttl_seconds: int,
    ) -> None:
        self._redis = redis_client
        self._metrics = metrics
        self._env = env
        self._code = code
        self._group = group
        self._consumer = consumer
        self._read_count = read_count
        self._block_ms = block_ms
        self._claim_idle_ms = claim_idle_ms
        self._claim_count = claim_count
        self._ttl_seconds = ttl_seconds
        self._stream_key = f"{self._env}:stream:market:{self._code}"
        self._last_stream_refresh = 0.0
        self._stop = False
        self._task: asyncio.Task[None] | None = None

    def ensure_consumer_group(self) -> None:
        try:
            self._redis.xgroup_create(self._stream_key, self._group, id="0-0", mkstream=True)
        except Exception as err:  # pragma: no cover
            if "BUSYGROUP" in str(err).upper():
                return
            raise

    async def start(self) -> None:
        self.ensure_consumer_group()
        self._stop = False
        self._task = asyncio.create_task(self._run_loop())

    def stop(self) -> None:
        self._stop = True

    async def stop_async(self) -> None:
        self._stop = True
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task

    async def _run_loop(self) -> None:
        while not self._stop:
            processed = self.consume_once()
            if processed == 0:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0)

    def consume_once(self) -> int:
        self._refresh_stream()
        processed = 0
        for entry_id, fields in self._claim_pending():
            if self._handle_entry(entry_id, fields):
                self._redis.xack(self._stream_key, self._group, entry_id)
                processed += 1
        for entry_id, fields in self._read_new():
            if self._handle_entry(entry_id, fields):
                self._redis.xack(self._stream_key, self._group, entry_id)
                processed += 1
        return processed

    def _refresh_stream(self) -> None:
        now = time.monotonic()
        if now - self._last_stream_refresh < self._stream_refresh_seconds:
            return
        self._last_stream_refresh = now
        self.ensure_consumer_group()

    def _claim_pending(self) -> list[tuple[str, dict[str, Any]]]:
        try:
            _next, entries, _deleted = self._redis.xautoclaim(
                self._stream_key,
                self._group,
                self._consumer,
                min_idle_time=self._claim_idle_ms,
                start_id="0-0",
                count=self._claim_count,
            )
            return list(entries)
        except Exception:
            return []

    def _read_new(self) -> list[tuple[str, dict[str, Any]]]:
        try:
            entries = self._redis.xreadgroup(
                groupname=self._group,
                consumername=self._consumer,
                streams={self._stream_key: ">"},
                count=self._read_count,
                block=self._block_ms,
            )
        except Exception:
            return []
        result: list[tuple[str, dict[str, Any]]] = []
        for _stream, messages in entries or []:
            for entry_id, fields in messages:
                result.append((entry_id, fields))
        return result

    def _normalize_fields(self, fields: dict[str, Any]) -> dict[str, Any]:
        normalized = {_decode(k): _decode(v) for k, v in fields.items()}
        if "payload" in normalized:
            normalized["payload"] = _parse_json(normalized["payload"])
        return normalized

    def _handle_entry(self, entry_id: str, fields: dict[str, Any]) -> bool:
        _ = entry_id
        data = self._normalize_fields(fields)
        code = str(data.get("code") or self._code).strip()
        if not code:
            self._metrics.inc("otc_summary_invalid_events_total")
            return True
        event_ts = _parse_event_ts(str(data.get("event_ts") or ""))
        if event_ts is None:
            self._metrics.inc("otc_summary_invalid_events_total")
            return True
        payload = data.get("payload")
        if not isinstance(payload, dict):
            self._metrics.inc("otc_summary_invalid_events_total")
            return True
        index_value = _extract_number(payload, ("index_value", "close", "price", "value"))
        if index_value is None:
            self._metrics.inc("otc_summary_invalid_events_total")
            return True
        snapshot = OtcSummarySnapshot(
            code=code,
            trade_date=trade_date_for(event_ts),
            minute_ts=event_ts.replace(second=0, microsecond=0),
            event_ts=event_ts,
            index_value=index_value,
        )
        try:
            self._write_snapshot(snapshot)
            self._metrics.inc("otc_summary_events_processed_total")
            self._metrics.set_gauge(
                "otc_summary_stream_lag_ms",
                int(max((datetime.now(tz=TZ_TAIPEI) - event_ts).total_seconds() * 1000, 0)),
            )
            return True
        except Exception:
            logger.exception("otc summary write failed")
            self._metrics.inc("otc_summary_redis_write_errors_total")
            return False

    def _write_snapshot(self, snapshot: OtcSummarySnapshot) -> None:
        latest_key = build_state_key(
            self._env, snapshot.code, snapshot.trade_date, "otc_summary:latest"
        )
        zset_key = build_state_key(
            self._env, snapshot.code, snapshot.trade_date, "otc_summary:zset"
        )
        member = json.dumps(snapshot.to_dict(), ensure_ascii=True)
        self._redis.set(latest_key, member)
        self._redis.expire(latest_key, self._ttl_seconds)
        self._redis.zadd(zset_key, {member: unix_seconds(snapshot.event_ts)})
        self._redis.expire(zset_key, self._ttl_seconds)
