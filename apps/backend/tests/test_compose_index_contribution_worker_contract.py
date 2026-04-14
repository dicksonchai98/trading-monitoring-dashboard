from __future__ import annotations

from pathlib import Path


def test_compose_defines_index_contribution_worker_service() -> None:
    compose_path = Path(__file__).resolve().parents[3] / "docker-compose.yml"
    content = compose_path.read_text(encoding="utf-8")

    assert "backend-index-contribution-worker:" in content
    assert "command: python -m workers.index_contribution_worker" in content
