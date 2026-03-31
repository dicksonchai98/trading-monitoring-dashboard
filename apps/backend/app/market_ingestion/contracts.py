"""Contracts for ingestion events and runtime dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class IngestionEvent:
    source: str
    code: str
    asset_type: str
    quote_type: str
    event_ts: str
    recv_ts: str
    ingest_seq: int | None
    payload: dict[str, Any]


@dataclass(frozen=True)
class QueueItem:
    stream_key: str
    event: IngestionEvent


class MetricsProtocol(Protocol):
    def inc(self, key: str) -> None: ...

    def set_gauge(self, key: str, value: int | float) -> None: ...
