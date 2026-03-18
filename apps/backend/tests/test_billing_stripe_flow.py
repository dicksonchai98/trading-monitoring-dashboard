from __future__ import annotations

import json

from app.main import app
from app.services.stripe_provider import CheckoutSessionResult, PortalSessionResult
from app.state import billing_service
from fastapi.testclient import TestClient


class FakeStripeProvider:
    def __init__(self) -> None:
        self.created_customers: list[str] = []

    def create_customer(self, *, username: str) -> str:
        customer_id = f"cus_{username}"
        self.created_customers.append(customer_id)
        return customer_id

    def create_checkout_session(
        self, *, customer_id: str, price_id: str, success_url: str, cancel_url: str, user_id: str
    ) -> CheckoutSessionResult:
        return CheckoutSessionResult(
            checkout_url=f"https://checkout.test/{customer_id}/{price_id}",
            session_id=f"cs_{user_id}",
        )

    def create_portal_session(self, *, customer_id: str, return_url: str) -> PortalSessionResult:
        return PortalSessionResult(portal_url=f"https://portal.test/{customer_id}")

    def construct_event(
        self, payload: bytes, signature: str, webhook_secret: str
    ) -> dict[str, object]:
        if signature != "valid":
            raise ValueError("invalid signature")
        return json.loads(payload.decode("utf-8"))

    def retrieve_subscription(self, subscription_id: str) -> dict[str, object]:
        return {"id": subscription_id, "current_period_end": 1924992000}


def _register_and_login(client: TestClient, username: str) -> str:
    res = client.post("/auth/register", json={"username": username, "password": "pass"})
    assert res.status_code == 200
    login = client.post("/auth/login", json={"username": username, "password": "pass"})
    assert login.status_code == 200
    return str(login.json()["access_token"])


def test_checkout_status_portal_happy_path() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "billing-user")
    headers = {"Authorization": f"Bearer {token}"}

    checkout = client.post("/billing/checkout", headers=headers, json={"price_id": "price_local"})
    assert checkout.status_code == 200
    assert "checkout_url" in checkout.json()
    assert "session_id" in checkout.json()

    status_before = client.get("/billing/status", headers=headers)
    assert status_before.status_code == 200
    assert status_before.json()["status"] == "pending"

    portal = client.post("/billing/portal-session", headers=headers)
    assert portal.status_code == 200
    assert "portal_url" in portal.json()


def test_webhook_signature_validation_and_idempotency() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "hook-user")
    headers = {"Authorization": f"Bearer {token}"}
    checkout = client.post("/billing/checkout", headers=headers, json={"price_id": "price_local"})
    assert checkout.status_code == 200

    payload = {
        "id": "evt_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_hook-user",
                "subscription": "sub_1",
                "metadata": {"user_id": billing_service._users.get_by_username("hook-user").id},
                "current_period_end": 1924992000,
            }
        },
    }
    invalid = client.post("/billing/webhooks/stripe", json=payload)
    assert invalid.status_code == 400

    first = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(payload),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert first.status_code == 200
    assert first.json()["status"] == "processed"

    second = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(payload),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert second.status_code == 200
    assert second.json()["status"] == "ignored"

    status = client.get("/billing/status", headers=headers)
    assert status.status_code == 200
    assert status.json()["status"] == "active"
    assert status.json()["current_period_end"] is not None


def test_portal_requires_customer_mapping() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "no-customer-user")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/billing/portal-session", headers=headers)
    assert res.status_code == 409
