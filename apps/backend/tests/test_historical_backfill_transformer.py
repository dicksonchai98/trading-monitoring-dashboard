from __future__ import annotations

from datetime import datetime

from app.modules.historical_backfill.transformer import (
    HistoricalBarRecord,
    transform_historical_rows,
)
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Taipei")


def test_transform_normalizes_to_minute_start_and_timezone() -> None:
    rows = [
        {
            "ts": "2026-03-01T09:30:25+08:00",
            "open": 100.0,
            "high": 105.0,
            "low": 99.0,
            "close": 103.0,
            "volume": 10,
        }
    ]
    output = transform_historical_rows(code="TXF", rows=rows)
    assert len(output.valid_rows) == 1
    item = output.valid_rows[0]
    assert isinstance(item, HistoricalBarRecord)
    assert item.minute_ts == datetime(2026, 3, 1, 9, 30, tzinfo=TZ)
    assert item.trade_date.isoformat() == "2026-03-01"


def test_transform_filters_invalid_ohlc_rows() -> None:
    rows = [
        {
            "ts": "2026-03-01T09:30:00+08:00",
            "open": 100.0,
            "high": 99.0,
            "low": 98.0,
            "close": 100.0,
            "volume": 1,
        }
    ]
    output = transform_historical_rows(code="TXF", rows=rows)
    assert output.valid_rows == []
    assert output.invalid_count == 1
