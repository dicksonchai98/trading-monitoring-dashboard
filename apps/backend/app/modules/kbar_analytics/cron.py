"""Scheduled execution helpers for k-bar analytics pipeline."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.modules.kbar_analytics.service import KbarAnalyticsService


def _utc_today() -> date:
    return datetime.now(tz=timezone.utc).date()


def run_daily_pipeline_once(
    *,
    session_factory: Callable[[], Session],
    code: str,
    window_days: int,
    today_provider: Callable[[], date] = _utc_today,
) -> dict[str, dict[str, int] | int]:
    end_date = today_provider()
    start_date = end_date - timedelta(days=max(1, window_days) - 1)
    with session_factory() as session:
        service = KbarAnalyticsService(session)
        result = service.run_daily_pipeline(code=code, start_date=start_date, end_date=end_date)
        session.commit()
        return result
