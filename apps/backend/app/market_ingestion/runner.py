"""Ingestor runtime orchestration."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Coroutine
from contextlib import suppress
from datetime import datetime
from typing import Any

from app.config import (
    INGESTOR_CODE,
    INGESTOR_ENV,
    INGESTOR_MARKET_CODE,
    INGESTOR_MARKET_ENABLED,
    INGESTOR_QUOTE_TYPES,
    INGESTOR_RECONNECT_MAX_SECONDS,
    INGESTOR_SPOT_REQUIRED,
    INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT,
    INGESTOR_SPOT_SYMBOLS_FILE,
)
from app.market_ingestion.pipeline import IngestionPipeline
from app.market_ingestion.shioaji_client import ShioajiClient
from app.market_ingestion.shioaji_subscription import (
    resolve_contract,
    resolve_market_contract,
    subscribe_market_topic,
    subscribe_spot_ticks,
    subscribe_topics,
)
from app.market_ingestion.spot_symbols import load_and_validate_spot_symbols
from app.market_ingestion.stream_keys import build_stream_key
from app.market_ingestion.writer import RedisWriter
from app.services.metrics import Metrics

logger = logging.getLogger(__name__)


def reconnect_delays(attempts: int, cap: int = 30) -> list[int]:
    delays: list[int] = []
    delay = 1
    for _ in range(attempts):
        delays.append(min(delay, cap))
        delay *= 2
    return delays


class MarketIngestionRunner:
    def __init__(
        self,
        shioaji_client: ShioajiClient,
        redis_client: Any,
        metrics: Metrics,
        queue_maxsize: int,
        stream_maxlen: int,
        retry_attempts: int,
        retry_backoff_ms: int,
        spot_symbols_file: str = INGESTOR_SPOT_SYMBOLS_FILE,
        spot_symbols_expected_count: int = INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT,
        spot_required: bool = INGESTOR_SPOT_REQUIRED,
    ) -> None:
        self._metrics = metrics
        self._client = shioaji_client
        self._futures_pipeline = IngestionPipeline(queue_maxsize=queue_maxsize, metrics=metrics)
        self._spot_pipeline = IngestionPipeline(
            queue_maxsize=queue_maxsize,
            metrics=metrics,
            metric_prefix="ingestion_spot_",
        )
        self._futures_writer = RedisWriter(
            redis_client=redis_client,
            metrics=metrics,
            maxlen=stream_maxlen,
            retry_attempts=retry_attempts,
            retry_backoff_ms=retry_backoff_ms,
        )
        self._spot_writer = RedisWriter(
            redis_client=redis_client,
            metrics=metrics,
            maxlen=stream_maxlen,
            retry_attempts=retry_attempts,
            retry_backoff_ms=retry_backoff_ms,
            events_written_metric="ingestion_spot_events_written_redis_total",
            write_failure_metric="ingestion_spot_publish_errors_total",
            write_latency_metric="ingestion_spot_redis_write_latency_ms",
            ingest_lag_metric="ingestion_spot_lag_ms",
        )
        self._futures_writer_task: asyncio.Task[None] | None = None
        self._spot_writer_task: asyncio.Task[None] | None = None
        self._reconnect_task: asyncio.Task[None] | None = None
        self._resubscribe_task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self._contract: Any = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._spot_symbols_file = spot_symbols_file
        self._spot_symbols_expected_count = spot_symbols_expected_count
        self._spot_required = spot_required
        self._spot_symbols: list[str] = []
        self._spot_enabled = False
        self._spot_ingest_seq: dict[str, int] = {}
        self._market_enabled = INGESTOR_MARKET_ENABLED
        self._market_code = INGESTOR_MARKET_CODE
        self._market_contract: Any = None

    def _register_callbacks(self) -> None:
        def on_futures_tick(_exchange: Any, tick: Any) -> None:
            self._on_futures_quote("tick", tick)

        def on_bidask(_exchange: Any, bidask: Any) -> None:
            self._on_futures_quote("bidask", bidask)

        def on_spot_tick(_exchange: Any, tick: Any) -> None:
            self._on_spot_quote(tick)

        def on_market_tick(_exchange: Any, quote: Any) -> None:
            self._on_market_quote(quote)

        def on_event(resp_code: int, event_code: int, info: str, event: str) -> None:
            self._on_quote_event(resp_code, event_code, info, event)

        self._client.set_on_tick_fop_v1_callback(on_futures_tick)
        self._client.set_on_bidask_fop_v1_callback(on_bidask)
        self._client.set_on_tick_stk_v1_callback(on_spot_tick)
        if self._market_enabled:
            self._client.set_on_market_callback(on_market_tick)
        self._client.set_on_event_callback(on_event)

    def _on_futures_quote(self, quote_type: str, quote: Any) -> None:
        code = getattr(quote, "code", INGESTOR_CODE)
        event_ts_obj = getattr(quote, "datetime", datetime.utcnow())
        isoformat = getattr(event_ts_obj, "isoformat", None)
        event_ts = isoformat() if callable(isoformat) else str(event_ts_obj)
        payload = quote.to_dict(raw=True) if hasattr(quote, "to_dict") else dict(vars(quote))
        event = self._futures_pipeline.build_event(
            code=code,
            quote_type=quote_type,
            payload=payload,
            event_ts=event_ts,
            asset_type="futures",
        )
        stream_key = build_stream_key(INGESTOR_ENV, quote_type, code)
        self._futures_pipeline.enqueue(stream_key=stream_key, event=event)

    @staticmethod
    def _extract_last_price(quote: Any, payload: dict[str, Any]) -> float | int:
        for key in ("close", "last_price", "price", "avg_price"):
            value = payload.get(key)
            if isinstance(value, (int, float)):
                return value
            attr = getattr(quote, key, None)
            if isinstance(attr, (int, float)):
                return attr
        return 0

    def _next_spot_ingest_seq(self, symbol: str) -> int:
        current = self._spot_ingest_seq.get(symbol, 0) + 1
        self._spot_ingest_seq[symbol] = current
        return current

    def _on_spot_quote(self, quote: Any) -> None:
        if not self._spot_enabled:
            return
        symbol = str(getattr(quote, "code", "")).strip()
        if not symbol:
            return
        event_ts_obj = getattr(quote, "datetime", datetime.utcnow())
        isoformat = getattr(event_ts_obj, "isoformat", None)
        event_ts = isoformat() if callable(isoformat) else str(event_ts_obj)
        raw_payload = quote.to_dict(raw=True) if hasattr(quote, "to_dict") else dict(vars(quote))
        ingest_seq = self._next_spot_ingest_seq(symbol)
        payload = {
            "symbol": symbol,
            "event_ts": event_ts,
            "last_price": self._extract_last_price(quote, raw_payload),
            "source": "shioaji",
            "ingest_seq": ingest_seq,
            "raw_quote": raw_payload,
        }
        event = self._spot_pipeline.build_event(
            code=symbol,
            quote_type="spot",
            payload=payload,
            event_ts=event_ts,
            asset_type="spot",
            ingest_seq=ingest_seq,
        )
        stream_key = build_stream_key(INGESTOR_ENV, "spot", symbol)
        self._spot_pipeline.enqueue(stream_key=stream_key, event=event)

    def _on_market_quote(self, quote: Any) -> None:
        if not self._market_enabled:
            return
        code = str(getattr(quote, "code", self._market_code) or self._market_code).strip()
        if not code:
            code = self._market_code
        event_ts_obj = getattr(quote, "datetime", datetime.utcnow())
        isoformat = getattr(event_ts_obj, "isoformat", None)
        event_ts = isoformat() if callable(isoformat) else str(event_ts_obj)
        raw_payload = quote.to_dict(raw=True) if hasattr(quote, "to_dict") else dict(vars(quote))
        payload = {
            "index_value": raw_payload.get(
                "index_value", raw_payload.get("close", raw_payload.get("price"))
            ),
            "cumulative_turnover": raw_payload.get(
                "cumulative_turnover",
                raw_payload.get("amount", raw_payload.get("turnover")),
            ),
            "raw_quote": raw_payload,
        }
        event = self._futures_pipeline.build_event(
            code=code,
            quote_type="market",
            payload=payload,
            event_ts=event_ts,
            asset_type="market",
        )
        stream_key = build_stream_key(INGESTOR_ENV, "market", code)
        self._futures_pipeline.enqueue(stream_key=stream_key, event=event)

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._register_callbacks()
        await self._login_and_subscribe()
        self._futures_writer_task = asyncio.create_task(
            self._writer_loop(
                pipeline=self._futures_pipeline,
                writer=self._futures_writer,
                queue_depth_metric="queue_depth",
            )
        )
        self._spot_writer_task = asyncio.create_task(
            self._writer_loop(
                pipeline=self._spot_pipeline,
                writer=self._spot_writer,
                queue_depth_metric="ingestion_spot_queue_depth",
            )
        )

    async def stop(self) -> None:
        self._stop_event.set()
        for task_name in ("_reconnect_task", "_resubscribe_task"):
            task = getattr(self, task_name)
            if task is not None and not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        for task_name in ("_futures_writer_task", "_spot_writer_task"):
            task = getattr(self, task_name)
            if task is not None and not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        try:
            self._client.logout()
        except Exception:
            logger.exception("ingestor logout failed")

    def _load_spot_symbols(self) -> list[str]:
        try:
            symbols = load_and_validate_spot_symbols(
                path=self._spot_symbols_file,
                expected_count=self._spot_symbols_expected_count,
            )
            return symbols
        except Exception as err:
            if self._spot_required:
                raise RuntimeError(f"spot symbol registry validation failed: {err}") from err
            logger.warning(
                "spot ingestion disabled due to invalid symbol registry "
                "file=%s expected=%s error=%s",
                self._spot_symbols_file,
                self._spot_symbols_expected_count,
                err,
            )
            return []

    def _subscribe_spot_symbols(self) -> None:
        self._spot_symbols = self._load_spot_symbols()
        self._spot_enabled = bool(self._spot_symbols)
        if not self._spot_enabled:
            return
        try:
            subscribed = subscribe_spot_ticks(self._client.api, self._spot_symbols)
        except Exception as err:
            if self._spot_required:
                raise RuntimeError(f"spot subscription failed: {err}") from err
            logger.warning("spot ingestion disabled due to subscribe error=%s", err)
            self._spot_enabled = False
            self._spot_symbols = []
            return
        logger.info("ingestor subscribed spot symbols count=%s", subscribed)

    async def _login_and_subscribe(self) -> None:
        self._client.login()
        self._client.fetch_contracts()
        self._contract = resolve_contract(self._client.api, INGESTOR_CODE)
        subscribe_topics(self._client.api, self._contract, INGESTOR_QUOTE_TYPES)
        if self._market_enabled:
            self._market_contract = resolve_market_contract(self._client.api, self._market_code)
            subscribe_market_topic(self._client.api, self._market_contract)
        self._subscribe_spot_symbols()
        logger.info(
            "ingestor subscribed code=%s quote_types=%s",
            INGESTOR_CODE,
            INGESTOR_QUOTE_TYPES,
        )

    async def _resubscribe(self) -> None:
        self._client.fetch_contracts()
        self._contract = resolve_contract(self._client.api, INGESTOR_CODE)
        subscribe_topics(self._client.api, self._contract, INGESTOR_QUOTE_TYPES)
        if self._market_enabled:
            self._market_contract = resolve_market_contract(self._client.api, self._market_code)
            subscribe_market_topic(self._client.api, self._market_contract)
        if self._spot_enabled:
            subscribe_spot_ticks(self._client.api, self._spot_symbols)
        logger.info(
            "ingestor resubscribed code=%s quote_types=%s",
            INGESTOR_CODE,
            INGESTOR_QUOTE_TYPES,
        )

    async def handle_disconnect(self, max_attempts: int = 6) -> None:
        for delay in reconnect_delays(max_attempts, cap=INGESTOR_RECONNECT_MAX_SECONDS):
            self._metrics.inc("ws_reconnect_count")
            await asyncio.sleep(delay)
            try:
                await self._login_and_subscribe()
                return
            except Exception:
                logger.exception("ingestor reconnect attempt failed delay=%s", delay)

    @staticmethod
    def _is_disconnect_event(event_code: int) -> bool:
        return event_code in {2, 3, 12}

    @staticmethod
    def _is_reconnected_event(event_code: int) -> bool:
        return event_code in {4, 13}

    def _on_quote_event(self, resp_code: int, event_code: int, info: str, event: str) -> None:
        logger.info(
            "ingestor quote event resp_code=%s event_code=%s info=%s event=%s",
            resp_code,
            event_code,
            info,
            event,
        )
        if self._is_disconnect_event(event_code):
            self._schedule_reconnect(event_code, info, event)
        elif self._is_reconnected_event(event_code):
            self._schedule_resubscribe(event_code, info, event)

    def _schedule_reconnect(self, event_code: int, info: str, event: str) -> None:
        _ = (event_code, info, event)
        self._schedule_unique_task(
            task_name="_reconnect_task",
            coroutine_factory=self.handle_disconnect,
            error_log="ingestor reconnect task failed",
        )

    def _schedule_resubscribe(self, event_code: int, info: str, event: str) -> None:
        _ = (event_code, info, event)
        self._schedule_unique_task(
            task_name="_resubscribe_task",
            coroutine_factory=self._resubscribe,
            error_log="ingestor resubscribe task failed",
        )

    def _schedule_unique_task(
        self,
        task_name: str,
        coroutine_factory: Callable[[], Coroutine[Any, Any, None]],
        error_log: str,
    ) -> None:
        if self._loop is None:
            logger.warning("ingestor event ignored because event loop is not ready")
            return

        def _create_task() -> None:
            existing = getattr(self, task_name)
            if existing is not None and not existing.done():
                return
            task = self._loop.create_task(coroutine_factory())
            setattr(self, task_name, task)

            def _finalize(done_task: asyncio.Task[None]) -> None:
                setattr(self, task_name, None)
                try:
                    done_task.result()
                except Exception:
                    logger.exception(error_log)

            task.add_done_callback(_finalize)

        self._loop.call_soon_threadsafe(_create_task)

    async def _writer_loop(
        self,
        pipeline: IngestionPipeline,
        writer: RedisWriter,
        queue_depth_metric: str,
    ) -> None:
        while not self._stop_event.is_set():
            item = await pipeline.queue.get()
            ok = await writer.drain_once(item)
            if not ok and item.event.asset_type == "spot":
                logger.error(
                    "spot publish failed asset_type=%s symbol=%s stream_key=%s "
                    "ingest_seq=%s error_type=%s",
                    item.event.asset_type,
                    item.event.code,
                    item.stream_key,
                    item.event.ingest_seq,
                    "redis_write_failure",
                )
            self._metrics.set_gauge(queue_depth_metric, pipeline.queue.qsize())
            pipeline.queue.task_done()
