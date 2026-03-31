"""Dispatch pending email outbox tasks to Redis Streams."""

from __future__ import annotations

from app.config import EMAIL_STREAM_KEY
from app.repositories.email_outbox_repository import EmailOutboxRepository


class EmailOutboxDispatcher:
    def __init__(
        self,
        redis_client,
        outbox_repository: EmailOutboxRepository,
        stream_key: str = EMAIL_STREAM_KEY,
    ) -> None:
        self._redis = redis_client
        self._outbox_repository = outbox_repository
        self._stream_key = stream_key

    def dispatch_once(self, limit: int = 50) -> int:
        self._outbox_repository.recover_stale_processing(timeout_seconds=60, limit=limit)
        pending = self._outbox_repository.claim_pending(limit=limit)
        dispatched = 0
        for task in pending:
            try:
                self._redis.xadd(
                    self._stream_key,
                    {
                        "outbox_id": task.id,
                        "email_type": task.email_type,
                        "recipient": task.recipient,
                        "template_name": task.template_name,
                        "idempotency_key": task.idempotency_key,
                    },
                )
                dispatched += 1
            except Exception:
                self._outbox_repository.mark_failed_and_increment_retry(task.id)
        return dispatched
