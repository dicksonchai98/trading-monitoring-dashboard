"""Stripe provider wrapper with lazy dependency loading."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class CheckoutSessionResult:
    checkout_url: str
    session_id: str


@dataclass
class PortalSessionResult:
    portal_url: str


class StripeProvider:
    def __init__(self, secret_key: str) -> None:
        if not secret_key.startswith("sk_"):
            raise ValueError("Stripe secret key is invalid: expected key starting with 'sk_'")
        self._secret_key = secret_key

    def _client(self) -> Any:
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
        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=signature, secret=webhook_secret
        )
        return dict(event)

    def retrieve_subscription(self, subscription_id: str) -> dict[str, Any]:
        stripe = self._client()
        subscription = stripe.Subscription.retrieve(subscription_id)
        return dict(subscription)
