from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def build_client() -> TestClient:
    return TestClient(app)

