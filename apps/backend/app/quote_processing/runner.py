"""Quote worker runner for Redis Stream quote feature processing."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable
from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from zoneinfo import ZoneInfo

from app.market_ingestion.stream_keys import build_stream_key
from app.services.metrics import Metrics
from app.stream_processing.runner import build_state_key, parse_event_ts, trade_date_for

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


def _extract_number(payload: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = payload.get(key, default)
    if isinstance(value, (list, tuple)) and value:
        value = value[0]
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _unix_seconds(ts: datetime) -> int:
    return int(ts.timestamp())


def _minute_floor(ts: datetime) -> datetime:
    return ts.replace(second=0, microsecond=0)


def _strength(value: float, day_low: float, day_high: float) -> float:
    if day_high == day_low:
        return 0.5
    return max(0.0, min((value - day_low) / (day_high - day_low), 1.0))


def _is_outside(tick_type: Any) -> bool:
    normalized = str(tick_type).strip().lower()
    return normalized in {"1", "outside", "out"}


@dataclass
class QuoteSnapshot:
    code: str
    event_ts: datetime
    main_chip: float
    main_chip_day_high: float
    main_chip_day_low: float
    main_chip_strength: float
    long_short_force: float
    long_short_force_day_high: float
    long_short_force_day_low: float
    long_short_force_strength: float

    def to_payload(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "trade_date": trade_date_for(self.event_ts).isoformat(),
            "event_ts": self.event_ts.isoformat(),
            "main_chip": self.main_chip,
            "main_chip_day_high": self.main_chip_day_high,
            "main_chip_day_low": self.main_chip_day_low,
            "main_chip_strength": self.main_chip_strength,
            "long_short_force": self.long_short_force,
            "long_short_force_day_high": self.long_short_force_day_high,
            "long_short_force_day_low": self.long_short_force_day_low,
            "long_short_force_strength": self.long_short_force_strength,
        }


class QuoteFeatureState:
    def __init__(self) -> None:
        self.outside_volume = 0.0
        self.inside_volume = 0.0
        self.main_chip_day_high: float | None = None
        self.main_chip_day_low: float | None = None
        self.force_day_high: float | None = None
        self.force_day_low: float | None = None
        self.last_trade_date = None
        self.current_minute: datetime | None = None
        self.current_minute_last_snapshot: QuoteSnapshot | None = None

    def reset_for_trade_date(self, event_ts: datetime) -> None:
        self.outside_volume = 0.0
        self.inside_volume = 0.0
        self.main_chip_day_high = None
        self.main_chip_day_low = None
        self.force_day_high = None
        self.force_day_low = None
        self.current_minute = _minute_floor(event_ts)
        self.current_minute_last_snapshot = None
        self.last_trade_date = trade_date_for(event_ts)

    def apply(
        self, code: str, event_ts: datetime, payload: dict[str, Any]
    ) -> tuple[QuoteSnapshot, QuoteSnapshot | None]:
        event_trade_date = trade_date_for(event_ts)
        if self.last_trade_date != event_trade_date:
            self.reset_for_trade_date(event_ts)

        main_chip = _extract_number(payload, "ask_side_total_cnt") - _extract_number(
            payload, "bid_side_total_cnt"
        )
        volume = _extract_number(payload, "volume")
        if _is_outside(payload.get("tick_type")):
            self.outside_volume += volume
        else:
            self.inside_volume += volume

        force = self.outside_volume - self.inside_volume
        self.main_chip_day_high = (
            main_chip
            if self.main_chip_day_high is None
            else max(self.main_chip_day_high, main_chip)
        )
        self.main_chip_day_low = (
            main_chip if self.main_chip_day_low is None else min(self.main_chip_day_low, main_chip)
        )
        self.force_day_high = (
            force if self.force_day_high is None else max(self.force_day_high, force)
        )
        self.force_day_low = force if self.force_day_low is None else min(self.force_day_low, force)
        main_chip_day_high = (
            self.main_chip_day_high if self.main_chip_day_high is not None else main_chip
        )
        main_chip_day_low = (
            self.main_chip_day_low if self.main_chip_day_low is not None else main_chip
        )
        force_day_high = self.force_day_high if self.force_day_high is not None else force
        force_day_low = self.force_day_low if self.force_day_low is not None else force

        snapshot = QuoteSnapshot(
            code=code,
            event_ts=event_ts,
            main_chip=main_chip,
            main_chip_day_high=main_chip_day_high,
            main_chip_day_low=main_chip_day_low,
            main_chip_strength=_strength(main_chip, main_chip_day_low, main_chip_day_high),
            long_short_force=force,
            long_short_force_day_high=force_day_high,
            long_short_force_day_low=force_day_low,
            long_short_force_strength=_strength(force, force_day_low, force_day_high),
        )

        archived: QuoteSnapshot | None = None
        event_minute = _minute_floor(event_ts)
        if self.current_minute is None:
            self.current_minute = event_minute
        elif event_minute > self.current_minute:
            archived = self.current_minute_last_snapshot
            self.current_minute = event_minute
            self.current_minute_last_snapshot = None

        self.current_minute_last_snapshot = snapshot
        return snapshot, archived


class QuoteWorkerRunner:
    def __init__(
        self,
        redis_client: Any,
        session_factory: Callable[[], Any],
        metrics: Metrics,
        env: str,
        code: str,
        group: str,
        consumer: str,
        stream_maxlen: int,
        redis_retry_attempts: int,
        redis_retry_backoff_ms: int,
        db_flush_enabled: bool,
        read_count: int = 100,
        block_ms: int = 1000,
        claim_idle_ms: int = 30000,
        claim_count: int = 100,
        db_sink_batch_size: int = 100,
        db_sink_max_retries: int = 5,
        db_sink_retry_backoff_seconds: float = 0.5,
        dead_letter_maxlen: int = 10000,
    ) -> None:
        self._redis = redis_client
        self._session_factory = session_factory
        self._metrics = metrics
        self._env = env
        self._code = code
        self._group = group
        self._consumer = consumer
        self._stream_maxlen = stream_maxlen
        self._redis_retry_attempts = max(1, redis_retry_attempts)
        self._redis_retry_backoff_ms = max(0, redis_retry_backoff_ms)
        self._db_flush_enabled = db_flush_enabled
        self._read_count = read_count
        self._block_ms = block_ms
        self._claim_idle_ms = claim_idle_ms
        self._claim_count = claim_count
        self._db_sink_batch_size = max(1, db_sink_batch_size)
        self._db_sink_max_retries = max(1, db_sink_max_retries)
        self._db_sink_retry_backoff_seconds = max(0.0, db_sink_retry_backoff_seconds)
        self._dead_letter_maxlen = max(100, dead_letter_maxlen)
        self._task: asyncio.Task[None] | None = None
        self._db_sink_task: asyncio.Task[None] | None = None
        self._stop = False
        self._state = QuoteFeatureState()
        self._db_queue: asyncio.Queue[QuoteSnapshot] = asyncio.Queue(maxsize=4096)
        self._pending_batch: list[QuoteSnapshot] = []
        self._pending_retries = 0

    @property
    def _stream_key(self) -> str:
        return build_stream_key(self._env, "quote", self._code)

    async def start(self) -> None:
        self._stop = False
        self.ensure_consumer_groups()
        self._task = asyncio.create_task(self._run_loop())
        self._db_sink_task = asyncio.create_task(self._run_db_sink_loop())

    async def stop_async(self) -> None:
        self._stop = True
        for task in (self._task, self._db_sink_task):
            if task is not None and not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        self.flush_db_sink_once()

    def ensure_consumer_groups(self) -> None:
        try:
            self._redis.xgroup_create(self._stream_key, self._group, id="0-0", mkstream=True)
        except Exception as err:
            if "BUSYGROUP" not in str(err).upper():
                raise

    async def _run_loop(self) -> None:
        while not self._stop:
            processed = self.consume_once()
            if processed == 0:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0)

    async def _run_db_sink_loop(self) -> None:
        while not self._stop:
            if not self._db_flush_enabled:
                await asyncio.sleep(0.2)
                continue
            try:
                flushed = await self._flush_db_sink_once_async()
                if flushed == 0:
                    await asyncio.sleep(0.1)
            except Exception:
                logger.exception("quote db sink flush failed")
                await asyncio.sleep(self._db_sink_retry_backoff_seconds)

    def consume_once(self) -> int:
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
            result = self._redis.xreadgroup(
                groupname=self._group,
                consumername=self._consumer,
                streams={self._stream_key: ">"},
                count=self._read_count,
                block=self._block_ms,
            )
        except Exception:
            return []
        items: list[tuple[str, dict[str, Any]]] = []
        for _stream, messages in result or []:
            for entry_id, fields in messages:
                items.append((entry_id, fields))
        return items

    def _normalize_fields(self, fields: dict[str, Any]) -> dict[str, Any]:
        normalized = {_decode(k): _decode(v) for k, v in fields.items()}
        if "payload" in normalized:
            normalized["payload"] = _parse_json(normalized["payload"])
        return normalized

    def _write_snapshot_to_redis(self, snapshot: QuoteSnapshot) -> bool:
        payload = snapshot.to_payload()
        trade_date = trade_date_for(snapshot.event_ts)
        latest_key = build_state_key(self._env, snapshot.code, trade_date, "quote_features:latest")
        zset_key = build_state_key(self._env, snapshot.code, trade_date, "quote_features:zset")
        member = json.dumps(payload, ensure_ascii=True)
        for attempt in range(self._redis_retry_attempts):
            try:
                self._redis.set(latest_key, member)
                self._redis.zadd(zset_key, {member: _unix_seconds(snapshot.event_ts)})
                self._redis.expire(latest_key, 60 * 60 * 24)
                self._redis.expire(zset_key, 60 * 60 * 24)
                return True
            except Exception:
                if attempt + 1 >= self._redis_retry_attempts:
                    return False
                if self._redis_retry_backoff_ms > 0:
                    time.sleep(self._redis_retry_backoff_ms / 1000)
        return False

    def _handle_entry(self, _entry_id: str, fields: dict[str, Any]) -> bool:
        data = self._normalize_fields(fields)
        code = data.get("code")
        if not isinstance(code, str) or not code:
            return True
        event_ts = parse_event_ts(str(data.get("event_ts", "")))
        if event_ts is None:
            return True
        payload = data.get("payload")
        if not isinstance(payload, dict):
            payload = {}

        try:
            snapshot, archived = self._state.apply(code=code, event_ts=event_ts, payload=payload)
            if not self._write_snapshot_to_redis(snapshot):
                self._metrics.inc("quote_write_errors")
                return False
            if archived is not None and self._db_flush_enabled:
                self._db_queue.put_nowait(archived)
            self._metrics.inc("quote_consume_rate")
            return True
        except asyncio.QueueFull:
            self._metrics.inc("quote_sink_backpressure")
            return False
        except Exception:
            self._metrics.inc("quote_write_errors")
            logger.exception("quote entry processing failed")
            return False

    def flush_db_sink_once(self) -> int:
        total = 0
        while True:
            flushed = self._flush_db_sink_once()
            total += flushed
            if flushed == 0:
                return total

    def _acquire_batch(self) -> list[QuoteSnapshot]:
        if self._pending_batch:
            return self._pending_batch
        batch: list[QuoteSnapshot] = []
        while len(batch) < self._db_sink_batch_size:
            try:
                batch.append(self._db_queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        self._pending_batch = batch
        return batch

    def _flush_db_sink_once(self) -> int:
        batch = self._acquire_batch()
        if not batch:
            self._pending_retries = 0
            return 0
        try:
            self._persist_batch(batch)
            self._pending_batch = []
            self._pending_retries = 0
            self._metrics.inc("quote_db_sink_batches")
            return len(batch)
        except Exception as err:
            self._metrics.inc("quote_db_sink_errors")
            self._metrics.inc("quote_db_sink_retry_count")
            self._pending_retries += 1
            if self._pending_retries > self._db_sink_max_retries:
                self._quarantine_batch(batch, err)
                self._pending_batch = []
                self._pending_retries = 0
                return 0
            raise

    async def _flush_db_sink_once_async(self) -> int:
        batch = self._acquire_batch()
        if not batch:
            self._pending_retries = 0
            return 0
        try:
            await asyncio.to_thread(self._persist_batch, batch)
            self._pending_batch = []
            self._pending_retries = 0
            self._metrics.inc("quote_db_sink_batches")
            return len(batch)
        except Exception as err:
            self._metrics.inc("quote_db_sink_errors")
            self._metrics.inc("quote_db_sink_retry_count")
            self._pending_retries += 1
            if self._pending_retries > self._db_sink_max_retries:
                self._quarantine_batch(batch, err)
                self._pending_batch = []
                self._pending_retries = 0
                return 0
            raise

    def _persist_batch(self, rows: list[QuoteSnapshot]) -> None:
        from app.models.quote_feature_1m import QuoteFeature1mModel

        with self._session_factory() as session:
            records = [
                QuoteFeature1mModel(
                    code=row.code,
                    trade_date=trade_date_for(row.event_ts),
                    minute_ts=_minute_floor(row.event_ts),
                    main_chip=row.main_chip,
                    main_chip_day_high=row.main_chip_day_high,
                    main_chip_day_low=row.main_chip_day_low,
                    main_chip_strength=row.main_chip_strength,
                    long_short_force=row.long_short_force,
                    long_short_force_day_high=row.long_short_force_day_high,
                    long_short_force_day_low=row.long_short_force_day_low,
                    long_short_force_strength=row.long_short_force_strength,
                    payload=json.dumps(row.to_payload(), ensure_ascii=True),
                )
                for row in rows
            ]
            try:
                session.add_all(records)
                session.commit()
                return
            except IntegrityError:
                session.rollback()
            for record in records:
                try:
                    session.add(record)
                    session.commit()
                except IntegrityError:
                    session.rollback()

    def _quarantine_batch(self, batch: list[QuoteSnapshot], err: Exception) -> None:
        self._metrics.inc("quote_db_sink_dead_letter_count")
        stream_key = f"{self._env}:stream:dead-letter:quote"
        for row in batch:
            fields = {
                "sink": "quote",
                "error_type": type(err).__name__,
                "error": str(err),
                "payload": json.dumps(row.to_payload(), ensure_ascii=True),
            }
            try:
                self._redis.xadd(
                    stream_key, fields, maxlen=self._dead_letter_maxlen, approximate=True
                )
            except Exception:
                logger.exception("failed to publish quote dead letter")
