"""Quote feature minute snapshots."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class QuoteFeature1mModel(Base):
    __tablename__ = "quote_features_1m"
    __table_args__ = (
        UniqueConstraint("code", "minute_ts", name="uq_quote_features_1m_code_minute_ts"),
        Index("ix_quote_features_1m_code_trade_date", "code", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minute_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    main_chip: Mapped[float] = mapped_column(Float, nullable=False)
    main_chip_day_high: Mapped[float] = mapped_column(Float, nullable=False)
    main_chip_day_low: Mapped[float] = mapped_column(Float, nullable=False)
    main_chip_strength: Mapped[float] = mapped_column(Float, nullable=False)
    long_short_force: Mapped[float] = mapped_column(Float, nullable=False)
    long_short_force_day_high: Mapped[float] = mapped_column(Float, nullable=False)
    long_short_force_day_low: Mapped[float] = mapped_column(Float, nullable=False)
    long_short_force_strength: Mapped[float] = mapped_column(Float, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
