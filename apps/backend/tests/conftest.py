from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Ensure DB URL is set before importing app modules that create engine/session.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./test_backend.db")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_local")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_local")
os.environ.setdefault("STRIPE_PRICE_ID", "price_local")
os.environ.setdefault("STRIPE_SUCCESS_URL", "https://example.com/success")
os.environ.setdefault("STRIPE_CANCEL_URL", "https://example.com/cancel")

from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.state import reset_state_for_tests


def build_client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _reset_state_between_tests() -> None:
    Base.metadata.create_all(bind=engine)
    reset_state_for_tests()
