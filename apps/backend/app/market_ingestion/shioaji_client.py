"""Shioaji API wrapper for login/logout and callback registration."""

from __future__ import annotations

from typing import Any, Callable


class ShioajiClient:
    def __init__(self, api: Any, api_key: str, secret_key: str, simulation: bool = True) -> None:
        self._api = api
        self._api_key = api_key
        self._secret_key = secret_key
        self._simulation = simulation

    @property
    def api(self) -> Any:
        return self._api

    def login(self) -> Any:
        return self._api.login(
            api_key=self._api_key,
            secret_key=self._secret_key,
            fetch_contract=False,
        )

    def fetch_contracts(self) -> Any:
        if hasattr(self._api, "fetch_contracts"):
            return self._api.fetch_contracts(contract_download=True)
        return None

    def logout(self) -> Any:
        return self._api.logout()

    def set_on_tick_fop_v1_callback(self, callback: Callable[..., Any]) -> None:
        self._api.quote.set_on_tick_fop_v1_callback(callback)

    def set_on_bidask_fop_v1_callback(self, callback: Callable[..., Any]) -> None:
        self._api.quote.set_on_bidask_fop_v1_callback(callback)

    def set_on_event_callback(self, callback: Callable[..., Any]) -> None:
        self._api.quote.on_event(callback)
