from __future__ import annotations

from pathlib import Path


def test_compose_defines_split_api_and_stream_worker_services() -> None:
    compose_path = Path(__file__).resolve().parents[3] / "docker-compose.yml"
    content = compose_path.read_text(encoding="utf-8")

    assert "backend-api:" in content
    assert "backend-stream-worker:" in content
    assert "backend-tick-worker:" in content
    assert "backend-bidask-worker:" in content
    assert "backend-latest-state-worker:" in content
    assert "backend-index-contribution-worker:" in content
    assert "backend-market-summary-worker:" in content
    assert "backend-otc-summary-worker:" in content
    assert "command: uvicorn app.main:app --host 0.0.0.0 --port 8000" in content
    assert "command: python -m workers.stream_processing_worker" in content
    assert "command: python -m workers.stream_processing_tick_worker" in content
    assert "command: python -m workers.stream_processing_bidask_worker" in content
    assert "command: python -m workers.latest_state_worker" in content
    assert "command: python -m workers.index_contribution_worker" in content
    assert "command: python -m workers.market_summary_worker" in content
    assert "command: python -m workers.otc_summary_worker" in content
    assert 'AGGREGATOR_ENABLED: "false"' in content
