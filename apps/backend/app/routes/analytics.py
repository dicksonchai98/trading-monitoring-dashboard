"""Analytics route group."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import Principal, require_user_or_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/history")
def history(_: Principal = Depends(require_user_or_admin)) -> dict[str, list[dict[str, str]]]:
    return {"items": [{"timestamp": "now", "value": "mock"}]}

