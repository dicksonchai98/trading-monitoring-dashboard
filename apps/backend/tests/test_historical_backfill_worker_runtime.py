from __future__ import annotations

import pytest
from app.modules.historical_backfill.logging import redact_secrets


def test_legacy_runtime_removed() -> None:
    with pytest.raises(ImportError):
        import app.modules.historical_backfill.worker  # noqa: F401


def test_redact_secrets_removes_shioaji_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.modules.historical_backfill.logging.SHIOAJI_API_KEY",
        "api-secret",
    )
    monkeypatch.setattr(
        "app.modules.historical_backfill.logging.SHIOAJI_SECRET_KEY", "secret-secret"
    )
    message = "failed login api-secret and secret-secret"
    assert redact_secrets(message) == "failed login *** and ***"
