from __future__ import annotations

# ruff: noqa: E402
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_TEST_DB_FILE = f"test_backend_{os.getpid()}.db"
# Ensure DB URL is set before importing app modules that create engine/session.
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///./{_TEST_DB_FILE}"
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_local")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_local")
os.environ.setdefault("STRIPE_PRICE_ID", "price_local")
os.environ.setdefault("STRIPE_SUCCESS_URL", "https://example.com/success")
os.environ.setdefault("STRIPE_CANCEL_URL", "https://example.com/cancel")
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
    db_path = Path(_TEST_DB_FILE)
    if db_path.exists():
        db_path.unlink()
    Base.metadata.create_all(bind=engine)
    reset_state_for_tests()
