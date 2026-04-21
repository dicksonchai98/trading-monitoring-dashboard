from __future__ import annotations

# ruff: noqa: E402
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_TEST_DB_FILE = f"test_backend_{os.getpid()}.db"
# Ensure DB URL is set before importing app modules that create engine/session.
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///./{_TEST_DB_FILE}"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_local"  # noqa: S105 - test credential only
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_local"  # noqa: S105 - test credential only
os.environ["STRIPE_PRICE_ID"] = "price_local"
os.environ["STRIPE_SUCCESS_URL"] = "https://example.com/success"
os.environ["STRIPE_CANCEL_URL"] = "https://example.com/cancel"
os.environ["OTP_FIXED_CODE_FOR_TESTS"] = "123456"
os.environ["INGESTOR_CODE"] = "MTX"
os.environ["SENDGRID_API_KEY"] = ""
os.environ["SENDGRID_OTP_TEMPLATE_ID"] = "otp_verification"
os.environ["SENDGRID_WEBHOOK_SIGNING_KEY"] = "test-sendgrid-signing-key"
os.environ["SERVING_SSE_INCLUDE_QUOTE"] = "1"
os.environ["SERVING_POLL_INTERVAL_MS"] = "50"

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
