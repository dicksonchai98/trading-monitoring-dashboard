from __future__ import annotations

import asyncio

from app import main


def test_startup_does_not_boot_aggregator(monkeypatch) -> None:
    monkeypatch.setattr(main, "validate_stripe_settings", lambda: None)
    monkeypatch.setattr(main, "INGESTOR_ENABLED", False)

    called = {"aggregator": 0}

    def _forbidden_call():
        called["aggregator"] += 1
        raise AssertionError("aggregator must not start in API process")

    monkeypatch.setattr(main.state, "build_aggregator_runner", _forbidden_call)

    asyncio.run(main.validate_billing_configuration())
    assert called["aggregator"] == 0
