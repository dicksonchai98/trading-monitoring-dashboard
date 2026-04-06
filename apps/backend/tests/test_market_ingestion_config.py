from __future__ import annotations

import importlib

import app.config as config


def test_ingestor_and_shioaji_defaults(monkeypatch) -> None:
    monkeypatch.delenv("INGESTOR_ENABLED", raising=False)
    monkeypatch.delenv("INGESTOR_ENV", raising=False)
    monkeypatch.delenv("INGESTOR_QUOTE_TYPES", raising=False)
    monkeypatch.delenv("INGESTOR_SPOT_SYMBOLS_FILE", raising=False)
    monkeypatch.delenv("INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT", raising=False)
    monkeypatch.delenv("INGESTOR_SPOT_REQUIRED", raising=False)
    monkeypatch.delenv("AGGREGATOR_ENABLED", raising=False)
    monkeypatch.delenv("AGGREGATOR_ENV", raising=False)
    monkeypatch.delenv("AGGREGATOR_SERIES_FIELDS", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_ENABLED", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_TARGET_CODE", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_GROUP", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_CONSUMER_NAME", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_STREAM_MAXLEN", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_DB_FLUSH_ENABLED", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_REDIS_RETRY_ATTEMPTS", raising=False)
    monkeypatch.delenv("QUOTE_WORKER_REDIS_RETRY_BACKOFF_MS", raising=False)
    reloaded = importlib.reload(config)
    assert reloaded.INGESTOR_ENABLED is False
    assert reloaded.INGESTOR_ENV in {"dev", "prod"}
    assert reloaded.INGESTOR_QUOTE_TYPES == ["tick", "bidask", "quote"]
    assert reloaded.INGESTOR_SPOT_SYMBOLS_FILE.endswith("infra/config/stock150.txt")
    assert reloaded.INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT == 150
    assert reloaded.INGESTOR_SPOT_REQUIRED is False
    assert reloaded.AGGREGATOR_ENABLED is False
    assert reloaded.AGGREGATOR_ENV in {"dev", "prod"}
    assert "delta_1s" in reloaded.AGGREGATOR_SERIES_FIELDS
    assert reloaded.QUOTE_WORKER_ENABLED is False
    assert reloaded.QUOTE_WORKER_TARGET_CODE == reloaded.INGESTOR_CODE
    assert reloaded.QUOTE_WORKER_GROUP == "agg:quote"
    assert reloaded.QUOTE_WORKER_CONSUMER_NAME == "quote-worker-1"
    assert reloaded.QUOTE_WORKER_STREAM_MAXLEN == 100000
    assert reloaded.QUOTE_WORKER_DB_FLUSH_ENABLED is True
    assert reloaded.QUOTE_WORKER_REDIS_RETRY_ATTEMPTS == 3
    assert reloaded.QUOTE_WORKER_REDIS_RETRY_BACKOFF_MS == 200
