"""Billing service for Stripe-backed subscription lifecycle."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.config import StripeSettings
from app.repositories.billing_event_repository import BillingEventRepository
from app.repositories.subscription_repository import SubscriptionRecord, SubscriptionRepository
from app.repositories.user_repository import UserRecord, UserRepository
from app.services.audit import AuditLog
from app.services.stripe_provider import StripeProvider
from app.utils.time import ensure_utc


class BillingError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass
class CheckoutResponse:
    checkout_url: str
    session_id: str


@dataclass
class PortalResponse:
    portal_url: str


class BillingService:
    def __init__(
        self,
        *,
        settings: StripeSettings,
        user_repository: UserRepository,
        subscription_repository: SubscriptionRepository,
        billing_event_repository: BillingEventRepository,
        audit_log: AuditLog,
        stripe_provider: StripeProvider,
    ) -> None:
        self._settings = settings
        self._users = user_repository
        self._subscriptions = subscription_repository
        self._events = billing_event_repository
        self._audit_log = audit_log
        self._stripe = stripe_provider

    def create_checkout_session(
        self, *, username: str, requested_price_id: str | None
    ) -> CheckoutResponse:
        user = self._users.get_by_username(username)
        if user is None:
            raise BillingError("user_not_found")
        if requested_price_id and requested_price_id != self._settings.price_id:
            raise BillingError("invalid_price_id")
        customer_id = self._ensure_customer(user)
        current = self._subscriptions.get_by_user_id(user.id)
        preserve_active = (
            current is not None and current.status == "active" and current.entitlement_active
        )
        self._subscriptions.upsert_for_user(
            user.id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=current.stripe_subscription_id if current else None,
            stripe_price_id=self._settings.price_id,
            current_period_end=current.current_period_end if preserve_active and current else None,
            status="active" if preserve_active else "pending",
            entitlement_active=preserve_active,
        )
        session = self._stripe.create_checkout_session(
            customer_id=customer_id,
            price_id=self._settings.price_id,
            success_url=self._settings.success_url,
            cancel_url=self._settings.cancel_url,
            user_id=user.id,
        )
        return CheckoutResponse(checkout_url=session.checkout_url, session_id=session.session_id)

    def create_portal_session(self, *, username: str) -> PortalResponse:
        user = self._users.get_by_username(username)
        if user is None:
            raise BillingError("user_not_found")
        if not user.stripe_customer_id:
            raise BillingError("stripe_customer_not_found")
        session = self._stripe.create_portal_session(
            customer_id=user.stripe_customer_id, return_url=self._settings.portal_return_url
        )
        return PortalResponse(portal_url=session.portal_url)

    def get_status(self, *, username: str) -> dict[str, Any]:
        user = self._users.get_by_username(username)
        if user is None:
            raise BillingError("user_not_found")
        subscription = self._subscriptions.get_by_user_id(user.id)
        if subscription is None:
            return {
                "status": "none",
                "stripe_price_id": None,
                "current_period_end": None,
                "entitlement_active": False,
            }
        return {
            "status": subscription.status,
            "stripe_price_id": subscription.stripe_price_id,
            "current_period_end": ensure_utc(subscription.current_period_end).isoformat()
            if subscription.current_period_end
            else None,
            "entitlement_active": subscription.entitlement_active,
        }

    def process_webhook(self, *, payload: bytes, signature: str | None) -> str:
        if not signature:
            raise BillingError("invalid_signature")
        try:
            event = self._stripe.construct_event(
                payload=payload,
                signature=signature,
                webhook_secret=self._settings.webhook_secret,
            )
        except Exception as exc:
            raise BillingError("invalid_signature") from exc

        event_id = str(event.get("id", ""))
        event_type = str(event.get("type", ""))
        if not event_id or not event_type:
            raise BillingError("invalid_event")

        payload_hash = hashlib.sha256(payload).hexdigest()
        created = self._events.create_if_absent(event_id, event_type, payload_hash)
        if created == "duplicate_conflict":
            raise BillingError("invalid_event")
        if created == "duplicate_same_payload":
            return "ignored"

        try:
            applied = self._apply_lifecycle_event(event)
            self._events.mark_status(event_id, "processed" if applied else "ignored")
            return "processed" if applied else "ignored"
        except Exception:
            self._events.mark_status(event_id, "failed")
            raise

    def _ensure_customer(self, user: UserRecord) -> str:
        if user.stripe_customer_id:
            return user.stripe_customer_id
        customer_id = self._stripe.create_customer(username=user.username)
        updated = self._users.set_stripe_customer_id(user.id, customer_id)
        return str(updated.stripe_customer_id)

    def _apply_lifecycle_event(self, event: dict[str, Any]) -> bool:
        event_type = str(event["type"])
        data = dict(event.get("data", {}))
        obj = dict(data.get("object", {}))

        if event_type == "checkout.session.completed":
            return self._handle_checkout_completed(obj)
        if event_type == "invoice.paid":
            return self._handle_invoice_state(obj, next_status="active")
        if event_type == "invoice.payment_failed":
            return self._handle_invoice_state(obj, next_status="past_due")
        if event_type == "customer.subscription.deleted":
            return self._handle_subscription_deleted(obj)
        if event_type == "customer.subscription.updated":
            return self._handle_subscription_updated(obj)
        if event_type == "checkout.session.expired":
            return self._handle_checkout_expired(obj)
        return False

    def _handle_checkout_completed(self, obj: dict[str, Any]) -> bool:
        metadata = obj.get("metadata") or {}
        user_id = str(metadata.get("user_id", ""))
        customer_id = str(obj.get("customer", ""))
        subscription_id = str(obj.get("subscription", ""))
        if not user_id:
            if not customer_id:
                return False
            user = self._users.get_by_stripe_customer_id(customer_id)
            if user is None:
                return False
            user_id = user.id
        user = self._users.get_by_id(user_id)
        if user is None:
            return False
        current = self._subscriptions.get_by_user_id(user.id)
        if not self._can_transition(current, "active"):
            return False
        period_end = self._extract_period_end(obj)
        if period_end is None and subscription_id:
            period_end = self._retrieve_subscription_period_end(subscription_id)
        self._subscriptions.upsert_for_user(
            user.id,
            stripe_customer_id=customer_id or user.stripe_customer_id,
            stripe_subscription_id=subscription_id or None,
            stripe_price_id=self._settings.price_id,
            current_period_end=period_end,
            status="active",
            entitlement_active=True,
        )
        self._audit_log.record(
            event_type="subscription_status_changed",
            path="/billing/webhooks/stripe",
            actor=user.username,
            role=user.role,
        )
        return True

    def _handle_invoice_state(self, obj: dict[str, Any], *, next_status: str) -> bool:
        subscription_id = str(obj.get("subscription", ""))
        if not subscription_id:
            return False
        subscription = self._subscriptions.get_by_stripe_subscription_id(subscription_id)
        if subscription is None:
            return False
        if not self._can_transition(subscription, next_status):
            return False
        user = self._users.get_by_id(subscription.user_id)
        period_end = self._extract_period_end(obj) or subscription.current_period_end
        self._subscriptions.upsert_for_user(
            subscription.user_id,
            stripe_customer_id=str(obj.get("customer", "")) or subscription.stripe_customer_id,
            stripe_subscription_id=subscription_id,
            stripe_price_id=subscription.stripe_price_id,
            current_period_end=period_end,
            status=next_status,
            entitlement_active=(next_status == "active"),
        )
        self._audit_log.record(
            event_type="subscription_status_changed",
            path="/billing/webhooks/stripe",
            actor=user.username if user else None,
            role=user.role if user else None,
        )
        return True

    def _handle_subscription_deleted(self, obj: dict[str, Any]) -> bool:
        subscription_id = str(obj.get("id", ""))
        if not subscription_id:
            return False
        subscription = self._subscriptions.get_by_stripe_subscription_id(subscription_id)
        if subscription is None:
            return False
        if not self._can_transition(subscription, "canceled"):
            return False
        user = self._users.get_by_id(subscription.user_id)
        period_end = self._extract_period_end(obj) or subscription.current_period_end
        self._subscriptions.upsert_for_user(
            subscription.user_id,
            stripe_customer_id=subscription.stripe_customer_id,
            stripe_subscription_id=subscription.stripe_subscription_id,
            stripe_price_id=subscription.stripe_price_id,
            current_period_end=period_end,
            status="canceled",
            entitlement_active=False,
        )
        self._audit_log.record(
            event_type="subscription_status_changed",
            path="/billing/webhooks/stripe",
            actor=user.username if user else None,
            role=user.role if user else None,
        )
        return True

    @staticmethod
    def _to_datetime(value: Any) -> datetime | None:
        if value is None:
            return None
        try:
            timestamp = int(value)
        except (TypeError, ValueError):
            return None
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    def _retrieve_subscription_period_end(self, subscription_id: str) -> datetime | None:
        try:
            subscription = self._stripe.retrieve_subscription(subscription_id)
        except Exception:
            return None
        return self._extract_period_end(subscription)

    def _extract_period_end(self, obj: dict[str, Any]) -> datetime | None:
        # Stripe payload shape differs by event type.
        direct = self._to_datetime(obj.get("current_period_end")) or self._to_datetime(
            obj.get("period_end")
        )
        if direct is not None:
            return direct

        lines = obj.get("lines")
        if isinstance(lines, dict):
            data = lines.get("data")
            if isinstance(data, list):
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    period = item.get("period")
                    if isinstance(period, dict):
                        nested = self._to_datetime(period.get("end"))
                        if nested is not None:
                            return nested
        return None

    @staticmethod
    def _can_transition(current: SubscriptionRecord | None, next_status: str) -> bool:
        if current is None:
            return next_status in {"pending", "active", "past_due", "canceled"}
        if current.status == next_status:
            return True
        transitions = {
            "pending": {"active", "past_due", "canceled"},
            "active": {"past_due", "canceled"},
            "past_due": {"active", "canceled"},
            "canceled": set(),
        }
        return next_status in transitions.get(current.status, set())

    def _handle_subscription_updated(self, obj: dict[str, Any]) -> bool:
        subscription_id = str(obj.get("id", ""))
        if not subscription_id:
            return False
        subscription = self._subscriptions.get_by_stripe_subscription_id(subscription_id)
        if subscription is None:
            return False

        stripe_status = str(obj.get("status", "")).lower()
        mapped = self._map_stripe_status(stripe_status)
        if mapped is None:
            return False
        next_status, next_entitlement = mapped
        if not self._can_transition(subscription, next_status):
            return False
        period_end = self._extract_period_end(obj) or subscription.current_period_end
        user = self._users.get_by_id(subscription.user_id)
        self._subscriptions.upsert_for_user(
            subscription.user_id,
            stripe_customer_id=str(obj.get("customer", "")) or subscription.stripe_customer_id,
            stripe_subscription_id=subscription_id,
            stripe_price_id=subscription.stripe_price_id,
            current_period_end=period_end,
            status=next_status,
            entitlement_active=next_entitlement,
        )
        self._audit_log.record(
            event_type="subscription_status_changed",
            path="/billing/webhooks/stripe",
            actor=user.username if user else None,
            role=user.role if user else None,
        )
        return True

    def _handle_checkout_expired(self, obj: dict[str, Any]) -> bool:
        metadata = obj.get("metadata") or {}
        user_id = str(metadata.get("user_id", ""))
        customer_id = str(obj.get("customer", ""))
        user = self._users.get_by_id(user_id) if user_id else None
        if user is None and customer_id:
            user = self._users.get_by_stripe_customer_id(customer_id)
        if user is None:
            return False
        current = self._subscriptions.get_by_user_id(user.id)
        if current is None:
            return False
        if current.status == "active":
            return False
        if not self._can_transition(current, "pending"):
            return False
        self._subscriptions.upsert_for_user(
            user.id,
            stripe_customer_id=customer_id or current.stripe_customer_id,
            stripe_subscription_id=current.stripe_subscription_id,
            stripe_price_id=current.stripe_price_id,
            current_period_end=current.current_period_end,
            status="pending",
            entitlement_active=False,
        )
        return True

    @staticmethod
    def _map_stripe_status(stripe_status: str) -> tuple[str, bool] | None:
        if stripe_status in {"active", "trialing"}:
            return ("active", True)
        if stripe_status in {"past_due", "unpaid", "incomplete"}:
            return ("past_due", False)
        if stripe_status in {"canceled", "incomplete_expired"}:
            return ("canceled", False)
        return None
