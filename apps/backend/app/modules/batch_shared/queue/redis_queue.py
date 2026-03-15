"""Redis-backed queue helpers for batch job dispatch."""

from __future__ import annotations

from typing import Any


class RedisBatchQueue:
    def __init__(self, client: Any) -> None:
        self._client = client

    def queue_name(self, worker_type: str) -> str:
        return f"queue:batch:{worker_type}"

    def enqueue(self, worker_type: str, job_id: int) -> None:
        self._client.lpush(self.queue_name(worker_type), str(job_id))

    def dequeue_blocking(self, worker_type: str, timeout_seconds: int = 0) -> int | None:
        result = self._client.brpop(self.queue_name(worker_type), timeout=timeout_seconds)
        if result is None:
            return None
        _, value = result
        return int(value)
