"""Database writer for historical backfill bars."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.kbar_1m import Kbar1mModel
from app.modules.historical_backfill.transformer import HistoricalBarRecord

MARKET_CLOSE_CUTOFF = time(hour=13, minute=45, second=0)


@dataclass(frozen=True)
class UpsertResult:
    rows_written: int
    rows_skipped_conflict: int


def _is_closed_minute(minute_ts) -> bool:
    return minute_ts.timetz().replace(tzinfo=None) >= MARKET_CLOSE_CUTOFF


def upsert_kbars(
    session: Session, rows: list[HistoricalBarRecord], overwrite_mode: str = "closed_only"
) -> UpsertResult:
    rows_written = 0
    rows_skipped_conflict = 0
    for item in rows:
        existing = session.execute(
            select(Kbar1mModel).where(
                Kbar1mModel.code == item.code,
                Kbar1mModel.minute_ts == item.minute_ts,
            )
        ).scalar_one_or_none()
        if existing is None:
            session.add(
                Kbar1mModel(
                    code=item.code,
                    trade_date=item.trade_date,
                    minute_ts=item.minute_ts,
                    open=item.open,
                    high=item.high,
                    low=item.low,
                    close=item.close,
                    volume=item.volume,
                )
            )
            rows_written += 1
            continue

        if overwrite_mode == "force" or (
            overwrite_mode == "closed_only" and _is_closed_minute(item.minute_ts)
        ):
            existing.trade_date = item.trade_date
            existing.open = item.open
            existing.high = item.high
            existing.low = item.low
            existing.close = item.close
            existing.volume = item.volume
            rows_written += 1
        else:
            rows_skipped_conflict += 1
    return UpsertResult(rows_written=rows_written, rows_skipped_conflict=rows_skipped_conflict)
