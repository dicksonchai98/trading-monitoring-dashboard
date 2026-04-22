from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.db.session import get_session
from app.main import app
from app.models.kbar_1m import Kbar1mModel
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _register_and_login(client: TestClient, username: str, password: str) -> dict[str, str]:
    send_res = client.post("/auth/email/send-otp", json={"email": username})
    assert send_res.status_code == 202
    verify_res = client.post(
        "/auth/email/verify-otp", json={"email": username, "otp_code": "123456"}
    )
    assert verify_res.status_code == 200
    register_res = client.post(
        "/auth/register",
        json={
            "username": username,
            "password": password,
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert register_res.status_code == 200
    login_res = client.post("/auth/login", json={"username": username, "password": password})
    assert login_res.status_code == 200
    return {"access_token": login_res.json()["access_token"]}


def _seed_kbars(session: Session, code: str = "TXF") -> None:
    base_dt = datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc)
    rows: list[Kbar1mModel] = []
    day_bases = [1000.0, 1140.0, 1010.0, 1210.0]
    for day_offset, open_value in enumerate(day_bases):
        trade_date = date(2026, 4, 1) + timedelta(days=day_offset)
        rows.extend(
            [
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=base_dt + timedelta(days=day_offset, minutes=0),
                    open=open_value,
                    high=open_value + 10,
                    low=open_value - 10,
                    close=open_value + 2,
                    volume=10,
                ),
                Kbar1mModel(
                    code=code,
                    trade_date=trade_date,
                    minute_ts=base_dt + timedelta(days=day_offset, minutes=1),
                    open=open_value + 2,
                    high=open_value + 180,
                    low=open_value - 20,
                    close=open_value + 150,
                    volume=20,
                ),
            ]
        )
    session.add_all(rows)
    session.commit()


def test_kbar_analytics_endpoints_and_jobs_flow() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, "kbar-user@example.com", "PassKbar123")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    with get_session() as session:
        _seed_kbars(session)

    events_res = client.get("/analytics/events", headers=headers)
    assert events_res.status_code == 200
    assert any(item["event_id"] == "day_up_gt_100" for item in events_res.json()["items"])

    metrics_res = client.get("/analytics/metrics", headers=headers)
    assert metrics_res.status_code == 200
    assert any(item["metric_id"] == "day_return" for item in metrics_res.json()["items"])

    rebuild_res = client.post(
        "/analytics/jobs/rebuild-daily-features",
        json={"code": "TXF", "start_date": "2026-04-01", "end_date": "2026-04-04"},
        headers=headers,
    )
    assert rebuild_res.status_code == 202
    assert rebuild_res.json()["status"] == "success"

    event_job_res = client.post(
        "/analytics/jobs/recompute-event-stats",
        json={
            "code": "TXF",
            "start_date": "2026-04-01",
            "end_date": "2026-04-04",
            "event_ids": ["day_up_gt_100"],
        },
        headers=headers,
    )
    assert event_job_res.status_code == 202

    distribution_job_res = client.post(
        "/analytics/jobs/recompute-distribution-stats",
        json={
            "code": "TXF",
            "start_date": "2026-04-01",
            "end_date": "2026-04-04",
            "metric_ids": ["day_return"],
        },
        headers=headers,
    )
    assert distribution_job_res.status_code == 202

    distribution_job_without_dates_res = client.post(
        "/analytics/jobs/recompute-distribution-stats",
        json={
            "code": "TXF",
            "metric_ids": ["day_return"],
        },
        headers=headers,
    )
    assert distribution_job_without_dates_res.status_code == 202

    stats_res = client.get(
        "/analytics/events/day_up_gt_100/stats",
        params={
            "code": "TXF",
            "start_date": "2026-04-01",
            "end_date": "2026-04-04",
            "version": "latest",
        },
        headers=headers,
    )
    assert stats_res.status_code == 200
    assert stats_res.json()["sample_count"] >= 1

    latest_event_stats_without_dates_res = client.get(
        "/analytics/events/day_up_gt_100/stats",
        params={
            "code": "TXF",
            "version": "latest",
        },
        headers=headers,
    )
    assert latest_event_stats_without_dates_res.status_code == 200
    assert latest_event_stats_without_dates_res.json()["event_id"] == "day_up_gt_100"

    all_stats_res = client.get(
        "/analytics/events/all/stats",
        params={
            "code": "TXF",
            "version": "latest",
        },
        headers=headers,
    )
    assert all_stats_res.status_code == 200
    assert isinstance(all_stats_res.json()["items"], list)
    assert any(item["event_id"] == "day_up_gt_100" for item in all_stats_res.json()["items"])

    samples_res = client.get(
        "/analytics/events/day_up_gt_100/samples",
        params={
            "code": "TXF",
            "start_date": "2026-04-01",
            "end_date": "2026-04-04",
            "page": 1,
            "page_size": 10,
            "sort": "-trade_date",
        },
        headers=headers,
    )
    assert samples_res.status_code == 200
    assert samples_res.json()["pagination"]["total"] >= 1

    distribution_res = client.get(
        "/analytics/distributions/day_return",
        params={
            "code": "TXF",
            "start_date": "2026-04-01",
            "end_date": "2026-04-04",
            "version": "latest",
        },
        headers=headers,
    )
    assert distribution_res.status_code == 200
    assert distribution_res.json()["sample_count"] >= 1


def test_kbar_analytics_rejects_unknown_registry_ids() -> None:
    client = TestClient(app)
    auth = _register_and_login(client, "kbar-user2@example.com", "PassKbar234")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    stats_res = client.get(
        "/analytics/events/not-exist/stats",
        params={"code": "TXF", "start_date": "2026-04-01", "end_date": "2026-04-04"},
        headers=headers,
    )
    assert stats_res.status_code == 404

    missing_date_res = client.get(
        "/analytics/events/day_up_gt_100/stats",
        params={"code": "TXF"},
        headers=headers,
    )
    assert missing_date_res.status_code == 404

    dist_res = client.get(
        "/analytics/distributions/not-exist",
        params={"code": "TXF", "start_date": "2026-04-01", "end_date": "2026-04-04"},
        headers=headers,
    )
    assert dist_res.status_code == 404
