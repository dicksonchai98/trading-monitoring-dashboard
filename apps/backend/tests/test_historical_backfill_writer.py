from __future__ import annotations

from datetime import date, datetime

from app.db.session import SessionLocal
from app.models.kbar_1m import Kbar1mModel
from app.modules.historical_backfill.transformer import HistoricalBarRecord
from app.modules.historical_backfill.writer import upsert_kbars
from sqlalchemy import select
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Taipei")


def test_upsert_kbars_is_idempotent_on_code_and_minute_ts() -> None:
    row = HistoricalBarRecord(
        code="TXF",
        trade_date=date(2026, 3, 1),
        minute_ts=datetime(2026, 3, 1, 9, 30, tzinfo=TZ),
        open=100.0,
        high=101.0,
        low=99.0,
        close=100.5,
        volume=10.0,
        source="historical",
    )
    with SessionLocal() as session:
        first = upsert_kbars(session, [row], overwrite_mode="force")
        session.commit()
        second = upsert_kbars(session, [row], overwrite_mode="force")
        session.commit()
        stmt = select(Kbar1mModel).where(Kbar1mModel.code == "TXF")
        items = list(session.execute(stmt).scalars())

    assert first.rows_written == 1
    assert second.rows_written == 1
    assert len(items) == 1


def test_upsert_closed_only_skips_conflict_rows() -> None:
    minute = datetime(2026, 3, 1, 9, 30, tzinfo=TZ)
    with SessionLocal() as session:
        session.add(
            Kbar1mModel(
                code="TXF",
                trade_date=date(2026, 3, 1),
                minute_ts=minute,
                open=10.0,
                high=10.0,
                low=10.0,
                close=10.0,
                volume=1.0,
            )
        )
        session.commit()

        incoming = HistoricalBarRecord(
            code="TXF",
            trade_date=date(2026, 3, 1),
            minute_ts=minute,
            open=100.0,
            high=101.0,
            low=99.0,
            close=100.5,
            volume=10.0,
            source="historical",
        )
        result = upsert_kbars(session, [incoming], overwrite_mode="closed_only")
        session.commit()
        row = session.execute(
            select(Kbar1mModel).where(Kbar1mModel.code == "TXF", Kbar1mModel.minute_ts == minute)
        ).scalar_one()

    assert result.rows_skipped_conflict == 1
    assert row.close == 10.0
