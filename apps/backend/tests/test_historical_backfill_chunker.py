from __future__ import annotations

from datetime import date

from app.modules.historical_backfill.chunker import chunk_date_range


def test_chunk_date_range_is_inclusive() -> None:
    chunks = chunk_date_range(date(2026, 3, 1), date(2026, 3, 3))
    assert chunks == [
        (date(2026, 3, 1), date(2026, 3, 1)),
        (date(2026, 3, 2), date(2026, 3, 2)),
        (date(2026, 3, 3), date(2026, 3, 3)),
    ]


def test_chunk_date_range_rejects_invalid_bounds() -> None:
    try:
        chunk_date_range(date(2026, 3, 3), date(2026, 3, 1))
    except ValueError as err:
        assert str(err) == "invalid_date_range"
    else:  # pragma: no cover
        raise AssertionError("expected ValueError")
