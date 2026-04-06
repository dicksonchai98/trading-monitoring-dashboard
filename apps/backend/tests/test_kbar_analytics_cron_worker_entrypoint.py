from __future__ import annotations

from datetime import date

from workers import kbar_analytics_cron_worker


def test_run_once_invokes_daily_pipeline(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_run_daily_pipeline_once(**kwargs):
        captured.update(kwargs)
        return {"jobs": 3}

    monkeypatch.setattr(
        kbar_analytics_cron_worker, "run_daily_pipeline_once", _fake_run_daily_pipeline_once
    )
    result = kbar_analytics_cron_worker.run_once()

    assert result == {"jobs": 3}
    assert captured["code"] == kbar_analytics_cron_worker.KBAR_ANALYTICS_CRON_CODE
    assert captured["window_days"] == kbar_analytics_cron_worker.KBAR_ANALYTICS_CRON_WINDOW_DAYS


def test_main_once_runs_single_cycle(monkeypatch) -> None:
    called = {"count": 0}

    def _fake_run_once():
        called["count"] += 1
        return {"jobs": 3}

    monkeypatch.setattr(kbar_analytics_cron_worker, "run_once", _fake_run_once)
    monkeypatch.setattr(kbar_analytics_cron_worker, "KBAR_ANALYTICS_CRON_ENABLED", False)
    monkeypatch.setattr("sys.argv", ["kbar_analytics_cron_worker.py", "--once"])

    kbar_analytics_cron_worker.main()

    assert called["count"] == 1


def test_cron_helper_window_uses_inclusive_range(monkeypatch) -> None:
    from app.modules.kbar_analytics import cron as cron_module

    class _FakeService:
        def __init__(self, session):
            _ = session

        def run_daily_pipeline(self, *, code: str, start_date: date, end_date: date):
            return {
                "code": code,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            }

    class _SessionCtx:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            _ = (exc_type, exc, tb)

        def commit(self) -> None:
            return None

    monkeypatch.setattr(cron_module, "KbarAnalyticsService", _FakeService)

    result = cron_module.run_daily_pipeline_once(
        session_factory=lambda: _SessionCtx(),
        code="TXF",
        window_days=3,
        today_provider=lambda: date(2026, 4, 6),
    )

    assert result["start_date"] == "2026-04-04"
    assert result["end_date"] == "2026-04-06"
