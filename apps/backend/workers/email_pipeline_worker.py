"""Email pipeline worker entrypoint.

This worker runs two stages in one process:
1) Dispatch pending outbox rows into Redis Stream.
2) Consume stream messages and deliver via provider.
"""

from __future__ import annotations

import argparse
import logging
import signal
import time
from typing import Any

from app.config import (
    EMAIL_STREAM_CONSUMER,
    EMAIL_STREAM_GROUP,
    EMAIL_STREAM_KEY,
    REDIS_URL,
    SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL,
)
from app.db.session import SessionLocal
from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.services.email_outbox_dispatcher import EmailOutboxDispatcher
from app.services.sendgrid_provider import SendGridProvider

from workers.email_worker import EmailWorker

logger = logging.getLogger(__name__)


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


class EmailPipelineWorker:
    def __init__(
        self,
        *,
        redis_client: Any,
        stream_key: str,
        group: str,
        consumer: str,
        dispatch_limit: int,
        read_count: int,
        block_ms: int,
        claim_idle_ms: int,
    ) -> None:
        self._redis = redis_client
        self._stream_key = stream_key
        self._group = group
        self._consumer = consumer
        self._dispatch_limit = dispatch_limit
        self._read_count = read_count
        self._block_ms = block_ms
        self._claim_idle_ms = claim_idle_ms
        outbox_repository = EmailOutboxRepository(session_factory=SessionLocal)
        self._dispatcher = EmailOutboxDispatcher(
            redis_client=redis_client,
            outbox_repository=outbox_repository,
            stream_key=stream_key,
        )
        self._worker = EmailWorker(
            outbox_repository=outbox_repository,
            delivery_log_repository=EmailDeliveryLogRepository(session_factory=SessionLocal),
            provider=SendGridProvider(
                api_key=SENDGRID_API_KEY,
                from_email=SENDGRID_FROM_EMAIL,
            ),
        )

    def ensure_group(self) -> None:
        try:
            self._redis.xgroup_create(self._stream_key, self._group, id="0-0", mkstream=True)
        except Exception as err:  # pragma: no cover - runtime redis behavior
            if "BUSYGROUP" not in str(err).upper():
                raise

    def run_once(self) -> int:
        dispatched = self._dispatcher.dispatch_once(limit=self._dispatch_limit)
        claimed = self._consume_claimed()
        consumed = self._consume_new()
        return dispatched + claimed + consumed

    def _consume_claimed(self) -> int:
        try:
            _next, entries, _deleted = self._redis.xautoclaim(
                self._stream_key,
                self._group,
                self._consumer,
                min_idle_time=self._claim_idle_ms,
                start_id="0-0",
                count=self._read_count,
            )
        except Exception:
            return 0
        return self._handle_entries(entries)

    def _consume_new(self) -> int:
        try:
            entries = self._redis.xreadgroup(
                groupname=self._group,
                consumername=self._consumer,
                streams={self._stream_key: ">"},
                count=self._read_count,
                block=self._block_ms,
            )
        except Exception:
            return 0

        handled = 0
        for _stream, messages in entries or []:
            handled += self._handle_entries(messages)
        return handled

    def _handle_entries(self, entries: list[tuple[str, dict[str, Any]]]) -> int:
        handled = 0
        for entry_id, fields in entries:
            payload = {_decode(k): _decode(v) for k, v in fields.items()}
            try:
                result = self._worker.handle_message(payload)
                if result in {"sent", "failed", "skipped", "missing"}:
                    self._redis.xack(self._stream_key, self._group, entry_id)
                    handled += 1
            except Exception:
                logger.exception(
                    "email worker failed for entry_id=%s payload=%s",
                    entry_id,
                    payload,
                )
        return handled


def main() -> None:
    parser = argparse.ArgumentParser(description="run email outbox pipeline worker")
    parser.add_argument("--dispatch-limit", type=int, default=100)
    parser.add_argument("--read-count", type=int, default=50)
    parser.add_argument("--block-ms", type=int, default=1000)
    parser.add_argument("--claim-idle-ms", type=int, default=30000)
    parser.add_argument("--idle-sleep-seconds", type=float, default=0.2)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if not SENDGRID_API_KEY or not SENDGRID_FROM_EMAIL:
        raise RuntimeError("SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are required for email worker")

    try:
        import redis
    except Exception as err:  # pragma: no cover - runtime dependency
        raise RuntimeError("email worker dependencies unavailable: install redis") from err

    worker = EmailPipelineWorker(
        redis_client=redis.from_url(REDIS_URL),
        stream_key=EMAIL_STREAM_KEY,
        group=EMAIL_STREAM_GROUP,
        consumer=EMAIL_STREAM_CONSUMER,
        dispatch_limit=args.dispatch_limit,
        read_count=args.read_count,
        block_ms=args.block_ms,
        claim_idle_ms=args.claim_idle_ms,
    )
    worker.ensure_group()

    stop_requested = False

    def _request_stop(_sig: int, _frame: Any) -> None:
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, _request_stop)
    signal.signal(signal.SIGTERM, _request_stop)

    while not stop_requested:
        processed = worker.run_once()
        if processed == 0:
            time.sleep(args.idle_sleep_seconds)


if __name__ == "__main__":
    main()
