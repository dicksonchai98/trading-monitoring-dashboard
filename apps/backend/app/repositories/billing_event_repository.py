"""Repository for Stripe webhook billing events."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.billing_event import BillingEventModel
from app.utils.time import utcnow


@dataclass
class BillingEventRecord:
    stripe_event_id: str
    event_type: str
    payload_hash: str
    status: str


class BillingEventRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create_if_absent(self, stripe_event_id: str, event_type: str, payload_hash: str) -> bool:
        with self._session_factory() as session:
            model = BillingEventModel(
                stripe_event_id=stripe_event_id,
                event_type=event_type,
                payload_hash=payload_hash,
                status="processing",
                processed_at=utcnow(),
            )
            session.add(model)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                return False
            return True

    def mark_status(self, stripe_event_id: str, status: str) -> None:
        with self._session_factory() as session:
            model = (
                session.query(BillingEventModel)
                .filter(BillingEventModel.stripe_event_id == stripe_event_id)
                .one_or_none()
            )
            if model is None:
                return
            model.status = status
            model.processed_at = utcnow()
            session.commit()
