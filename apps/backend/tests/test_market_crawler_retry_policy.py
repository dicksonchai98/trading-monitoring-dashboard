from __future__ import annotations

from datetime import date, datetime

from app.modules.batch_data.market_crawler.jobs.single_date_job import (
    DEFAULT_PUBLICATION_POLICY,
    _should_retry,
)
from zoneinfo import ZoneInfo


def test_retry_policy_allows_publication_window_for_scheduled() -> None:
    target_date = date(2026, 3, 9)
    now = datetime(2026, 3, 9, 14, 0, tzinfo=ZoneInfo("Asia/Taipei"))
    ok = _should_retry(
        category="publication_not_ready",
        attempt=1,
        max_attempts=3,
        trigger_type="scheduled",
        target_date=target_date,
        publication_policy=DEFAULT_PUBLICATION_POLICY,
        now=now,
    )
    assert ok is True


def test_retry_policy_denies_publication_retry_for_manual() -> None:
    target_date = date(2026, 3, 9)
    now = datetime(2026, 3, 9, 14, 0, tzinfo=ZoneInfo("Asia/Taipei"))
    ok = _should_retry(
        category="publication_not_ready",
        attempt=1,
        max_attempts=3,
        trigger_type="manual",
        target_date=target_date,
        publication_policy=DEFAULT_PUBLICATION_POLICY,
        now=now,
    )
    assert ok is False


def test_retry_policy_honors_attempt_limit() -> None:
    ok = _should_retry(
        category="network_error",
        attempt=3,
        max_attempts=3,
        trigger_type="manual",
        target_date=date(2026, 3, 9),
        publication_policy=DEFAULT_PUBLICATION_POLICY,
        now=datetime(2026, 3, 9, 14, 0, tzinfo=ZoneInfo("Asia/Taipei")),
    )
    assert ok is False
