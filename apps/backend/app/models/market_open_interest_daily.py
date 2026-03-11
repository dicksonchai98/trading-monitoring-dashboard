"""MVP normalized table for market crawler open-interest records."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class MarketOpenInterestDailyModel(Base):
    __tablename__ = "market_open_interest_daily"
    __table_args__ = (
        UniqueConstraint(
            "data_date",
            "market_code",
            "instrument_code",
            "entity_code",
            "source",
            name="uq_market_open_interest_daily_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    data_date: Mapped[date] = mapped_column(Date, nullable=False)
    market_code: Mapped[str] = mapped_column(String(32), nullable=False)
    instrument_code: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_code: Mapped[str] = mapped_column(String(32), nullable=False)
    long_trade_oi: Mapped[int] = mapped_column(Integer, nullable=False)
    short_trade_oi: Mapped[int] = mapped_column(Integer, nullable=False)
    net_trade_oi: Mapped[int] = mapped_column(Integer, nullable=False)
    long_trade_amount_k: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    short_trade_amount_k: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    net_trade_amount_k: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    long_open_interest: Mapped[int] = mapped_column(Integer, nullable=False)
    short_open_interest: Mapped[int] = mapped_column(Integer, nullable=False)
    net_open_interest: Mapped[int] = mapped_column(Integer, nullable=False)
    long_open_interest_amount_k: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    short_open_interest_amount_k: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    net_open_interest_amount_k: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    parser_version: Mapped[str] = mapped_column(String(32), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
