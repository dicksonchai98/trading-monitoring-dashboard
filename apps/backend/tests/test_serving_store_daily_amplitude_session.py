from __future__ import annotations

from datetime import date, datetime

from app.db.session import SessionLocal
from app.models.kbar_1m import Kbar1mModel
from app.services.serving_store import fetch_kbar_daily_amplitude
from zoneinfo import ZoneInfo

TZ_TAIPEI = ZoneInfo("Asia/Taipei")


def _ts(hour: int, minute: int) -> datetime:
    return datetime(2020, 1, 15, hour, minute, tzinfo=TZ_TAIPEI)


def test_daily_amplitude_uses_only_0845_to_1345_session_window() -> None:
    trade_date = date(2020, 1, 15)
    code = "TXFD6"
    with SessionLocal() as session:
        session.add_all(
            [
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=_ts(8, 44),
                    open=100,
                    high=999,  # out-of-window high, should be ignored
                    low=99,
                    close=100,
                    volume=1,
                ),
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=_ts(8, 45),
                    open=100,
                    high=120,
                    low=95,
                    close=110,
                    volume=1,
                ),
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=_ts(10, 0),
                    open=110,
                    high=130,
                    low=90,
                    close=120,
                    volume=1,
                ),
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=_ts(13, 45),
                    open=120,
                    high=125,
                    low=80,
                    close=85,
                    volume=1,
                ),
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=_ts(13, 46),
                    open=85,
                    high=90,
                    low=1,  # out-of-window low, should be ignored
                    close=88,
                    volume=1,
                ),
            ]
        )
        session.commit()

        rows = fetch_kbar_daily_amplitude(session, code=code, days=5)

    assert len(rows) == 1
    day = rows[0]
    assert day["trade_date"] == "2020-01-15"
    assert day["high"] == 130
    assert day["low"] == 80
    assert day["day_amplitude"] == 50
