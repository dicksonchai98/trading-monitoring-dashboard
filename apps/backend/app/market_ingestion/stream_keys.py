"""Redis stream key helpers for ingestion."""

from __future__ import annotations


def build_stream_key(env: str, quote_type: str, code: str) -> str:
    if code:
        return f"{env}:stream:{quote_type}:{code}"
    return f"{env}:stream:{quote_type}"
