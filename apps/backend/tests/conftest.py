from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure DB URL is set before importing app modules that create engine/session.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///./test_backend.db"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_local"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_local"
os.environ["STRIPE_PRICE_ID"] = "price_local"
os.environ["STRIPE_SUCCESS_URL"] = "https://example.com/success"
os.environ["STRIPE_CANCEL_URL"] = "https://example.com/cancel"
os.environ.setdefault("OTP_FIXED_CODE_FOR_TESTS", "123456")
os.environ.setdefault("SENDGRID_WEBHOOK_SIGNING_KEY", "test-sendgrid-signing-key")

from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.state import reset_state_for_tests


def build_client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _reset_state_between_tests() -> None:
    engine.dispose()
    db_path = Path("test_backend.db")
    if db_path.exists():
        db_path.unlink()
    Base.metadata.create_all(bind=engine)
    reset_state_for_tests()
