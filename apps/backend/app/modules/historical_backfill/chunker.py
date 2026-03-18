"""Date range chunking helpers."""

from __future__ import annotations

from datetime import date, timedelta


def chunk_date_range(start_date: date, end_date: date) -> list[tuple[date, date]]:
    if start_date > end_date:
        raise ValueError("invalid_date_range")
    chunks: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        chunks.append((cursor, cursor))
        cursor = cursor + timedelta(days=1)
    return chunks
