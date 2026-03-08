"""Shared Shioaji session factory."""

from __future__ import annotations

from typing import Any

from app.config import SHIOAJI_API_KEY, SHIOAJI_SECRET_KEY, SHIOAJI_SIMULATION
from app.market_ingestion.shioaji_client import ShioajiClient


def build_shioaji_api() -> Any:
    try:
        import shioaji as sj  # type: ignore
    except Exception as err:  # pragma: no cover - depends on runtime dependency
        raise RuntimeError("shioaji dependency unavailable: install shioaji") from err
    return sj.Shioaji(simulation=SHIOAJI_SIMULATION)


def build_shioaji_client() -> ShioajiClient:
    api = build_shioaji_api()
    return ShioajiClient(
        api=api,
        api_key=SHIOAJI_API_KEY,
        secret_key=SHIOAJI_SECRET_KEY,
        simulation=SHIOAJI_SIMULATION,
    )
