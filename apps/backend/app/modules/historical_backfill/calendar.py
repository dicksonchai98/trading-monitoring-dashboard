"""Exchange calendar helpers for Taiwan futures sessions."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

TZ_TAIPEI = ZoneInfo("Asia/Taipei")
NIGHT_SESSION_START = time(hour=15, minute=0, second=0)
NIGHT_SESSION_END = time(hour=5, minute=0, second=0)


def to_taipei_minute(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=TZ_TAIPEI)
    return ts.astimezone(TZ_TAIPEI).replace(second=0, microsecond=0)


def trading_session_date(ts: datetime) -> date:
    local_ts = to_taipei_minute(ts)
    local_time = local_ts.timetz().replace(tzinfo=None)
    if local_time >= NIGHT_SESSION_START:
        return local_ts.date()
    if local_time < NIGHT_SESSION_END:
        return local_ts.date() - timedelta(days=1)
    return local_ts.date()
