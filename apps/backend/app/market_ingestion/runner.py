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
    INGESTOR_QUOTE_TYPES,
    INGESTOR_RECONNECT_MAX_SECONDS,
    SHIOAJI_API_KEY,
    SHIOAJI_SECRET_KEY,
    SHIOAJI_SIMULATION,
)
from app.market_ingestion.pipeline import IngestionPipeline
from app.market_ingestion.shioaji_client import ShioajiClient
from app.market_ingestion.shioaji_subscription import resolve_contract, subscribe_topics
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
        shioaji_api: Any,
        redis_client: Any,
        metrics: Metrics,
        queue_maxsize: int,
        stream_maxlen: int,
        retry_attempts: int,
        retry_backoff_ms: int,
    ) -> None:
        self._metrics = metrics
        self._client = ShioajiClient(
            api=shioaji_api,
            api_key=SHIOAJI_API_KEY,
            secret_key=SHIOAJI_SECRET_KEY,
            simulation=SHIOAJI_SIMULATION,
        )
        self._pipeline = IngestionPipeline(queue_maxsize=queue_maxsize, metrics=metrics)
        self._writer = RedisWriter(
            redis_client=redis_client,
            metrics=metrics,
            maxlen=stream_maxlen,
            retry_attempts=retry_attempts,
            retry_backoff_ms=retry_backoff_ms,
        )
        self._writer_task: asyncio.Task[None] | None = None
        self._reconnect_task: asyncio.Task[None] | None = None
        self._resubscribe_task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self._contract: Any = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def _register_callbacks(self) -> None:
        def on_tick(_exchange: Any, tick: Any) -> None:
            self._on_quote("tick", tick)

        def on_bidask(_exchange: Any, bidask: Any) -> None:
            self._on_quote("bidask", bidask)

        def on_event(resp_code: int, event_code: int, info: str, event: str) -> None:
            self._on_quote_event(resp_code, event_code, info, event)

        self._client.set_on_tick_fop_v1_callback(on_tick)
        self._client.set_on_bidask_fop_v1_callback(on_bidask)
        self._client.set_on_event_callback(on_event)

    def _on_quote(self, quote_type: str, quote: Any) -> None:
        code = getattr(quote, "code", INGESTOR_CODE)
        event_ts_obj = getattr(quote, "datetime", datetime.utcnow())
        event_ts = (
            event_ts_obj.isoformat() if hasattr(event_ts_obj, "isoformat") else str(event_ts_obj)
        )
        payload = quote.to_dict(raw=True) if hasattr(quote, "to_dict") else dict(vars(quote))
        event = self._pipeline.build_event(
            code=code,
            quote_type=quote_type,
            payload=payload,
            event_ts=event_ts,
        )
        stream_key = build_stream_key(INGESTOR_ENV, quote_type, code)
        self._pipeline.enqueue(stream_key=stream_key, event=event)

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._register_callbacks()
        await self._login_and_subscribe()
        self._writer_task = asyncio.create_task(self._writer_loop())

    async def stop(self) -> None:
        self._stop_event.set()
        for task_name in ("_reconnect_task", "_resubscribe_task"):
            task = getattr(self, task_name)
            if task is not None and not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        if self._writer_task is not None:
            self._writer_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._writer_task
        try:
            self._client.logout()
        except Exception:
            logger.exception("ingestor logout failed")

    async def _login_and_subscribe(self) -> None:
        self._client.login()
        self._client.fetch_contracts()
        self._contract = resolve_contract(self._client.api, INGESTOR_CODE)
        subscribe_topics(self._client.api, self._contract, INGESTOR_QUOTE_TYPES)
        logger.info(
            "ingestor subscribed code=%s quote_types=%s",
            INGESTOR_CODE,
            INGESTOR_QUOTE_TYPES,
        )

    async def _resubscribe(self) -> None:
        self._client.fetch_contracts()
        self._contract = resolve_contract(self._client.api, INGESTOR_CODE)
        subscribe_topics(self._client.api, self._contract, INGESTOR_QUOTE_TYPES)
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

    async def _writer_loop(self) -> None:
        while not self._stop_event.is_set():
            item = await self._pipeline.queue.get()
            await self._writer.drain_once(item)
            self._metrics.set_gauge("queue_depth", self._pipeline.queue.qsize())
            self._pipeline.queue.task_done()
