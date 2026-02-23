"""Billing route group with public and protected endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import Principal, require_user_or_admin

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans")
def plans() -> dict[str, list[dict[str, str]]]:
    return {"plans": [{"id": "basic", "name": "Basic", "price": "mock"}]}


@router.post("/checkout")
def checkout(_: Principal = Depends(require_user_or_admin)) -> dict[str, str]:
    return {"status": "checkout_started"}


@router.get("/status")
def status_route(_: Principal = Depends(require_user_or_admin)) -> dict[str, str]:
    return {"status": "active"}

