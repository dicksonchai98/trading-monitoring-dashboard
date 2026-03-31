"""Repository for subscription records."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.subscription import SubscriptionModel
from app.utils.time import ensure_utc


@dataclass
class SubscriptionRecord:
    id: str
    user_id: str
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    stripe_price_id: str | None
    current_period_end: datetime | None
    status: str
    entitlement_active: bool


class SubscriptionRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_by_user_id(self, user_id: str) -> SubscriptionRecord | None:
        with self._session_factory() as session:
            stmt = select(SubscriptionModel).where(SubscriptionModel.user_id == user_id)
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                return None
            return self._to_record(model)

    def get_by_stripe_subscription_id(
        self, stripe_subscription_id: str
    ) -> SubscriptionRecord | None:
        with self._session_factory() as session:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.stripe_subscription_id == stripe_subscription_id
            )
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                return None
            return self._to_record(model)

    def get_by_stripe_customer_id(self, stripe_customer_id: str) -> SubscriptionRecord | None:
        with self._session_factory() as session:
            stmt = select(SubscriptionModel).where(
                SubscriptionModel.stripe_customer_id == stripe_customer_id
            )
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                return None
            return self._to_record(model)

    def upsert_for_user(
        self,
        user_id: str,
        *,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        stripe_price_id: str | None = None,
        current_period_end: datetime | None = None,
        status: str,
        entitlement_active: bool,
    ) -> SubscriptionRecord:
        with self._session_factory() as session:
            stmt = select(SubscriptionModel).where(SubscriptionModel.user_id == user_id)
            model = session.execute(stmt).scalar_one_or_none()
            if model is None:
                model = SubscriptionModel(
                    user_id=user_id,
                    stripe_customer_id=stripe_customer_id,
                    stripe_subscription_id=stripe_subscription_id,
                    stripe_price_id=stripe_price_id,
                    current_period_end=(
                        ensure_utc(current_period_end) if current_period_end is not None else None
                    ),
                    status=status,
                    entitlement_active=entitlement_active,
                )
                session.add(model)
            else:
                if stripe_customer_id is not None:
                    model.stripe_customer_id = stripe_customer_id
                if stripe_subscription_id is not None:
                    model.stripe_subscription_id = stripe_subscription_id
                if stripe_price_id is not None:
                    model.stripe_price_id = stripe_price_id
                model.current_period_end = (
                    ensure_utc(current_period_end) if current_period_end is not None else None
                )
                model.status = status
                model.entitlement_active = entitlement_active
            session.commit()
            session.refresh(model)
            return self._to_record(model)

    @staticmethod
    def _to_record(model: SubscriptionModel) -> SubscriptionRecord:
        return SubscriptionRecord(
            id=model.id,
            user_id=model.user_id,
            stripe_customer_id=model.stripe_customer_id,
            stripe_subscription_id=model.stripe_subscription_id,
            stripe_price_id=model.stripe_price_id,
            current_period_end=(
                ensure_utc(model.current_period_end)
                if model.current_period_end is not None
                else None
            ),
            status=model.status,
            entitlement_active=model.entitlement_active,
        )
