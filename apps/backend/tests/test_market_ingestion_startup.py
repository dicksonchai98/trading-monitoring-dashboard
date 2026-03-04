from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient


def test_metrics_include_ingestor_gap_signals() -> None:
    client = TestClient(app)
    counters = client.get("/metrics").json()["counters"]
    assert "events_dropped_total" in counters
    assert "ingest_lag_ms" in counters
    assert "ws_reconnect_count" in counters
