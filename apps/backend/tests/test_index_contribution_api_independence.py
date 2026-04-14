from __future__ import annotations

from pathlib import Path


def test_index_contribution_worker_has_no_http_route_module() -> None:
    routes_dir = Path(__file__).resolve().parents[1] / "app" / "routes"
    route_files = [path.name for path in routes_dir.glob("*.py")]
    assert "index_contribution.py" not in route_files
