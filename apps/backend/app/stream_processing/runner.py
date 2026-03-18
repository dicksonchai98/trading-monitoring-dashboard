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

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "trade_date": self.trade_date.isoformat(),
            "minute_ts": self.minute_ts.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
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
            )
            return None, False

        if minute_ts < self.current.minute_ts:
            return None, True

        if minute_ts == self.current.minute_ts:
            self.current.high = max(self.current.high, price)
            self.current.low = min(self.current.low, price)
            self.current.close = price
            self.current.volume += volume
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
        )
        return archived, False


class MetricsRegistry:
    def compute(self, payload: dict[str, Any]) -> dict[str, Any]:
        bid = extract_number(payload, ("bid_price", "bid", "best_bid"))
        ask = extract_number(payload, ("ask_price", "ask", "best_ask"))
        bid_size = extract_number(payload, ("bid_size", "bid_volume"))
        ask_size = extract_number(payload, ("ask_size", "ask_volume"))
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
        return metrics


class BidAskStateMachine:
    def __init__(self, registry: MetricsRegistry) -> None:
        self.registry = registry
        self.latest: dict[str, Any] | None = None
        self.last_sample_second: int | None = None
        self.last_sample: dict[str, Any] | None = None

    def update_latest(self, event_ts: datetime, payload: dict[str, Any]) -> dict[str, Any]:
        metrics = self.registry.compute(payload)
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
            on_sample(second, sample)
            self.last_sample = sample
            self.last_sample_second = second
            samples_written += 1
        return samples_written


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
    ) -> None:
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
        self._tick_states: dict[str, TickStateMachine] = {}
        self._bidask_states: dict[str, BidAskStateMachine] = {}
        self._stop = False
        self._tick_task: asyncio.Task[None] | None = None
        self._bidask_task: asyncio.Task[None] | None = None
        self._tick_streams: list[str] = []
        self._bidask_streams: list[str] = []
        self._last_stream_refresh = 0.0
        self._stream_refresh_seconds = 5.0

    def stop(self) -> None:
        self._stop = True

    async def start(self) -> None:
        self._refresh_streams(force=True)
        self._stop = False
        self._tick_task = asyncio.create_task(self._run_tick_loop())
        self._bidask_task = asyncio.create_task(self._run_bidask_loop())

    async def stop_async(self) -> None:
        self._stop = True
        for task in (self._tick_task, self._bidask_task):
            if task is not None and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    continue

    async def _run_tick_loop(self) -> None:
        while not self._stop:
            processed = self.consume_tick_once()
            if processed == 0:
                await asyncio.sleep(0.1)

    async def _run_bidask_loop(self) -> None:
        while not self._stop:
            processed = self.consume_bidask_once()
            if processed == 0:
                self._sample_carry_forward()
            if processed == 0:
                await asyncio.sleep(0.1)

    def ensure_consumer_groups(self) -> None:
        for stream_key, group in (
            *[(key, self._tick_group) for key in self._tick_streams],
            *[(key, self._bidask_group) for key in self._bidask_streams],
        ):
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
        self._refresh_streams()
        return self._consume_once(
            stream_keys=self._tick_streams,
            group=self._tick_group,
            consumer=self._tick_consumer,
            handler=self._handle_tick_entry,
        )

    def consume_bidask_once(self) -> int:
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
        tick_streams = self._discover_streams("tick")
        bidask_streams = self._discover_streams("bidask")
        if tick_streams:
            self._tick_streams = tick_streams
        if bidask_streams:
            self._bidask_streams = bidask_streams
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
                self._persist_kbar(archived)
                self._metrics.inc("archive_rate")
            self._metrics.inc("consume_rate")
            self._metrics.set_gauge("stream_lag", self._stream_lag_ms(event_ts))
            self._metrics.set_gauge("write_latency", int((time.perf_counter() - start) * 1000))
            return True
        except Exception:
            self._metrics.inc("write_errors")
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

    def _persist_kbar(self, bar: KBar) -> None:
        from app.models.kbar_1m import Kbar1mModel

        with self._session_factory() as session:
            record = Kbar1mModel(
                code=bar.code,
                trade_date=bar.trade_date,
                minute_ts=bar.minute_ts,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
            )
            session.add(record)
            session.commit()

    @staticmethod
    def _stream_lag_ms(event_ts: datetime) -> int:
        now = datetime.now(tz=TZ_TAIPEI)
        return int(max((now - event_ts).total_seconds() * 1000, 0))
