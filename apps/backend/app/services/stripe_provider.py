"""Stripe provider wrapper with lazy dependency loading."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class CheckoutSessionResult:
    checkout_url: str
    session_id: str


@dataclass
class PortalSessionResult:
    portal_url: str


class StripeProvider:
    @staticmethod
    def _matches_stripe_error(stripe: Any, exc: Exception, error_name: str) -> bool:
        stripe_error = getattr(getattr(stripe, "error", None), error_name, None)
        return stripe_error is not None and isinstance(exc, stripe_error)

    def __init__(self, secret_key: str) -> None:
        if secret_key and not secret_key.startswith("sk_"):
            raise ValueError("Stripe secret key is invalid: expected key starting with 'sk_'")
        self._secret_key = secret_key

    def _client(self) -> Any:
        if not self._secret_key:
            raise RuntimeError(
                "Stripe secret key not configured - cannot perform billing operations"
            )
        try:
            import stripe  # type: ignore
        except ImportError as exc:  # pragma: no cover - environment setup issue
            raise RuntimeError("stripe package is required for billing operations") from exc
        stripe.api_key = self._secret_key
        return stripe

    def create_customer(self, *, username: str) -> str:
        stripe = self._client()
        customer = stripe.Customer.create(metadata={"username": username})
        return str(customer["id"])

    def create_checkout_session(
        self, *, customer_id: str, price_id: str, success_url: str, cancel_url: str, user_id: str
    ) -> CheckoutSessionResult:
        stripe = self._client()
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user_id},
        )
        return CheckoutSessionResult(
            checkout_url=str(session["url"]), session_id=str(session["id"])
        )

    def create_portal_session(self, *, customer_id: str, return_url: str) -> PortalSessionResult:
        stripe = self._client()
        session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
        return PortalSessionResult(portal_url=str(session["url"]))

    def construct_event(
        self, payload: bytes, signature: str, webhook_secret: str
    ) -> dict[str, Any]:
        stripe = self._client()
        try:
            event_obj = stripe.Webhook.construct_event(
                payload=payload, sig_header=signature, secret=webhook_secret
            )
        except Exception as exc:
            # Normalize signature verification error to ValueError for caller
            if self._matches_stripe_error(stripe, exc, "SignatureVerificationError"):
                raise ValueError("invalid signature") from exc
            raise

        # If Stripe already returned a plain dict, use it
        if isinstance(event_obj, dict):
            return event_obj

        # Prefer explicit to_dict() if available
        if hasattr(event_obj, "to_dict"):
            try:
                return event_obj.to_dict()
            except Exception:
                logger.exception("event_obj.to_dict() failed, falling back to _data")

        # Fallback to extracting underlying _data recursively
        raw = getattr(event_obj, "_data", None)
        if isinstance(raw, dict):

            def _normalize(obj):
                if isinstance(obj, dict):
                    return {k: _normalize(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [_normalize(i) for i in obj]
                if hasattr(obj, "_data"):
                    return _normalize(obj._data)
                return obj

            return _normalize(raw)

        # Last resort: try json round-trip or dict conversion
        import json

        try:
            return json.loads(str(event_obj))
        except Exception:
            try:
                return dict(event_obj)
            except Exception as exc:
                logger.exception("failed to convert stripe event to dict, re-raising")
                raise exc

    def retrieve_checkout_session(self, session_id: str) -> dict[str, Any]:
        stripe = self._client()
        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except Exception as exc:
            # Map not-found to ValueError so callers can translate to 404
            if self._matches_stripe_error(stripe, exc, "InvalidRequestError"):
                raise ValueError("not_found") from exc
            raise

        if isinstance(session, dict):
            return session
        if hasattr(session, "to_dict"):
            try:
                return session.to_dict()
            except Exception:
                logger.exception("session.to_dict() failed, falling back to _data")

        raw = getattr(session, "_data", None)
        if isinstance(raw, dict):

            def _normalize(obj):
                if isinstance(obj, dict):
                    return {k: _normalize(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [_normalize(i) for i in obj]
                if hasattr(obj, "_data"):
                    return _normalize(obj._data)
                return obj

            return _normalize(raw)

        import json

        try:
            return json.loads(str(session))
        except Exception:
            try:
                return dict(session)
            except Exception as exc:
                logger.exception("failed to convert checkout session to dict, re-raising")
                raise exc

    def retrieve_subscription(self, subscription_id: str) -> dict[str, Any]:
        stripe = self._client()
        subscription = stripe.Subscription.retrieve(subscription_id)
        return dict(subscription)
