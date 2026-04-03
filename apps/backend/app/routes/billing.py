"""Billing route group with public and protected endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_stripe_settings
from app.db.session import SessionLocal
from app.deps import Principal, require_user_or_admin
from app.models.billing_plan import BillingPlanModel
from app.services.billing_service import BillingError
from app.state import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    price_id: str | None = None


def _plan_price_text(amount: int | None, currency: str, interval: str) -> str:
    if amount is None:
        return "configured"
    if amount <= 0:
        return "free"
    normalized = amount / 100
    return f"{normalized:.2f} {currency.upper()}/{interval}"


@router.get("/plans")
def plans() -> dict[str, list[dict[str, str]]]:
    settings = get_stripe_settings()
    configured_plans: list[BillingPlanModel] = []

    try:
        with SessionLocal() as session:
            configured_plans = list(
                session.execute(
                    select(BillingPlanModel)
                    .where(BillingPlanModel.is_active.is_(True))
                    .order_by(BillingPlanModel.sort_order.asc())
                ).scalars()
            )
    except SQLAlchemyError:
        configured_plans = []

    if not configured_plans:
        configured_plans = [
            BillingPlanModel(id="free", name="Free", is_active=True, sort_order=0),
            BillingPlanModel(id="basic", name=settings.plan_name or "Basic", is_active=True, sort_order=1),
        ]

    response_plans: list[dict[str, str]] = []
    for plan in configured_plans:
        if plan.id == "free":
            response_plans.append(
                {
                    "id": "free",
                    "name": plan.name,
                    "price": "free",
                    "price_id": "",
                    "amount": "0",
                    "currency": settings.price_currency,
                    "interval": settings.price_interval,
                }
            )
            continue

        if plan.id == "basic":
            response_plans.append(
                {
                    "id": "basic",
                    "name": plan.name,
                    "price": _plan_price_text(
                        settings.price_amount, settings.price_currency, settings.price_interval
                    ),
                    "price_id": settings.price_id,
                    "amount": str(settings.price_amount) if settings.price_amount is not None else "",
                    "currency": settings.price_currency,
                    "interval": settings.price_interval,
                }
            )

    return {"plans": response_plans}


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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err.code,
            ) from err
        if err.code == "user_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err.code,
            ) from err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing_error",
        ) from err
    return {"checkout_url": result.checkout_url, "session_id": result.session_id}


@router.get("/status")
def status_route(
    principal: Principal = Depends(require_user_or_admin),
) -> dict[str, str | bool | None]:
    try:
        return billing_service.get_status(username=principal.username)
    except BillingError as err:
        if err.code == "user_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err.code,
            ) from err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing_error",
        ) from err


@router.post("/portal-session")
def portal_session(principal: Principal = Depends(require_user_or_admin)) -> dict[str, str]:
    try:
        session = billing_service.create_portal_session(username=principal.username)
    except BillingError as err:
        if err.code == "stripe_customer_not_found":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err.code,
            ) from err
        if err.code == "user_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err.code,
            ) from err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing_error",
        ) from err
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err.code,
            ) from err
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing_error",
        ) from err
    return {"status": result}
