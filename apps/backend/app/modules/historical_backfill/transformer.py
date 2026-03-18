"""Historical row transformation and validation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from app.modules.historical_backfill.calendar import to_taipei_minute, trading_session_date


@dataclass(frozen=True)
class HistoricalBarRecord:
    code: str
    trade_date: date
    minute_ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    source: str


@dataclass(frozen=True)
class TransformOutput:
    valid_rows: list[HistoricalBarRecord]
    invalid_count: int


def _parse_ts(raw: Any) -> datetime | None:
    if not isinstance(raw, str):
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def transform_historical_rows(code: str, rows: list[dict[str, Any]]) -> TransformOutput:
    valid: list[HistoricalBarRecord] = []
    invalid_count = 0
    for item in rows:
        ts = _parse_ts(item.get("ts"))
        o = _to_float(item.get("open"))
        h = _to_float(item.get("high"))
        low = _to_float(item.get("low"))
        c = _to_float(item.get("close"))
        v = _to_float(item.get("volume"))
        if ts is None or o is None or h is None or low is None or c is None:
            invalid_count += 1
            continue
        if not (low <= o <= h and low <= c <= h):
            invalid_count += 1
            continue
        minute_ts = to_taipei_minute(ts)
        valid.append(
            HistoricalBarRecord(
                code=code,
                trade_date=trading_session_date(minute_ts),
                minute_ts=minute_ts,
                open=o,
                high=h,
                low=low,
                close=c,
                volume=v or 0.0,
                source="historical",
            )
        )
    return TransformOutput(valid_rows=valid, invalid_count=invalid_count)
