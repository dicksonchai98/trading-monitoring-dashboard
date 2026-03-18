from __future__ import annotations

import secrets
import sys
import types

from app.services import shioaji_session


def test_build_shioaji_client_uses_config(monkeypatch) -> None:
    class FakeShioaji:
        def __init__(self, simulation: bool) -> None:
            self.simulation = simulation

    fake_module = types.SimpleNamespace(Shioaji=FakeShioaji)
    secret_value = secrets.token_hex(8)
    monkeypatch.setitem(sys.modules, "shioaji", fake_module)
    monkeypatch.setattr(shioaji_session, "SHIOAJI_API_KEY", "k")
    monkeypatch.setattr(shioaji_session, "SHIOAJI_SECRET_KEY", secret_value)
    monkeypatch.setattr(shioaji_session, "SHIOAJI_SIMULATION", False)

    client = shioaji_session.build_shioaji_client()

    assert isinstance(client.api, FakeShioaji)
    assert client.api.simulation is False
    assert client._api_key == "k"
    assert client._secret_key == secret_value
    assert client._simulation is False
