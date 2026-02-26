"""Billing route group with public and protected endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.deps import Principal, require_user_or_admin
from app.services.billing_service import BillingError
from app.state import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    price_id: str | None = None


@router.get("/plans")
def plans() -> dict[str, list[dict[str, str]]]:
    return {"plans": [{"id": "basic", "name": "Basic", "price": "stripe-configured"}]}


@router.post("/checkout")
def checkout(
    payload: CheckoutRequest | None = None,
    principal: Principal = Depends(require_user_or_admin),
) -> dict[str, str]:
    try:
        result = billing_service.create_checkout_session(
            username=principal.username, requested_price_id=(payload.price_id if payload else None)
        )
    except BillingError as err:
        if err.code == "invalid_price_id":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.code)
        if err.code == "user_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err.code)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="billing_error")
    return {"checkout_url": result.checkout_url, "session_id": result.session_id}


@router.get("/status")
def status_route(principal: Principal = Depends(require_user_or_admin)) -> dict[str, str | bool | None]:
    try:
        return billing_service.get_status(username=principal.username)
    except BillingError as err:
        if err.code == "user_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err.code)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="billing_error")


@router.post("/portal-session")
def portal_session(principal: Principal = Depends(require_user_or_admin)) -> dict[str, str]:
    try:
        session = billing_service.create_portal_session(username=principal.username)
    except BillingError as err:
        if err.code == "stripe_customer_not_found":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code)
        if err.code == "user_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err.code)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="billing_error")
    return {"portal_url": session.portal_url}


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, str]:
    payload = await request.body()
    try:
        result = billing_service.process_webhook(payload=payload, signature=stripe_signature)
    except BillingError as err:
        if err.code in {"invalid_signature", "invalid_event"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.code)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="billing_error")
    return {"status": result}
