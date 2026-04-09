"""Latest state worker for spot streams."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any

from app.services.metrics import Metrics

logger = logging.getLogger(__name__)
TZ_OFFSET_SECONDS = 8 * 3600


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _parse_json(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _coerce_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_price_field(data: dict[str, Any], payload: dict[str, Any], field: str) -> float | None:
    direct = _coerce_float(data.get(field))
    if direct is not None:
        return direct
    nested = _coerce_float(payload.get(field))
    if nested is not None:
        return nested
    raw_quote = payload.get("raw_quote")
    if isinstance(raw_quote, dict):
        raw = _coerce_float(raw_quote.get(field))
        if raw is not None:
            return raw
    return None


def parse_event_ts(event_ts: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(event_ts.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def trade_date_from_event_ts(event_ts: datetime) -> str:
    epoch = event_ts.timestamp() + TZ_OFFSET_SECONDS
    return datetime.utcfromtimestamp(epoch).strftime("%Y-%m-%d")


class LatestStateRunner:
    def __init__(
        self,
        redis_client: Any,
        metrics: Metrics,
        env: str,
        group: str,
        consumer: str,
        read_count: int,
        block_ms: int,
        claim_idle_ms: int,
        claim_count: int,
        state_ttl_seconds: int = 3600,
        flush_interval_ms: int = 500,
        flush_batch_size: int = 200,
        on_new_extreme: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self._redis = redis_client
        self._metrics = metrics
        self._env = env
        self._group = group
        self._consumer = consumer
        self._read_count = read_count
        self._block_ms = block_ms
        self._claim_idle_ms = claim_idle_ms
        self._claim_count = claim_count
        self._state_ttl_seconds = state_ttl_seconds
        self._flush_interval_seconds = max(flush_interval_ms / 1000, 0.05)
        self._flush_batch_size = max(1, flush_batch_size)
        self._on_new_extreme = on_new_extreme
        self._spot_streams: list[str] = [f"{self._env}:stream:spot"]
        self._last_flush_at = 0.0
        self._stop = False
        self._task: asyncio.Task[None] | None = None
        self._latest_state: dict[str, dict[str, Any]] = {}
        self._last_ingest_seq: dict[str, int] = {}
        self._reference_trade_date: dict[str, str] = {}
        self._dirty_symbols: set[str] = set()

    def stop(self) -> None:
        self._stop = True

    async def start(self) -> None:
        self._refresh_streams(force=True)
        self._stop = False
        self._task = asyncio.create_task(self._run_loop())

    async def stop_async(self) -> None:
        self._stop = True
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
        self.flush_dirty_once(force=True)

    async def _run_loop(self) -> None:
        while not self._stop:
            processed = self.consume_once()
            flushed = self.flush_dirty_once()
            if processed == 0 and flushed == 0:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0)

    def consume_once(self) -> int:
        self._refresh_streams()
        if not self._spot_streams:
            return 0
        processed = 0
        for stream_key in self._spot_streams:
            pending_acks: list[str] = []
            for entry_id, fields in self._claim_pending(stream_key):
                if self._handle_spot_entry(entry_id, fields):
                    pending_acks.append(entry_id)
            for entry_id, fields in self._read_new(stream_key):
                if self._handle_spot_entry(entry_id, fields):
                    pending_acks.append(entry_id)
            if pending_acks:
                _ = self.flush_dirty_once(force=True, flush_all=True)
                if not self._dirty_symbols:
                    for entry_id in pending_acks:
                        self._redis.xack(stream_key, self._group, entry_id)
                        processed += 1
        return processed

    def _claim_pending(self, stream_key: str) -> list[tuple[str, dict[str, Any]]]:
        try:
            _next, entries, _deleted = self._redis.xautoclaim(
                stream_key,
                self._group,
                self._consumer,
                min_idle_time=self._claim_idle_ms,
                start_id="0-0",
                count=self._claim_count,
            )
            return list(entries)
        except Exception:
            return []

    def _read_new(self, stream_key: str) -> list[tuple[str, dict[str, Any]]]:
        try:
            entries = self._redis.xreadgroup(
                groupname=self._group,
                consumername=self._consumer,
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
        _ = force
        self._ensure_consumer_groups()

    def _ensure_consumer_groups(self) -> None:
        for stream_key in self._spot_streams:
            try:
                self._redis.xgroup_create(stream_key, self._group, id="0-0", mkstream=True)
            except Exception as err:  # pragma: no cover - depends on redis behavior
                if "BUSYGROUP" in str(err).upper():
                    continue
                raise

    def _handle_spot_entry(self, entry_id: str, fields: dict[str, Any]) -> bool:
        try:
            data = {_decode(k): _decode(v) for k, v in fields.items()}
            payload = data.get("payload", {})
            if isinstance(payload, str):
                payload = _parse_json(payload)
            if not isinstance(payload, dict):
                payload = {}
            symbol = str(data.get("symbol") or data.get("code") or "").strip()
            if not symbol:
                return True
            event_ts_raw = str(data.get("event_ts") or "")
            event_ts = parse_event_ts(event_ts_raw)
            if event_ts is None:
                return True
            trade_date = trade_date_from_event_ts(event_ts)

            ingest_seq_raw = data.get("ingest_seq", payload.get("ingest_seq", 0))
            try:
                ingest_seq = int(ingest_seq_raw)
            except (TypeError, ValueError):
                ingest_seq = 0

            last_seq = self._last_ingest_seq.get(symbol, 0)
            if ingest_seq > 0 and ingest_seq <= last_seq:
                return True

            last_price = _extract_price_field(data, payload, "last_price")
            if last_price is None:
                last_price = _extract_price_field(data, payload, "close")
            if last_price is None:
                return True
            open_price = _extract_price_field(data, payload, "open")
            close_price = _extract_price_field(data, payload, "close")
            high_price = _extract_price_field(data, payload, "high")
            low_price = _extract_price_field(data, payload, "low")
            reference_price = _extract_price_field(data, payload, "reference_price")
            if reference_price is None:
                price_chg = _extract_price_field(data, payload, "price_chg")
                if price_chg is not None:
                    reference_price = close_price - price_chg

            close_price = close_price if close_price is not None else last_price
            open_price = open_price if open_price is not None else close_price
            high_price = high_price if high_price is not None else max(open_price, close_price)
            low_price = low_price if low_price is not None else min(open_price, close_price)

            current = self._latest_state.get(symbol)
            if current is None:
                current = {
                    "symbol": symbol,
                    "last_price": last_price,
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "session_high": high_price,
                    "session_low": low_price,
                    "is_new_high": False,
                    "is_new_low": False,
                    "updated_at": event_ts.isoformat(),
                }
                if reference_price is not None:
                    gap_value = open_price - reference_price
                    current["reference_price"] = reference_price
                    current["gap_value"] = gap_value
                    if reference_price == 0:
                        current["gap_pct"] = 0.0
                    else:
                        current["gap_pct"] = (gap_value / reference_price) * 100
                    current["is_gap_up"] = gap_value > 0
                    current["is_gap_down"] = gap_value < 0
                    self._reference_trade_date[symbol] = trade_date
            else:
                prev_session_high = float(current.get("session_high", high_price))
                prev_session_low = float(current.get("session_low", low_price))
                current["is_new_high"] = high_price > prev_session_high
                current["is_new_low"] = low_price < prev_session_low
                current["last_price"] = last_price
                current["open"] = float(current.get("open", open_price))
                current["high"] = max(float(current.get("high", high_price)), high_price)
                current["low"] = min(float(current.get("low", low_price)), low_price)
                current["close"] = close_price
                current["session_high"] = max(prev_session_high, high_price)
                current["session_low"] = min(prev_session_low, low_price)
                locked_trade_date = self._reference_trade_date.get(symbol)
                should_update_reference = reference_price is not None and (
                    _coerce_float(current.get("reference_price")) is None
                    or locked_trade_date is None
                    or locked_trade_date != trade_date
                )
                if should_update_reference and reference_price is not None:
                    current["reference_price"] = reference_price
                    self._reference_trade_date[symbol] = trade_date
                ref = _coerce_float(current.get("reference_price"))
                if ref is not None:
                    gap_value = float(current.get("open", open_price)) - ref
                    current["gap_value"] = gap_value
                    current["gap_pct"] = 0.0 if ref == 0 else (gap_value / ref) * 100
                    current["is_gap_up"] = gap_value > 0
                    current["is_gap_down"] = gap_value < 0
                current["updated_at"] = event_ts.isoformat()

            self._latest_state[symbol] = current
            if ingest_seq > 0:
                self._last_ingest_seq[symbol] = ingest_seq
            self._dirty_symbols.add(symbol)
            self._metrics.inc("latest_state_events_processed_total")
            self._metrics.set_gauge("latest_state_stream_lag_ms", self._stream_lag_ms(event_ts))
            self._metrics.set_gauge("latest_state_dirty_symbols", len(self._dirty_symbols))
            if self._on_new_extreme and (current.get("is_new_high") or current.get("is_new_low")):
                try:
                    self._on_new_extreme(dict(current))
                except Exception:
                    logger.exception("latest-state notifier failed symbol=%s", symbol)
            return True
        except Exception:
            logger.exception("latest-state entry processing failed entry_id=%s", entry_id)
            self._metrics.inc("latest_state_process_errors_total")
            return False

    def flush_dirty_once(self, force: bool = False, flush_all: bool = False) -> int:
        if not self._dirty_symbols:
            return 0
        now = time.monotonic()
        if not force and (now - self._last_flush_at) < self._flush_interval_seconds:
            return 0

        if flush_all:
            to_flush = sorted(self._dirty_symbols)
        else:
            to_flush = sorted(self._dirty_symbols)[: self._flush_batch_size]
        try:
            pipeline = getattr(self._redis, "pipeline", None)
            pipe = pipeline(transaction=False) if callable(pipeline) else None
            for symbol in to_flush:
                state = self._latest_state.get(symbol)
                if state is None:
                    continue
                key = f"{self._env}:state:spot:{symbol}:latest"
                value = json.dumps(state, ensure_ascii=True)
                if pipe is not None:
                    pipe.set(key, value)
                    pipe.expire(key, self._state_ttl_seconds)
                else:
                    self._redis.set(key, value)
                    self._redis.expire(key, self._state_ttl_seconds)
            if pipe is not None:
                pipe.execute()
            for symbol in to_flush:
                self._dirty_symbols.discard(symbol)
            self._last_flush_at = now
            self._metrics.inc("latest_state_flush_total")
            self._metrics.set_gauge("latest_state_dirty_symbols", len(self._dirty_symbols))
            return len(to_flush)
        except Exception:
            logger.exception("latest-state flush failed")
            self._metrics.inc("latest_state_flush_errors_total")
            return 0

    @staticmethod
    def _stream_lag_ms(event_ts: datetime) -> int:
        now = datetime.now(tz=timezone.utc)
        return int(max((now - event_ts).total_seconds() * 1000, 0))
