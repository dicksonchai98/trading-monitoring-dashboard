from __future__ import annotations

import importlib

import app.config as config


def test_ingestor_and_shioaji_defaults(monkeypatch) -> None:
    monkeypatch.delenv("INGESTOR_ENABLED", raising=False)
    monkeypatch.delenv("INGESTOR_ENV", raising=False)
    monkeypatch.delenv("INGESTOR_QUOTE_TYPES", raising=False)
    reloaded = importlib.reload(config)
    assert reloaded.INGESTOR_ENABLED is False
    assert reloaded.INGESTOR_ENV in {"dev", "prod"}
    assert reloaded.INGESTOR_QUOTE_TYPES == ["tick", "bidask"]
