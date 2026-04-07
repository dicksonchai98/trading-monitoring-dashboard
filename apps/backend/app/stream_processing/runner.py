"""Stream processing aggregator for Redis Streams -> Redis state + Postgres."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError
from zoneinfo import ZoneInfo

from app.market_ingestion.stream_keys import build_stream_key
from app.services.metrics import Metrics

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


def parse_event_ts(event_ts: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(event_ts.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ_TAIPEI)
    return parsed


def trade_date_for(event_ts: datetime) -> date:
    cutoff = (15, 0, 0)
    if (event_ts.hour, event_ts.minute, event_ts.second) >= cutoff:
        return event_ts.date()
    return event_ts.date() - timedelta(days=1)


def unix_seconds(ts: datetime) -> int:
    return int(ts.timestamp())


def build_state_key(env: str, code: str, trade_date: date, suffix: str) -> str:
    return f"{env}:state:{code}:{trade_date.isoformat()}:{suffix}"


def extract_number(payload: dict[str, Any], keys: Iterable[str]) -> float | None:
    for key in keys:
        if key not in payload:
            continue
        value = payload[key]
        if isinstance(value, (list, tuple)) and value:
            value = value[0]
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


@dataclass
class KBar:
    code: str
    trade_date: date
    minute_ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    event_ts: datetime

    def to_dict(self) -> dict[str, Any]:
        amplitude = self.high - self.low
        if self.open <= 0:
            raise ValueError("invalid_open_for_amplitude")
        return {
            "code": self.code,
            "trade_date": self.trade_date.isoformat(),
            "minute_ts": self.minute_ts.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "event_ts": self.event_ts.isoformat(),
            "amplitude": amplitude,
            "amplitude_pct": amplitude / self.open,
        }


class TickStateMachine:
    def __init__(self) -> None:
        self.current: KBar | None = None

    def apply_tick(
        self, code: str, event_ts: datetime, payload: dict[str, Any]
    ) -> tuple[KBar | None, bool]:
        price = extract_number(payload, ("price", "close", "last_price", "match_price"))
        volume = extract_number(payload, ("volume", "quantity", "qty")) or 0.0
        if price is None:
            return None, True

        minute_ts = event_ts.replace(second=0, microsecond=0)
        if self.current is None:
            self.current = KBar(
                code=code,
                trade_date=trade_date_for(event_ts),
                minute_ts=minute_ts,
                open=price,
                high=price,
                low=price,
                close=price,
                volume=volume,
                event_ts=event_ts,
            )
            return None, False

        if minute_ts < self.current.minute_ts:
            return None, True

        if minute_ts == self.current.minute_ts:
            self.current.high = max(self.current.high, price)
            self.current.low = min(self.current.low, price)
            self.current.close = price
            self.current.volume += volume
            self.current.event_ts = event_ts
            return None, False

        archived = self.current
        self.current = KBar(
            code=code,
            trade_date=trade_date_for(event_ts),
            minute_ts=minute_ts,
            open=price,
            high=price,
            low=price,
            close=price,
            volume=volume,
            event_ts=event_ts,
        )
        return archived, False


class MetricsRegistry:
    def compute(self, payload: dict[str, Any]) -> dict[str, Any]:
        bid = extract_number(payload, ("bid_price", "bid", "best_bid"))
        ask = extract_number(payload, ("ask_price", "ask", "best_ask"))
        bid_size = extract_number(payload, ("bid_size", "bid_volume"))
        ask_size = extract_number(payload, ("ask_size", "ask_volume"))
        bid_total_vol = extract_number(
            payload,
            (
                "bid_total_vol",
                "total_bid_vol",
                "bid_total_volume",
            ),
        )
        ask_total_vol = extract_number(
            payload,
            (
                "ask_total_vol",
                "total_ask_vol",
                "ask_total_volume",
            ),
        )
        metrics: dict[str, Any] = {}
        if bid is not None:
            metrics["bid"] = bid
        if ask is not None:
            metrics["ask"] = ask
        if bid is not None and ask is not None:
            metrics["mid"] = (bid + ask) / 2
            metrics["spread"] = ask - bid
        if bid_size is not None:
            metrics["bid_size"] = bid_size
        if ask_size is not None:
            metrics["ask_size"] = ask_size
        if bid_total_vol is not None:
            metrics["bid_total_vol"] = bid_total_vol
        if ask_total_vol is not None:
            metrics["ask_total_vol"] = ask_total_vol
        if bid_total_vol is not None and ask_total_vol is not None:
            metrics["imbalance"] = bid_total_vol - ask_total_vol
            metrics["sum_total_vol"] = bid_total_vol + ask_total_vol
            if ask_total_vol > 0:
                metrics["ratio"] = bid_total_vol / ask_total_vol
        return metrics


class BidAskStateMachine:
    def __init__(self, registry: MetricsRegistry) -> None:
        self.registry = registry
        self.latest: dict[str, Any] | None = None
        self.last_sample_second: int | None = None
        self.last_sample: dict[str, Any] | None = None
        self._trade_date: date | None = None
        self._main_force_day_high: float | None = None
        self._main_force_day_low: float | None = None

    def update_latest(self, event_ts: datetime, payload: dict[str, Any]) -> dict[str, Any]:
        metrics = self.registry.compute(payload)
        trade_date = trade_date_for(event_ts)
        main_force = metrics.get("imbalance")
        if main_force is not None:
            main_force_value = float(main_force)
            if self._trade_date != trade_date:
                self._trade_date = trade_date
                self._main_force_day_high = main_force_value
                self._main_force_day_low = main_force_value
            else:
                if self._main_force_day_high is None or self._main_force_day_low is None:
                    self._main_force_day_high = main_force_value
                    self._main_force_day_low = main_force_value
                self._main_force_day_high = max(self._main_force_day_high, main_force_value)
                self._main_force_day_low = min(self._main_force_day_low, main_force_value)
            day_high = float(self._main_force_day_high)
            day_low = float(self._main_force_day_low)
            if day_high == day_low:
                strength = 0.5
            else:
                strength = (main_force_value - day_low) / (day_high - day_low)
            metrics["main_force_big_order"] = main_force_value
            metrics["main_force_big_order_day_high"] = day_high
            metrics["main_force_big_order_day_low"] = day_low
            metrics["main_force_big_order_strength"] = max(0.0, min(float(strength), 1.0))
        metrics["event_ts"] = event_ts.isoformat()
        self.latest = metrics
        return metrics

    def sample_series(
        self,
        event_ts: datetime,
        series_fields: set[str],
        on_sample: Callable[[int, dict[str, Any]], None],
    ) -> int:
        if self.latest is None:
            return 0
        current_second = unix_seconds(event_ts)
        if self.last_sample_second is None:
            start_second = current_second
        else:
            start_second = self.last_sample_second + 1
        if start_second > current_second:
            return 0

        samples_written = 0
        for second in range(start_second, current_second + 1):
            sample = {k: v for k, v in self.latest.items() if k in series_fields}
            sample["ts"] = second
            if (
                "delta_1s" in series_fields
                and self.last_sample is not None
                and "mid" in sample
                and "mid" in self.last_sample
            ):
                sample["delta_1s"] = sample["mid"] - self.last_sample["mid"]
            elif "delta_1s" in series_fields and self.last_sample is not None:
                sample["delta_1s"] = 0
            if "delta_bid_total_vol_1s" in series_fields and self.last_sample is not None:
                sample["delta_bid_total_vol_1s"] = self._compute_delta(
                    sample=sample,
                    previous=self.last_sample,
                    field="bid_total_vol",
                )
            if "delta_ask_total_vol_1s" in series_fields and self.last_sample is not None:
                sample["delta_ask_total_vol_1s"] = self._compute_delta(
                    sample=sample,
                    previous=self.last_sample,
                    field="ask_total_vol",
                )
            on_sample(second, sample)
            self.last_sample = sample
            self.last_sample_second = second
            samples_written += 1
        return samples_written

    @staticmethod
    def _compute_delta(sample: dict[str, Any], previous: dict[str, Any], field: str) -> float:
        if field not in sample or field not in previous:
            return 0
        return float(sample[field]) - float(previous[field])


class StreamProcessingRunner:
    def __init__(
        self,
        redis_client: Any,
        session_factory: Callable[[], Any],
        metrics: Metrics,
        env: str,
        code: str,
        tick_group: str,
        bidask_group: str,
        tick_consumer: str,
        bidask_consumer: str,
        read_count: int,
        block_ms: int,
        claim_idle_ms: int,
        claim_count: int,
        ttl_seconds: int,
        series_fields: list[str],
        tick_db_queue_maxsize: int = 4096,
        bidask_db_queue_maxsize: int = 4096,
        db_sink_batch_size: int = 100,
        db_sink_retry_backoff_seconds: float = 0.5,
        db_sink_max_retries: int = 5,
        db_sink_dead_letter_maxlen: int = 10000,
        blocking_warn_ms: int = 200,
        enable_tick_pipeline: bool = True,
        enable_bidask_pipeline: bool = True,
    ) -> None:
        if not enable_tick_pipeline and not enable_bidask_pipeline:
            raise ValueError("at least one stream pipeline must be enabled")
        self._redis = redis_client
        self._session_factory = session_factory
        self._metrics = metrics
        self._env = env
        self._stream_code = code
        self._tick_group = tick_group
        self._bidask_group = bidask_group
        self._tick_consumer = tick_consumer
        self._bidask_consumer = bidask_consumer
        self._read_count = read_count
        self._block_ms = block_ms
        self._claim_idle_ms = claim_idle_ms
        self._claim_count = claim_count
        self._ttl_seconds = ttl_seconds
        self._series_fields = set(series_fields)
        self._db_sink_batch_size = max(1, db_sink_batch_size)
        self._db_sink_retry_backoff_seconds = max(0.0, db_sink_retry_backoff_seconds)
        self._db_sink_max_retries = max(1, db_sink_max_retries)
        self._db_sink_dead_letter_maxlen = max(100, db_sink_dead_letter_maxlen)
        self._blocking_warn_ms = max(1, blocking_warn_ms)
        self._enable_tick_pipeline = enable_tick_pipeline
        self._enable_bidask_pipeline = enable_bidask_pipeline
        self._tick_states: dict[str, TickStateMachine] = {}
        self._bidask_states: dict[str, BidAskStateMachine] = {}
        self._tick_db_queue: asyncio.Queue[KBar] = asyncio.Queue(maxsize=tick_db_queue_maxsize)
        self._bidask_db_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(
            maxsize=bidask_db_queue_maxsize
        )
        self._tick_db_pending_batch: list[KBar] = []
        self._bidask_db_pending_batch: list[dict[str, Any]] = []
        self._tick_db_pending_retries = 0
        self._bidask_db_pending_retries = 0
        self._stop = False
        self._tick_task: asyncio.Task[None] | None = None
        self._bidask_task: asyncio.Task[None] | None = None
        self._tick_db_sink_task: asyncio.Task[None] | None = None
        self._bidask_db_sink_task: asyncio.Task[None] | None = None
        self._tick_streams: list[str] = []
        self._bidask_streams: list[str] = []
        self._last_stream_refresh = 0.0
        self._stream_refresh_seconds = 5.0

    def stop(self) -> None:
        self._stop = True

    async def start(self) -> None:
        self._refresh_streams(force=True)
        self._stop = False
        if self._enable_tick_pipeline:
            self._tick_task = asyncio.create_task(self._run_tick_loop())
            self._tick_db_sink_task = asyncio.create_task(self._run_tick_db_sink_loop())
        if self._enable_bidask_pipeline:
            self._bidask_task = asyncio.create_task(self._run_bidask_loop())
            self._bidask_db_sink_task = asyncio.create_task(self._run_bidask_db_sink_loop())

    async def stop_async(self) -> None:
        self._stop = True
        for task in (
            self._tick_task,
            self._bidask_task,
            self._tick_db_sink_task,
            self._bidask_db_sink_task,
        ):
            if task is not None and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    continue
        self.flush_db_sinks_once()

    async def _run_tick_loop(self) -> None:
        while not self._stop:
            iter_start = time.perf_counter()
            processed = self.consume_tick_once()
            if processed == 0:
                await asyncio.sleep(0.1)
            self._record_loop_latency("tick_loop_iteration_ms", iter_start)
            await asyncio.sleep(0)

    async def _run_bidask_loop(self) -> None:
        while not self._stop:
            iter_start = time.perf_counter()
            processed = self.consume_bidask_once()
            if processed == 0:
                self._sample_carry_forward()
            if processed == 0:
                await asyncio.sleep(0.1)
            self._record_loop_latency("bidask_loop_iteration_ms", iter_start)
            await asyncio.sleep(0)

    async def _run_tick_db_sink_loop(self) -> None:
        while not self._stop:
            iter_start = time.perf_counter()
            try:
                flushed = await self._flush_tick_db_sink_once_async()
                if flushed:
                    continue
                await asyncio.sleep(0.1)
            except Exception:
                logger.exception("tick db sink batch persistence failed")
                await asyncio.sleep(self._db_sink_retry_backoff_seconds)
            finally:
                self._record_loop_latency("tick_db_sink_loop_iteration_ms", iter_start)

    async def _run_bidask_db_sink_loop(self) -> None:
        while not self._stop:
            iter_start = time.perf_counter()
            try:
                flushed = await self._flush_bidask_db_sink_once_async()
                if flushed:
                    continue
                await asyncio.sleep(0.1)
            except Exception:
                logger.exception("bidask db sink batch persistence failed")
                await asyncio.sleep(self._db_sink_retry_backoff_seconds)
            finally:
                self._record_loop_latency("bidask_db_sink_loop_iteration_ms", iter_start)

    def ensure_consumer_groups(self) -> None:
        stream_groups: list[tuple[str, str]] = []
        if self._enable_tick_pipeline:
            stream_groups.extend((key, self._tick_group) for key in self._tick_streams)
        if self._enable_bidask_pipeline:
            stream_groups.extend((key, self._bidask_group) for key in self._bidask_streams)
        for stream_key, group in stream_groups:
            try:
                self._redis.xgroup_create(stream_key, group, id="0-0", mkstream=True)
            except Exception as err:  # pragma: no cover - depends on redis behavior
                if "BUSYGROUP" in str(err).upper():
                    continue
                raise

    @property
    def _tick_stream_key(self) -> str:
        return build_stream_key(self._env, "tick", self._stream_code)

    @property
    def _bidask_stream_key(self) -> str:
        return build_stream_key(self._env, "bidask", self._stream_code)

    def consume_tick_once(self) -> int:
        if not self._enable_tick_pipeline:
            return 0
        self._refresh_streams()
        return self._consume_once(
            stream_keys=self._tick_streams,
            group=self._tick_group,
            consumer=self._tick_consumer,
            handler=self._handle_tick_entry,
        )

    def consume_bidask_once(self) -> int:
        if not self._enable_bidask_pipeline:
            return 0
        self._refresh_streams()
        return self._consume_once(
            stream_keys=self._bidask_streams,
            group=self._bidask_group,
            consumer=self._bidask_consumer,
            handler=self._handle_bidask_entry,
        )

    def _consume_once(
        self,
        stream_keys: list[str],
        group: str,
        consumer: str,
        handler: Callable[[str, dict[str, Any]], bool],
    ) -> int:
        if not stream_keys:
            return 0
        processed = 0
        for stream_key in stream_keys:
            for entry_id, fields in self._claim_pending(stream_key, group, consumer):
                if handler(entry_id, fields):
                    self._redis.xack(stream_key, group, entry_id)
                    processed += 1
            for entry_id, fields in self._read_new(stream_key, group, consumer):
                if handler(entry_id, fields):
                    self._redis.xack(stream_key, group, entry_id)
                    processed += 1
        return processed

    def _claim_pending(
        self, stream_key: str, group: str, consumer: str
    ) -> list[tuple[str, dict[str, Any]]]:
        try:
            _next, entries, _deleted = self._redis.xautoclaim(
                stream_key,
                group,
                consumer,
                min_idle_time=self._claim_idle_ms,
                start_id="0-0",
                count=self._claim_count,
            )
            return list(entries)
        except Exception:
            return []

    def _read_new(
        self, stream_key: str, group: str, consumer: str
    ) -> list[tuple[str, dict[str, Any]]]:
        try:
            entries = self._redis.xreadgroup(
                groupname=group,
                consumername=consumer,
                streams={stream_key: ">"},
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

    def _refresh_streams(self, force: bool = False) -> None:
        now = time.monotonic()
        if not force and (now - self._last_stream_refresh) < self._stream_refresh_seconds:
            return
        self._last_stream_refresh = now
        if self._enable_tick_pipeline:
            tick_streams = self._discover_streams("tick")
            if tick_streams:
                self._tick_streams = tick_streams
        else:
            self._tick_streams = []
        if self._enable_bidask_pipeline:
            bidask_streams = self._discover_streams("bidask")
            if bidask_streams:
                self._bidask_streams = bidask_streams
        else:
            self._bidask_streams = []
        self.ensure_consumer_groups()

    def _discover_streams(self, quote_type: str) -> list[str]:
        pattern = f"{self._env}:stream:{quote_type}:*"
        streams: list[str] = []
        scan_iter = getattr(self._redis, "scan_iter", None)
        if callable(scan_iter):
            candidates = [
                key.decode("utf-8") if isinstance(key, bytes) else str(key)
                for key in scan_iter(pattern)
            ]
        else:  # pragma: no cover - depends on redis client
            candidates = []
        for key in candidates:
            if self._stream_has_entries(key):
                streams.append(key)
        return streams

    def _stream_has_entries(self, key: str) -> bool:
        xlen = getattr(self._redis, "xlen", None)
        if callable(xlen):
            try:
                return int(xlen(key)) > 0
            except Exception:
                return False
        return True

    def _handle_tick_entry(self, entry_id: str, fields: dict[str, Any]) -> bool:
        start = time.perf_counter()
        data = self._normalize_fields(fields)
        code = self._extract_code(data)
        if code is None:
            self._metrics.inc("late_tick_drops")
            return True
        event_ts_raw = data.get("event_ts", "")
        event_ts = parse_event_ts(event_ts_raw)
        if event_ts is None:
            self._metrics.inc("late_tick_drops")
            return True
        payload = data.get("payload", {})
        if not isinstance(payload, dict):
            payload = {}
        tick_state = self._tick_states.setdefault(code, TickStateMachine())
        archived, dropped = tick_state.apply_tick(code, event_ts, payload)
        if dropped:
            self._metrics.inc("late_tick_drops")
            return True
        try:
            if tick_state.current is not None:
                self._write_current_k(tick_state.current)
            if archived is not None:
                self._write_k_archive(archived)
                self._enqueue_tick_persistence(archived)
                self._metrics.inc("archive_rate")
            self._metrics.inc("consume_rate")
            self._metrics.set_gauge("stream_lag", self._stream_lag_ms(event_ts))
            self._metrics.set_gauge("write_latency", int((time.perf_counter() - start) * 1000))
            return True
        except Exception:
            self._metrics.inc("write_errors")
            self._metrics.inc("tick_amplitude_compute_fail_total")
            logger.exception("tick entry processing failed entry_id=%s", entry_id)
            return False

    def _handle_bidask_entry(self, entry_id: str, fields: dict[str, Any]) -> bool:
        start = time.perf_counter()
        data = self._normalize_fields(fields)
        code = self._extract_code(data)
        if code is None:
            return True
        event_ts_raw = data.get("event_ts", "")
        event_ts = parse_event_ts(event_ts_raw)
        if event_ts is None:
            return True
        payload = data.get("payload", {})
        if not isinstance(payload, dict):
            payload = {}
        try:
            bidask_state = self._bidask_states.setdefault(
                code, BidAskStateMachine(MetricsRegistry())
            )
            latest = bidask_state.update_latest(event_ts, payload)
            self._write_latest_metrics(latest, event_ts, code)
            self._enqueue_bidask_persistence(code=code, event_ts=event_ts, metrics=latest)
            samples = bidask_state.sample_series(
                event_ts=event_ts,
                series_fields=self._series_fields,
                on_sample=lambda second, sample: self._write_metric_sample(second, sample, code),
            )
            if samples:
                self._metrics.inc("sampling_rate")
            self._metrics.inc("consume_rate")
            self._metrics.set_gauge("stream_lag", self._stream_lag_ms(event_ts))
            self._metrics.set_gauge("write_latency", int((time.perf_counter() - start) * 1000))
            return True
        except Exception:
            self._metrics.inc("write_errors")
            self._metrics.inc("bidask_main_force_compute_fail_total")
            logger.exception("bidask entry processing failed entry_id=%s", entry_id)
            return False

    def _sample_carry_forward(self) -> None:
        if not self._bidask_states:
            return
        try:
            now = datetime.now(tz=TZ_TAIPEI)
            for code, state in self._bidask_states.items():
                if state.latest is None:
                    continue
                samples = state.sample_series(
                    event_ts=now,
                    series_fields=self._series_fields,
                    on_sample=lambda second, sample, code=code: self._write_metric_sample(
                        second, sample, code
                    ),
                )
                if samples:
                    self._metrics.inc("sampling_rate")
        except Exception:
            self._metrics.inc("write_errors")

    def _normalize_fields(self, fields: dict[str, Any]) -> dict[str, Any]:
        normalized = {_decode(k): _decode(v) for k, v in fields.items()}
        if "payload" in normalized:
            normalized["payload"] = _parse_json(normalized["payload"])
        return normalized

    def _extract_code(self, data: dict[str, Any]) -> str | None:
        code = data.get("code")
        if isinstance(code, str) and code.strip():
            return code.strip()
        return None

    def _write_current_k(self, bar: KBar) -> None:
        key = build_state_key(self._env, bar.code, bar.trade_date, "k:current")
        self._redis.hset(key, mapping={k: str(v) for k, v in bar.to_dict().items()})
        self._redis.expire(key, self._ttl_seconds)

    def _write_k_archive(self, bar: KBar) -> None:
        key = build_state_key(self._env, bar.code, bar.trade_date, "k:zset")
        member = json.dumps(bar.to_dict(), ensure_ascii=True)
        self._redis.zadd(key, {member: unix_seconds(bar.minute_ts)})
        self._redis.expire(key, self._ttl_seconds)

    def _write_latest_metrics(self, metrics: dict[str, Any], event_ts: datetime, code: str) -> None:
        trade_date = trade_date_for(event_ts)
        key = build_state_key(self._env, code, trade_date, "metrics:latest")
        payload = json.dumps(metrics, ensure_ascii=True)
        self._redis.set(key, payload)
        self._redis.expire(key, self._ttl_seconds)

    def _write_metric_sample(self, second: int, sample: dict[str, Any], code: str) -> None:
        trade_date = trade_date_for(datetime.fromtimestamp(second, tz=TZ_TAIPEI))
        key = build_state_key(self._env, code, trade_date, "metrics:zset")
        member = json.dumps(sample, ensure_ascii=True)
        self._redis.zadd(key, {member: second})
        self._redis.expire(key, self._ttl_seconds)

    def _enqueue_tick_persistence(self, bar: KBar) -> None:
        self._tick_db_queue.put_nowait(bar)

    def _enqueue_bidask_persistence(
        self, code: str, event_ts: datetime, metrics: dict[str, Any]
    ) -> None:
        trade_date = trade_date_for(event_ts)
        payload = {
            "code": code,
            "trade_date": trade_date,
            "event_ts": event_ts,
            "bid": metrics.get("bid"),
            "ask": metrics.get("ask"),
            "spread": metrics.get("spread"),
            "mid": metrics.get("mid"),
            "bid_size": metrics.get("bid_size"),
            "ask_size": metrics.get("ask_size"),
            "metric_payload": dict(metrics),
        }
        self._bidask_db_queue.put_nowait(payload)

    def flush_db_sinks_once(self) -> int:
        total = 0
        while True:
            flushed = self._flush_tick_db_sink_once() + self._flush_bidask_db_sink_once()
            total += flushed
            if flushed == 0:
                return total

    def _flush_tick_db_sink_once(self) -> int:
        batch = self._acquire_tick_batch()
        if not batch:
            self._tick_db_pending_retries = 0
            return 0
        try:
            self._persist_kbar_batch(batch)
            self._tick_db_pending_batch = []
            self._tick_db_pending_retries = 0
            self._metrics.inc("tick_db_sink_batches")
            return len(batch)
        except Exception as err:
            self._metrics.inc("tick_db_sink_errors")
            self._metrics.inc("tick_db_sink_retry_count")
            self._tick_db_pending_retries += 1
            if self._tick_db_pending_retries > self._db_sink_max_retries:
                self._quarantine_tick_batch(batch, err)
                self._tick_db_pending_batch = []
                self._tick_db_pending_retries = 0
                return 0
            raise

    async def _flush_tick_db_sink_once_async(self) -> int:
        batch = self._acquire_tick_batch()
        if not batch:
            self._tick_db_pending_retries = 0
            return 0
        try:
            await asyncio.to_thread(self._persist_kbar_batch, batch)
            self._tick_db_pending_batch = []
            self._tick_db_pending_retries = 0
            self._metrics.inc("tick_db_sink_batches")
            return len(batch)
        except Exception as err:
            self._metrics.inc("tick_db_sink_errors")
            self._metrics.inc("tick_db_sink_retry_count")
            self._tick_db_pending_retries += 1
            if self._tick_db_pending_retries > self._db_sink_max_retries:
                self._quarantine_tick_batch(batch, err)
                self._tick_db_pending_batch = []
                self._tick_db_pending_retries = 0
                return 0
            raise

    def _flush_bidask_db_sink_once(self) -> int:
        batch = self._acquire_bidask_batch()
        if not batch:
            self._bidask_db_pending_retries = 0
            return 0
        try:
            self._persist_bidask_batch(batch)
            self._bidask_db_pending_batch = []
            self._bidask_db_pending_retries = 0
            self._metrics.inc("bidask_db_sink_batches")
            return len(batch)
        except Exception as err:
            self._metrics.inc("bidask_db_sink_errors")
            self._metrics.inc("bidask_db_sink_retry_count")
            self._bidask_db_pending_retries += 1
            if self._bidask_db_pending_retries > self._db_sink_max_retries:
                self._quarantine_bidask_batch(batch, err)
                self._bidask_db_pending_batch = []
                self._bidask_db_pending_retries = 0
                return 0
            raise

    async def _flush_bidask_db_sink_once_async(self) -> int:
        batch = self._acquire_bidask_batch()
        if not batch:
            self._bidask_db_pending_retries = 0
            return 0
        try:
            await asyncio.to_thread(self._persist_bidask_batch, batch)
            self._bidask_db_pending_batch = []
            self._bidask_db_pending_retries = 0
            self._metrics.inc("bidask_db_sink_batches")
            return len(batch)
        except Exception as err:
            self._metrics.inc("bidask_db_sink_errors")
            self._metrics.inc("bidask_db_sink_retry_count")
            self._bidask_db_pending_retries += 1
            if self._bidask_db_pending_retries > self._db_sink_max_retries:
                self._quarantine_bidask_batch(batch, err)
                self._bidask_db_pending_batch = []
                self._bidask_db_pending_retries = 0
                return 0
            raise

    def _drain_queue_batch(self, queue: asyncio.Queue[Any]) -> list[Any]:
        batch: list[Any] = []
        while len(batch) < self._db_sink_batch_size:
            try:
                batch.append(queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        return batch

    def _acquire_tick_batch(self) -> list[KBar]:
        if self._tick_db_pending_batch:
            return self._tick_db_pending_batch
        batch = self._drain_queue_batch(self._tick_db_queue)
        self._tick_db_pending_batch = batch
        return batch

    def _acquire_bidask_batch(self) -> list[dict[str, Any]]:
        if self._bidask_db_pending_batch:
            return self._bidask_db_pending_batch
        batch = self._drain_queue_batch(self._bidask_db_queue)
        self._bidask_db_pending_batch = batch
        return batch

    def _persist_kbar_batch(self, bars: list[KBar]) -> None:
        from app.models.kbar_1m import Kbar1mModel

        with self._session_factory() as session:
            records = [
                Kbar1mModel(
                    code=bar.code,
                    trade_date=bar.trade_date,
                    minute_ts=bar.minute_ts,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    volume=bar.volume,
                    amplitude=bar.high - bar.low,
                    amplitude_pct=(bar.high - bar.low) / bar.open,
                )
                for bar in bars
            ]
            self._persist_records_with_duplicate_tolerance(session, records)

    def _persist_bidask_batch(self, rows: list[dict[str, Any]]) -> None:
        from app.models.bidask_metric_1s import BidAskMetric1sModel

        with self._session_factory() as session:
            records = [
                BidAskMetric1sModel(
                    code=row["code"],
                    trade_date=row["trade_date"],
                    event_ts=row["event_ts"],
                    bid=row["bid"],
                    ask=row["ask"],
                    spread=row["spread"],
                    mid=row["mid"],
                    bid_size=row["bid_size"],
                    ask_size=row["ask_size"],
                    metric_payload=json.dumps(row["metric_payload"], ensure_ascii=True),
                )
                for row in rows
            ]
            self._persist_records_with_duplicate_tolerance(session, records)

    def _quarantine_tick_batch(self, batch: list[KBar], err: Exception) -> None:
        logger.error(
            "tick db sink retries exhausted, moving batch to dead-letter size=%s error=%s",
            len(batch),
            type(err).__name__,
        )
        for bar in batch:
            payload = {
                "code": bar.code,
                "trade_date": bar.trade_date.isoformat(),
                "minute_ts": bar.minute_ts.isoformat(),
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            }
            self._publish_dead_letter("tick", payload, err)
        self._metrics.inc("tick_db_sink_dead_letter_count")

    def _quarantine_bidask_batch(self, batch: list[dict[str, Any]], err: Exception) -> None:
        logger.error(
            "bidask db sink retries exhausted, moving batch to dead-letter size=%s error=%s",
            len(batch),
            type(err).__name__,
        )
        for row in batch:
            payload = {
                "code": row.get("code"),
                "trade_date": row.get("trade_date").isoformat()
                if hasattr(row.get("trade_date"), "isoformat")
                else row.get("trade_date"),
                "event_ts": row.get("event_ts").isoformat()
                if hasattr(row.get("event_ts"), "isoformat")
                else row.get("event_ts"),
                "bid": row.get("bid"),
                "ask": row.get("ask"),
                "spread": row.get("spread"),
                "mid": row.get("mid"),
                "bid_size": row.get("bid_size"),
                "ask_size": row.get("ask_size"),
                "metric_payload": row.get("metric_payload"),
            }
            self._publish_dead_letter("bidask", payload, err)
        self._metrics.inc("bidask_db_sink_dead_letter_count")

    def _publish_dead_letter(self, sink: str, payload: dict[str, Any], err: Exception) -> None:
        stream_key = f"{self._env}:stream:dead-letter:{sink}"
        fields = {
            "sink": sink,
            "error_type": type(err).__name__,
            "error": str(err),
            "payload": json.dumps(payload, ensure_ascii=True, default=str),
        }
        try:
            self._redis.xadd(
                stream_key,
                fields,
                maxlen=self._db_sink_dead_letter_maxlen,
                approximate=True,
            )
        except Exception:
            logger.exception("failed to publish dead-letter entry sink=%s", sink)

    def _record_loop_latency(self, metric: str, started_at: float) -> None:
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        self._metrics.set_gauge(metric, elapsed_ms)
        if elapsed_ms > self._blocking_warn_ms:
            self._metrics.inc("loop_blocking_warnings_total")

    @staticmethod
    def _persist_records_with_duplicate_tolerance(session: Any, records: list[Any]) -> None:
        if not records:
            return
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

    @staticmethod
    def _stream_lag_ms(event_ts: datetime) -> int:
        now = datetime.now(tz=TZ_TAIPEI)
        return int(max((now - event_ts).total_seconds() * 1000, 0))
