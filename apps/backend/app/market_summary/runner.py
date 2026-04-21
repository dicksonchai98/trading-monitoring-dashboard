from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable
from contextlib import suppress
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from datetime import time as dt_time
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from zoneinfo import ZoneInfo

from app.config import AGGREGATOR_CODE
from app.stream_processing.runner import build_state_key, trade_date_for, unix_seconds

logger = logging.getLogger(__name__)

TZ_TAIPEI = ZoneInfo("Asia/Taipei")


@dataclass
class MarketSummarySnapshot:
    code: str
    trade_date: date
    minute_ts: datetime
    event_ts: datetime
    index_value: float
    cumulative_turnover: float
    completion_ratio: float
    estimated_turnover: float | None
    yesterday_estimated_turnover: float | None
    estimated_turnover_diff: float | None
    estimated_turnover_ratio: float | None
    adjustment_factor: float
    futures_code: str
    futures_price: float | None
    spread: float | None
    spread_day_high: float | None
    spread_day_low: float | None
    spread_strength: float | None
    spread_status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "trade_date": self.trade_date.isoformat(),
            "minute_ts": self.minute_ts.isoformat(),
            "event_ts": self.event_ts.isoformat(),
            "index_value": self.index_value,
            "cumulative_turnover": self.cumulative_turnover,
            "completion_ratio": self.completion_ratio,
            "estimated_turnover": self.estimated_turnover,
            "yesterday_estimated_turnover": self.yesterday_estimated_turnover,
            "estimated_turnover_diff": self.estimated_turnover_diff,
            "estimated_turnover_ratio": self.estimated_turnover_ratio,
            "adjustment_factor": self.adjustment_factor,
            "futures_code": self.futures_code,
            "futures_price": self.futures_price,
            "spread": self.spread,
            "spread_day_high": self.spread_day_high,
            "spread_day_low": self.spread_day_low,
            "spread_strength": self.spread_strength,
            "spread_status": self.spread_status,
        }


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _parse_json(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def parse_event_ts(event_ts: str) -> datetime | None:
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


def parse_hhmm(value: str, default: str) -> dt_time:
    raw = value.strip() if value.strip() else default
    try:
        hours, minutes = raw.split(":", 1)
        return dt_time(hour=int(hours), minute=int(minutes), tzinfo=TZ_TAIPEI)
    except Exception:
        hours, minutes = default.split(":", 1)
        return dt_time(hour=int(hours), minute=int(minutes), tzinfo=TZ_TAIPEI)


def _extract_number(payload: dict[str, Any], key: str) -> float | None:
    raw = payload.get(key)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


class MarketSummaryRunner:
    _stream_refresh_seconds = 5.0

    def __init__(
        self,
        redis_client: Any,
        session_factory: Callable[[], Any],
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
        trading_start: str = "09:00",
        trading_end: str = "13:30",
        adjustment_factor: float = 1.0,
        futures_code: str = AGGREGATOR_CODE,
        spread_freshness_seconds: float = 5.0,
        db_sink_batch_size: int = 100,
        db_sink_retry_backoff_seconds: float = 0.5,
        db_sink_max_retries: int = 5,
        db_sink_dead_letter_maxlen: int = 10000,
    ) -> None:
        self._redis = redis_client
        self._session_factory = session_factory
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
        self._session_start = parse_hhmm(trading_start, "09:00")
        self._session_end = parse_hhmm(trading_end, "13:30")
        self._adjustment_factor = float(adjustment_factor)
        self._futures_code = str(futures_code).strip() or AGGREGATOR_CODE
        self._spread_freshness_seconds = max(0.0, float(spread_freshness_seconds))
        self._db_sink_batch_size = max(1, db_sink_batch_size)
        self._db_sink_retry_backoff_seconds = max(0.0, db_sink_retry_backoff_seconds)
        self._db_sink_max_retries = max(1, db_sink_max_retries)
        self._db_sink_dead_letter_maxlen = max(100, db_sink_dead_letter_maxlen)

        self._stream_key = f"{self._env}:stream:market:{self._code}"
        self._last_stream_refresh = 0.0
        self._stop = False
        self._task: asyncio.Task[None] | None = None

        self._latest_snapshot: MarketSummarySnapshot | None = None
        self._buffered_minute_snapshot: MarketSummarySnapshot | None = None
        self._db_queue: list[MarketSummarySnapshot] = []
        self._db_pending_batch: list[MarketSummarySnapshot] = []
        self._db_pending_retries = 0
        self._spread_trade_date: date | None = None
        self._spread_day_high: float | None = None
        self._spread_day_low: float | None = None
        self._comparison_trade_date: date | None = None
        self._yesterday_estimated_by_minute_of_day: dict[int, float] = {}

    async def start(self) -> None:
        self.ensure_consumer_group()
        self._stop = False
        self._task = asyncio.create_task(self._run_loop())

    async def stop_async(self) -> None:
        self._stop = True
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
        self._flush_minute_buffer(force=True)
        self.flush_db_sinks_once()

    def stop(self) -> None:
        self._stop = True

    async def _run_loop(self) -> None:
        while not self._stop:
            processed = self.consume_once()
            self._flush_minute_buffer(force=False)
            try:
                flushed = self._flush_db_sink_once()
                if flushed:
                    self._metrics.inc("market_summary_db_sink_batches_total")
            except Exception:
                logger.exception("market summary db sink flush failed")
                await asyncio.sleep(self._db_sink_retry_backoff_seconds)
            if processed == 0:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0)

    def ensure_consumer_group(self) -> None:
        try:
            self._redis.xgroup_create(self._stream_key, self._group, id="0-0", mkstream=True)
        except Exception as err:  # pragma: no cover
            if "BUSYGROUP" in str(err).upper():
                return
            raise

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
        code = str(data.get("code") or "").strip()
        if not code:
            self._metrics.inc("market_summary_invalid_events_total")
            return True
        event_ts = parse_event_ts(str(data.get("event_ts") or ""))
        if event_ts is None:
            self._metrics.inc("market_summary_invalid_events_total")
            return True
        payload = data.get("payload")
        if not isinstance(payload, dict):
            self._metrics.inc("market_summary_invalid_events_total")
            return True

        index_value = _extract_number(payload, "index_value")
        cumulative_turnover = _extract_number(payload, "cumulative_turnover")
        if index_value is None or cumulative_turnover is None:
            self._metrics.inc("market_summary_invalid_events_total")
            return True

        snapshot = self._build_snapshot(
            code=code,
            event_ts=event_ts,
            index_value=index_value,
            cumulative_turnover=cumulative_turnover,
        )
        try:
            self._write_snapshot(snapshot)
            self._track_minute_rollover(snapshot)
            self._latest_snapshot = snapshot
            self._metrics.inc("market_summary_events_processed_total")
            self._metrics.set_gauge(
                "market_summary_stream_lag_ms",
                int(max((datetime.now(tz=TZ_TAIPEI) - event_ts).total_seconds() * 1000, 0)),
            )
            if snapshot.estimated_turnover is not None:
                self._metrics.set_gauge(
                    "market_summary_estimated_turnover_latest", snapshot.estimated_turnover
                )
            return True
        except Exception:
            logger.exception("market summary write failed")
            self._metrics.inc("market_summary_redis_write_errors_total")
            return False

    def _build_snapshot(
        self,
        code: str,
        event_ts: datetime,
        index_value: float,
        cumulative_turnover: float,
    ) -> MarketSummarySnapshot:
        trade_date = trade_date_for(event_ts)
        self._refresh_previous_day_estimated_cache(trade_date, code)
        ratio = self._completion_ratio(event_ts)
        estimated: float | None = None
        if ratio > 0:
            estimated = cumulative_turnover / ratio * self._adjustment_factor
        minute_ts = event_ts.replace(second=0, microsecond=0)
        minute_of_day = self._minute_of_day(minute_ts)
        yesterday_estimated = self._yesterday_estimated_by_minute_of_day.get(minute_of_day)
        estimated_diff = (
            estimated - yesterday_estimated
            if estimated is not None and yesterday_estimated is not None
            else None
        )
        estimated_ratio = (
            estimated / yesterday_estimated
            if estimated is not None
            and yesterday_estimated is not None
            and yesterday_estimated != 0
            else None
        )
        futures_price, futures_event_ts = self._read_futures_latest(event_ts)
        spread_status = "ok"
        spread: float | None = None
        spread_day_high: float | None = None
        spread_day_low: float | None = None
        spread_strength: float | None = None
        if (
            futures_price is None
            or futures_event_ts is None
            or (event_ts - futures_event_ts) > timedelta(seconds=self._spread_freshness_seconds)
        ):
            spread_status = "stale_or_missing_futures"
            self._metrics.inc("market_spread_stale_total")
        else:
            spread = futures_price - index_value
            spread_day_high, spread_day_low = self._update_spread_day_bounds(trade_date, spread)
            if spread_day_high == spread_day_low:
                spread_strength = 0.5
            else:
                spread_strength = (spread - spread_day_low) / (spread_day_high - spread_day_low)
            spread_strength = max(0.0, min(float(spread_strength), 1.0))
        return MarketSummarySnapshot(
            code=code,
            trade_date=trade_date,
            minute_ts=minute_ts,
            event_ts=event_ts,
            index_value=index_value,
            cumulative_turnover=cumulative_turnover,
            completion_ratio=ratio,
            estimated_turnover=estimated,
            yesterday_estimated_turnover=yesterday_estimated,
            estimated_turnover_diff=estimated_diff,
            estimated_turnover_ratio=estimated_ratio,
            adjustment_factor=self._adjustment_factor,
            futures_code=self._futures_code,
            futures_price=futures_price,
            spread=spread,
            spread_day_high=spread_day_high,
            spread_day_low=spread_day_low,
            spread_strength=spread_strength,
            spread_status=spread_status,
        )

    @staticmethod
    def _minute_of_day(ts: datetime) -> int:
        return ts.hour * 60 + ts.minute

    def _refresh_previous_day_estimated_cache(self, trade_date: date, code: str) -> None:
        if self._comparison_trade_date == trade_date:
            return
        self._comparison_trade_date = trade_date
        self._yesterday_estimated_by_minute_of_day = self._load_previous_day_estimated_cache(
            trade_date, code
        )

    def _load_previous_day_estimated_cache(self, trade_date: date, code: str) -> dict[int, float]:
        from app.models.market_summary_1m import MarketSummary1mModel

        context_or_session = self._session_factory()
        if context_or_session is None:
            return {}

        def _query_rows(session: Any) -> list[tuple[Any, Any]]:
            previous_trade_date = session.execute(
                select(MarketSummary1mModel.trade_date)
                .where(MarketSummary1mModel.market_code == code)
                .where(MarketSummary1mModel.trade_date < trade_date)
                .order_by(MarketSummary1mModel.trade_date.desc())
                .limit(1)
            ).scalar_one_or_none()
            if previous_trade_date is None:
                return []
            return session.execute(
                select(
                    MarketSummary1mModel.minute_ts,
                    MarketSummary1mModel.estimated_turnover,
                )
                .where(MarketSummary1mModel.market_code == code)
                .where(MarketSummary1mModel.trade_date == previous_trade_date)
            ).all()

        if hasattr(context_or_session, "__enter__"):
            with context_or_session as session:
                rows = _query_rows(session)
        else:
            session = context_or_session
            try:
                rows = _query_rows(session)
            finally:
                close = getattr(session, "close", None)
                if callable(close):
                    close()

        result: dict[int, float] = {}
        for minute_ts, estimated_turnover in rows:
            if minute_ts is None or estimated_turnover is None:
                continue
            result[self._minute_of_day(minute_ts)] = float(estimated_turnover)
        return result

    def _update_spread_day_bounds(self, trade_date: date, spread: float) -> tuple[float, float]:
        if self._spread_trade_date != trade_date:
            self._spread_trade_date = trade_date
            self._spread_day_high = spread
            self._spread_day_low = spread
        else:
            if self._spread_day_high is None or self._spread_day_low is None:
                self._spread_day_high = spread
                self._spread_day_low = spread
            self._spread_day_high = max(self._spread_day_high, spread)
            self._spread_day_low = min(self._spread_day_low, spread)
        return float(self._spread_day_high), float(self._spread_day_low)

    def _read_futures_latest(
        self, market_event_ts: datetime
    ) -> tuple[float | None, datetime | None]:
        trade_date = trade_date_for(market_event_ts)
        key = build_state_key(self._env, self._futures_code, trade_date, "k:current")
        raw = self._redis.hgetall(key)
        if not raw:
            return None, None
        decoded = {(_decode(k)): (_decode(v)) for k, v in raw.items()}
        close_raw = decoded.get("close")
        if close_raw is None:
            return None, None
        try:
            futures_price = float(close_raw)
        except (TypeError, ValueError):
            self._metrics.inc("market_spread_compute_fail_total")
            return None, None
        futures_event_ts = parse_event_ts(decoded.get("event_ts", ""))
        if futures_event_ts is None:
            futures_event_ts = parse_event_ts(decoded.get("minute_ts", ""))
        return futures_price, futures_event_ts

    def _completion_ratio(self, event_ts: datetime) -> float:
        start = datetime.combine(event_ts.date(), self._session_start, tzinfo=TZ_TAIPEI)
        end = datetime.combine(event_ts.date(), self._session_end, tzinfo=TZ_TAIPEI)
        total = max((end - start).total_seconds(), 0.0)
        if total <= 0:
            return 0.0
        if event_ts <= start:
            return 0.0
        if event_ts >= end:
            return 1.0
        elapsed = (event_ts - start).total_seconds()
        raw = elapsed / total
        return max(0.0, min(raw, 1.0))

    def _write_snapshot(self, snapshot: MarketSummarySnapshot) -> None:
        target_codes = {snapshot.code}
        alias_code = str(self._futures_code or "").strip()
        if alias_code:
            target_codes.add(alias_code)

        for code in target_codes:
            latest_key = build_state_key(
                self._env, code, snapshot.trade_date, "market_summary:latest"
            )
            zset_key = build_state_key(self._env, code, snapshot.trade_date, "market_summary:zset")
            payload = snapshot.to_dict()
            if code != snapshot.code:
                payload["market_code"] = snapshot.code
                payload["code"] = code
            member = json.dumps(payload, ensure_ascii=True)
            self._redis.set(latest_key, member)
            self._redis.expire(latest_key, self._ttl_seconds)
            self._redis.zadd(zset_key, {member: unix_seconds(snapshot.event_ts)})
            self._redis.expire(zset_key, self._ttl_seconds)

    def _track_minute_rollover(self, snapshot: MarketSummarySnapshot) -> None:
        if self._buffered_minute_snapshot is None:
            self._buffered_minute_snapshot = snapshot
            return
        if snapshot.minute_ts < self._buffered_minute_snapshot.minute_ts:
            return
        if snapshot.minute_ts == self._buffered_minute_snapshot.minute_ts:
            self._buffered_minute_snapshot = snapshot
            return
        self._db_queue.append(self._buffered_minute_snapshot)
        self._buffered_minute_snapshot = snapshot

    def _flush_minute_buffer(self, force: bool) -> None:
        if not force or self._buffered_minute_snapshot is None:
            return
        self._db_queue.append(self._buffered_minute_snapshot)
        self._buffered_minute_snapshot = None

    def flush_db_sinks_once(self) -> int:
        total = 0
        while True:
            flushed = self._flush_db_sink_once()
            total += flushed
            if flushed == 0:
                return total

    def _acquire_batch(self) -> list[MarketSummarySnapshot]:
        if self._db_pending_batch:
            return self._db_pending_batch
        if not self._db_queue:
            return []
        batch = self._db_queue[: self._db_sink_batch_size]
        self._db_queue = self._db_queue[self._db_sink_batch_size :]
        self._db_pending_batch = batch
        return batch

    def _flush_db_sink_once(self) -> int:
        batch = self._acquire_batch()
        if not batch:
            self._db_pending_retries = 0
            return 0
        try:
            self._persist_batch(batch)
            self._db_pending_batch = []
            self._db_pending_retries = 0
            return len(batch)
        except Exception as err:
            self._metrics.inc("market_summary_db_sink_errors_total")
            self._db_pending_retries += 1
            if self._db_pending_retries > self._db_sink_max_retries:
                self._publish_dead_letter(batch, err)
                self._db_pending_batch = []
                self._db_pending_retries = 0
                return 0
            raise

    def _persist_batch(self, rows: list[MarketSummarySnapshot]) -> None:
        from app.models.market_summary_1m import MarketSummary1mModel

        with self._session_factory() as session:
            records = [
                MarketSummary1mModel(
                    market_code=row.code,
                    trade_date=row.trade_date,
                    minute_ts=row.minute_ts,
                    index_value=row.index_value,
                    cumulative_turnover=row.cumulative_turnover,
                    completion_ratio=row.completion_ratio,
                    estimated_turnover=row.estimated_turnover,
                    yesterday_estimated_turnover=row.yesterday_estimated_turnover,
                    estimated_turnover_diff=row.estimated_turnover_diff,
                    estimated_turnover_ratio=row.estimated_turnover_ratio,
                    futures_code=row.futures_code,
                    futures_price=row.futures_price,
                    spread=row.spread,
                    spread_day_high=row.spread_day_high,
                    spread_day_low=row.spread_day_low,
                    spread_strength=row.spread_strength,
                    spread_status=row.spread_status,
                    payload=json.dumps(row.to_dict(), ensure_ascii=True),
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

    def _publish_dead_letter(self, rows: list[MarketSummarySnapshot], err: Exception) -> None:
        stream_key = f"{self._env}:stream:dead-letter:market-summary"
        for row in rows:
            fields = {
                "sink": "market-summary",
                "error_type": type(err).__name__,
                "error": str(err),
                "payload": json.dumps(row.to_dict(), ensure_ascii=True),
            }
            try:
                self._redis.xadd(
                    stream_key,
                    fields,
                    maxlen=self._db_sink_dead_letter_maxlen,
                    approximate=True,
                )
            except Exception:
                logger.exception("market summary dead-letter publish failed")
        self._metrics.inc("market_summary_db_sink_dead_letter_total")
