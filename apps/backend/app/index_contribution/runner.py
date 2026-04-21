"""Runner wrapper for the index contribution worker."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import suppress
from datetime import date, datetime, timedelta, timezone
from typing import Any

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.index_contribution.engine import IndexContributionEngine
from app.services.metrics import Metrics

try:
    TZ_TAIPEI = ZoneInfo("Asia/Taipei")
except ZoneInfoNotFoundError:  # pragma: no cover - runtime env specific
    TZ_TAIPEI = timezone(timedelta(hours=8))

logger = logging.getLogger(__name__)


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _parse_json(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _parse_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def parse_event_ts(event_ts: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(event_ts.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ_TAIPEI)
    return parsed


class IndexContributionRunner:
    """Lightweight worker runner with managed lifecycle."""

    def __init__(
        self,
        redis_client: Any,
        metrics: Metrics,
        *,
        env: str,
        group: str,
        consumer: str,
        read_count: int,
        block_ms: int,
        claim_idle_ms: int,
        claim_count: int,
        index_code: str,
        index_prev_close: float,
        redis_ttl_seconds: int,
        redis_max_retries: int = 3,
        redis_retry_backoff_ms: int = 50,
        db_max_retries: int = 3,
        db_retry_backoff_ms: int = 200,
        allow_late_snapshot_rewrite: bool = False,
        dead_letter_sink: Any | None = None,
        session_factory: Any | None = None,
        daily_input_loader: Any | None = None,
        alarm_sink: Any | None = None,
        redis_failure_alarm_threshold: int = 3,
        db_failure_alarm_threshold: int = 3,
        stream_key: str | None = None,
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
        self._stream_key = stream_key or f"{env}:stream:spot"
        self._redis_ttl_seconds = max(1, redis_ttl_seconds)
        self._redis_max_retries = max(1, redis_max_retries)
        self._redis_retry_backoff_seconds = max(0, redis_retry_backoff_ms) / 1000.0
        self._db_max_retries = max(1, db_max_retries)
        self._db_retry_backoff_seconds = max(0, db_retry_backoff_ms) / 1000.0
        self._allow_late_snapshot_rewrite = allow_late_snapshot_rewrite
        self._dead_letter_sink = dead_letter_sink
        self._session_factory = session_factory
        self._daily_input_loader = daily_input_loader
        self._alarm_sink = alarm_sink
        self._redis_failure_alarm_threshold = max(1, redis_failure_alarm_threshold)
        self._db_failure_alarm_threshold = max(1, db_failure_alarm_threshold)
        self._stop = False
        self._task: asyncio.Task[None] | None = None
        self._last_flushed_minute_ts: datetime | None = None
        self._active_trade_date: date | None = None
        self._constituents: dict[str, dict[str, Any]] = {}
        self._sector_mapping: dict[str, str] = {}
        self._last_ingest_seq: dict[str, int] = {}
        self._consecutive_redis_failures = 0
        self._consecutive_db_failures = 0
        self.engine = IndexContributionEngine(
            index_code=index_code,
            index_prev_close=index_prev_close,
        )

    async def start(self) -> None:
        self.initialize_daily_inputs()
        self._ensure_consumer_group()
        self._stop = False
        self._task = asyncio.create_task(self._run_loop())

    async def stop_async(self) -> None:
        self._stop = True
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task

    async def _run_loop(self) -> None:
        while not self._stop:
            processed = self.consume_once()
            _ = self.flush_minute_snapshots(now=datetime.now(tz=timezone.utc))
            if processed == 0:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0)

    def consume_once(self) -> int:
        processed = 0
        for entry_id, fields in self._claim_pending():
            if self._handle_spot_entry(entry_id, fields):
                self._redis.xack(self._stream_key, self._group, entry_id)
                processed += 1
        for entry_id, fields in self._read_new():
            if self._handle_spot_entry(entry_id, fields):
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

    def _ensure_consumer_group(self) -> None:
        try:
            self._redis.xgroup_create(self._stream_key, self._group, id="0-0", mkstream=True)
        except Exception as err:  # pragma: no cover - depends on redis behavior
            if "BUSYGROUP" in str(err).upper():
                return
            raise

    def _parse_spot_entry(self, entry_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        data = {_decode(k): _decode(v) for k, v in fields.items()}
        symbol = str(data.get("symbol") or "").strip()
        if not symbol:
            return None
        event_ts_raw = str(data.get("event_ts") or "")
        event_ts = parse_event_ts(event_ts_raw)
        if event_ts is None:
            return None

        payload: dict[str, Any] = {}
        payload_raw = data.get("payload")
        if isinstance(payload_raw, str):
            parsed_payload = _parse_json(payload_raw)
            if isinstance(parsed_payload, dict):
                payload = parsed_payload

        last_price = _parse_float(data.get("last_price"))
        if last_price is None or last_price <= 0:
            raw_quote = payload.get("raw_quote", {})
            if isinstance(raw_quote, dict):
                last_price = _parse_float(raw_quote.get("close"))
        if last_price is None or last_price <= 0:
            return None

        prev_close = _parse_float(data.get("prev_close"))
        if prev_close is None or prev_close <= 0:
            prev_close = _parse_float(payload.get("prev_close"))
        if prev_close is None or prev_close <= 0:
            raw_quote = payload.get("raw_quote", {})
            if isinstance(raw_quote, dict):
                close_value = _parse_float(raw_quote.get("close"))
                price_chg = _parse_float(raw_quote.get("price_chg"))
                if close_value is not None and price_chg is not None:
                    derived_prev = close_value - price_chg
                    if derived_prev > 0:
                        prev_close = derived_prev
        if prev_close is None or prev_close <= 0:
            return None

        ingest_seq_value = _parse_float(data.get("ingest_seq"))
        ingest_seq = int(ingest_seq_value) if ingest_seq_value is not None else None
        return {
            "entry_id": entry_id,
            "symbol": symbol,
            "event_ts": event_ts,
            "last_price": last_price,
            "prev_close": prev_close,
            "ingest_seq": ingest_seq,
        }

    def _handle_spot_entry(self, entry_id: str, fields: dict[str, Any]) -> bool:
        try:
            parsed = self._parse_spot_entry(entry_id, fields)
            if parsed is None:
                self._metrics.inc("index_contribution_events_dropped_invalid_total")
                return True

            symbol = str(parsed["symbol"])
            updated_at = parsed["event_ts"]
            ingest_seq = parsed["ingest_seq"]
            if isinstance(ingest_seq, int):
                last_seq = self._last_ingest_seq.get(symbol, -1)
                if ingest_seq <= last_seq:
                    self._metrics.inc("index_contribution_events_dropped_ingest_seq_total")
                    return True

            accepted = self.process_market_update(
                symbol=symbol,
                last_price=float(parsed["last_price"]),
                prev_close=float(parsed["prev_close"]),
                updated_at=updated_at,
                event_id=entry_id,
            )
            if not accepted:
                return True

            trade_date = self.floor_minute_taipei(updated_at).date()
            self.publish_symbol_latest(trade_date=trade_date, symbol=symbol)
            self.publish_rankings(trade_date=trade_date, limit=20)
            self.publish_sector_aggregate(trade_date=trade_date)
            if isinstance(ingest_seq, int):
                self._last_ingest_seq[symbol] = ingest_seq
            return True
        except Exception:
            logger.exception(
                "index-contribution stream entry processing failed entry_id=%s", entry_id
            )
            self._metrics.inc("index_contribution_events_process_errors_total")
            return False

    def initialize_daily_inputs(self) -> None:
        if self._daily_input_loader is None:
            return
        loaded = self._daily_input_loader.load()
        self.engine.index_prev_close = loaded.index_prev_close
        self._constituents = {
            symbol: {
                "symbol_name": row.symbol_name,
                "weight": row.weight,
                "weight_version": row.weight_version,
                "table_sector": row.table_sector,
            }
            for symbol, row in loaded.constituents.items()
        }
        self._sector_mapping = dict(loaded.sector_mapping)
        logger.info("index contribution daily inputs loaded size=%s", len(self._constituents))

    def process_market_update(
        self,
        *,
        symbol: str,
        last_price: float,
        prev_close: float,
        updated_at: datetime,
        event_id: str | None = None,
    ) -> bool:
        if self._active_trade_date is None:
            self._active_trade_date = self.floor_minute_taipei(updated_at).date()
        elif self.floor_minute_taipei(updated_at).date() > self._active_trade_date:
            self.daily_reset(new_trade_date=self.floor_minute_taipei(updated_at).date())

        meta = self._constituents.get(symbol)
        if meta is None:
            self._metrics.inc("index_contribution_events_dropped_non_constituent_total")
            return False
        accepted = self.engine.apply_update(
            symbol=symbol,
            symbol_name=str(meta["symbol_name"]),
            mapping_sector=self._sector_mapping.get(symbol),
            table_sector=meta.get("table_sector"),
            last_price=last_price,
            prev_close=prev_close,
            weight=float(meta["weight"]),
            updated_at=updated_at,
            event_id=event_id,
        )
        if accepted:
            self._metrics.inc("index_contribution_events_accepted_total")
        else:
            self._metrics.inc("index_contribution_events_dropped_total")
        return accepted

    def publish_symbol_latest(self, *, trade_date: date, symbol: str) -> None:
        state = self.engine.symbol_state.get(symbol)
        if state is None:
            return
        key = (
            f"{self._env}:state:index_contrib:{self.engine.index_code}:"
            f"{trade_date.isoformat()}:{symbol}:latest"
        )
        payload = {
            "symbol": state["symbol"],
            "symbol_name": state["symbol_name"],
            "sector": state["sector"],
            "last_price": state["last_price"],
            "prev_close": state["prev_close"],
            "weight": state["weight"],
            "pct_change": state["pct_change"],
            "contribution_points": state["contribution_points"],
            "updated_at": state["updated_at"].isoformat(),
        }
        self._with_redis_retry(
            lambda: self._set_with_ttl(key, json.dumps(payload, ensure_ascii=False)),
            success_metric="index_contribution_redis_symbol_write_total",
            failure_metric="index_contribution_redis_symbol_write_errors_total",
        )

    def publish_rankings(self, *, trade_date: date, limit: int = 20) -> None:
        top_key = (
            f"{self._env}:state:index_contrib:{self.engine.index_code}:"
            f"{trade_date.isoformat()}:ranking:top"
        )
        bottom_key = (
            f"{self._env}:state:index_contrib:{self.engine.index_code}:"
            f"{trade_date.isoformat()}:ranking:bottom"
        )
        top = self.engine.top_ranking(limit=limit)
        bottom = self.engine.bottom_ranking(limit=limit)

        def _write() -> None:
            self._redis.delete(top_key)
            self._redis.delete(bottom_key)
            for row in top:
                self._redis.zadd(top_key, {row["symbol"]: float(row["contribution_points"])})
            for row in bottom:
                self._redis.zadd(bottom_key, {row["symbol"]: float(row["contribution_points"])})
            self._redis.expire(top_key, self._redis_ttl_seconds)
            self._redis.expire(bottom_key, self._redis_ttl_seconds)

        self._with_redis_retry(
            _write,
            success_metric="index_contribution_redis_ranking_write_total",
            failure_metric="index_contribution_redis_ranking_write_errors_total",
        )

    def publish_sector_aggregate(self, *, trade_date: date) -> None:
        """Publish sector treemap data with symbol details."""
        key = (
            f"{self._env}:state:index_contrib:{self.engine.index_code}:"
            f"{trade_date.isoformat()}:sector"
        )

        # Build treemap structure: group symbols by sector
        sectors_dict: dict[str, list[dict[str, Any]]] = {}
        for symbol_data in self.engine.symbol_state.values():
            sector = str(symbol_data.get("sector", "other")).strip().lower() or "other"
            if sector not in sectors_dict:
                sectors_dict[sector] = []

            sectors_dict[sector].append(
                {
                    "name": str(symbol_data["symbol"]),
                    "size": float(symbol_data["weight"]) * 100,  # Convert to percentage
                    "contribution_points": float(symbol_data["contribution_points"]),
                }
            )

        # Convert to array format for frontend
        sectors = [
            {"name": sector_name, "children": children}
            for sector_name, children in sectors_dict.items()
        ]

        payload = json.dumps(sectors, ensure_ascii=False)
        self._with_redis_retry(
            lambda: self._set_with_ttl(key, payload),
            success_metric="index_contribution_redis_sector_write_total",
            failure_metric="index_contribution_redis_sector_write_errors_total",
        )

    def _set_with_ttl(self, key: str, value: str) -> None:
        self._redis.set(key, value)
        self._redis.expire(key, self._redis_ttl_seconds)

    def _with_redis_retry(
        self,
        operation: Any,
        *,
        success_metric: str,
        failure_metric: str,
    ) -> None:
        for attempt in range(1, self._redis_max_retries + 1):
            try:
                operation()
            except Exception:
                self._metrics.inc(failure_metric)
                self._consecutive_redis_failures += 1
                self._emit_alarm_if_needed(
                    channel="redis",
                    consecutive_failures=self._consecutive_redis_failures,
                    threshold=self._redis_failure_alarm_threshold,
                )
                if attempt == self._redis_max_retries:
                    raise
                if self._redis_retry_backoff_seconds > 0:
                    time.sleep(self._redis_retry_backoff_seconds)
                continue
            self._consecutive_redis_failures = 0
            self._metrics.inc(success_metric)
            return

    @staticmethod
    def floor_minute_taipei(ts: datetime) -> datetime:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=TZ_TAIPEI)
        local = ts.astimezone(TZ_TAIPEI)
        return local.replace(second=0, microsecond=0)

    def should_flush_minute(self, now: datetime) -> tuple[bool, datetime]:
        minute_ts = self.floor_minute_taipei(now)
        if self._last_flushed_minute_ts is None:
            return True, minute_ts
        return minute_ts > self._last_flushed_minute_ts, minute_ts

    def should_accept_late_event_snapshot(self, event_ts: datetime) -> bool:
        if self._allow_late_snapshot_rewrite:
            return True
        if self._last_flushed_minute_ts is None:
            return True
        return self.floor_minute_taipei(event_ts) >= self._last_flushed_minute_ts

    def flush_minute_snapshots(self, *, now: datetime) -> bool:
        if self._session_factory is None:
            return False
        from app.index_contribution.writer import (
            flush_ranking_snapshots,
            flush_sector_snapshots,
            flush_symbol_snapshots,
        )

        should_flush, minute_ts = self.should_flush_minute(now)
        if not should_flush:
            return False
        trade_date = minute_ts.date()

        symbol_rows = list(self.engine.symbol_state.values())
        top_rows = self.engine.top_ranking(limit=20)
        bottom_rows = self.engine.bottom_ranking(limit=20)
        sector_rows = dict(self.engine.sector_aggregate)

        def _flush_once() -> None:
            with self._session_factory() as session:
                flush_symbol_snapshots(
                    session=session,
                    index_code=self.engine.index_code,
                    trade_date=trade_date,
                    minute_ts=minute_ts,
                    symbol_rows=symbol_rows,
                )
                flush_ranking_snapshots(
                    session=session,
                    index_code=self.engine.index_code,
                    trade_date=trade_date,
                    minute_ts=minute_ts,
                    top_rows=top_rows,
                    bottom_rows=bottom_rows,
                )
                flush_sector_snapshots(
                    session=session,
                    index_code=self.engine.index_code,
                    trade_date=trade_date,
                    minute_ts=minute_ts,
                    sector_rows=sector_rows,
                )
                session.commit()

        for attempt in range(1, self._db_max_retries + 1):
            try:
                _flush_once()
            except Exception as err:
                self._metrics.inc("index_contribution_db_flush_errors_total")
                self._consecutive_db_failures += 1
                self._emit_alarm_if_needed(
                    channel="db",
                    consecutive_failures=self._consecutive_db_failures,
                    threshold=self._db_failure_alarm_threshold,
                )
                if attempt == self._db_max_retries:
                    if callable(self._dead_letter_sink):
                        self._dead_letter_sink(
                            {
                                "minute_ts": minute_ts.isoformat(),
                                "index_code": self.engine.index_code,
                                "symbol_count": len(symbol_rows),
                                "top_count": len(top_rows),
                                "bottom_count": len(bottom_rows),
                                "sector_count": len(sector_rows),
                                "error": str(err),
                            }
                        )
                    return False
                if self._db_retry_backoff_seconds > 0:
                    time.sleep(self._db_retry_backoff_seconds)
                continue
            self._consecutive_db_failures = 0
            self._metrics.inc("index_contribution_db_flush_total")
            lag_seconds = max((now.astimezone(TZ_TAIPEI) - minute_ts).total_seconds(), 0.0)
            self._metrics.set_gauge("index_contribution_snapshot_lag_seconds", lag_seconds)
            self._last_flushed_minute_ts = minute_ts
            return True
        return False

    def daily_reset(self, *, new_trade_date: date) -> None:
        self.engine.symbol_state.clear()
        self.engine.sector_aggregate.clear()
        self.engine._processed_event_ids.clear()  # noqa: SLF001
        self._last_ingest_seq.clear()
        self._last_flushed_minute_ts = None
        self._active_trade_date = new_trade_date
        self.initialize_daily_inputs()
        self._metrics.inc("index_contribution_daily_reset_total")

    def warm_restart_rebuild(
        self,
        *,
        from_redis: Any | None = None,
        from_db: Any | None = None,
    ) -> str:
        if callable(from_redis):
            rebuilt = from_redis(self.engine)
            if rebuilt:
                self._metrics.inc("index_contribution_warm_restart_redis_total")
                return "redis"
        if callable(from_db):
            rebuilt = from_db(self.engine)
            if rebuilt:
                self._metrics.inc("index_contribution_warm_restart_db_total")
                return "db"
        self._metrics.inc("index_contribution_warm_restart_empty_total")
        return "empty"

    def _emit_alarm_if_needed(
        self,
        *,
        channel: str,
        consecutive_failures: int,
        threshold: int,
    ) -> None:
        if consecutive_failures < threshold:
            return
        self._metrics.inc(f"index_contribution_{channel}_alarm_total")
        if callable(self._alarm_sink):
            self._alarm_sink(
                {
                    "channel": channel,
                    "consecutive_failures": consecutive_failures,
                    "threshold": threshold,
                }
            )
