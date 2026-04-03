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
    send_res = client.post("/auth/email/send-otp", json={"email": username})
    assert send_res.status_code == 202
    verify_res = client.post(
        "/auth/email/verify-otp", json={"email": username, "otp_code": "123456"}
    )
    assert verify_res.status_code == 200
    res = client.post(
        "/auth/register",
        json={
            "username": username,
            "password": "pass",
            "verification_token": verify_res.json()["verification_token"],
        },
    )
    assert res.status_code == 200
    login = client.post("/auth/login", json={"username": username, "password": "pass"})
    assert login.status_code == 200
    return str(login.json()["access_token"])


def test_checkout_status_portal_happy_path() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "billing-user@example.com")
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
    token = _register_and_login(client, "hook-user@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    checkout = client.post("/billing/checkout", headers=headers, json={"price_id": "price_local"})
    assert checkout.status_code == 200

    payload = {
        "id": "evt_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_hook-user@example.com",
                "subscription": "sub_1",
                "metadata": {
                    "user_id": billing_service._users.get_by_username("hook-user@example.com").id
                },
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
    token = _register_and_login(client, "no-customer-user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/billing/portal-session", headers=headers)
    assert res.status_code == 409


def test_checkout_does_not_downgrade_active_subscription() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "already-active@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    checkout = client.post("/billing/checkout", headers=headers, json={"price_id": "price_local"})
    assert checkout.status_code == 200

    user = billing_service._users.get_by_username("already-active@example.com")
    completed_payload = {
        "id": "evt_active_seed",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_already-active@example.com",
                "subscription": "sub_active_seed",
                "metadata": {"user_id": user.id},
                "current_period_end": 1924992000,
            }
        },
    }
    completed = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(completed_payload),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "processed"

    status_before = client.get("/billing/status", headers=headers).json()
    assert status_before["status"] == "active"
    assert status_before["entitlement_active"] is True

    second_checkout = client.post(
        "/billing/checkout", headers=headers, json={"price_id": "price_local"}
    )
    assert second_checkout.status_code == 200
    status_after = client.get("/billing/status", headers=headers).json()
    assert status_after["status"] == "active"
    assert status_after["entitlement_active"] is True


def test_customer_subscription_updated_updates_local_state() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "updated-user@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    checkout = client.post("/billing/checkout", headers=headers, json={"price_id": "price_local"})
    assert checkout.status_code == 200

    user = billing_service._users.get_by_username("updated-user@example.com")
    completed_payload = {
        "id": "evt_updated_seed",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_updated-user@example.com",
                "subscription": "sub_updated_seed",
                "metadata": {"user_id": user.id},
                "current_period_end": 1924992000,
            }
        },
    }
    completed = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(completed_payload),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert completed.status_code == 200

    updated_payload = {
        "id": "evt_subscription_updated_1",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_updated_seed",
                "customer": "cus_updated-user@example.com",
                "status": "past_due",
                "current_period_end": 1925992000,
            }
        },
    }
    updated = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(updated_payload),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "processed"

    status = client.get("/billing/status", headers=headers)
    assert status.status_code == 200
    assert status.json()["status"] == "past_due"
    assert status.json()["entitlement_active"] is False


def test_checkout_session_expired_marks_pending_without_entitlement() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)
    token = _register_and_login(client, "expired-user@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    checkout = client.post("/billing/checkout", headers=headers, json={"price_id": "price_local"})
    assert checkout.status_code == 200

    user = billing_service._users.get_by_username("expired-user@example.com")
    expired_payload = {
        "id": "evt_checkout_expired_1",
        "type": "checkout.session.expired",
        "data": {
            "object": {
                "customer": "cus_expired-user@example.com",
                "metadata": {"user_id": user.id},
            }
        },
    }
    expired = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(expired_payload),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert expired.status_code == 200
    assert expired.json()["status"] == "processed"

    status = client.get("/billing/status", headers=headers)
    assert status.status_code == 200
    assert status.json()["status"] == "pending"
    assert status.json()["entitlement_active"] is False


def test_duplicate_event_id_with_different_payload_is_rejected() -> None:
    billing_service._stripe = FakeStripeProvider()
    client = TestClient(app)

    payload_1 = {
        "id": "evt_conflict_1",
        "type": "checkout.session.expired",
        "data": {"object": {"customer": "cus_x", "metadata": {"user_id": "u1"}}},
    }
    payload_2 = {
        "id": "evt_conflict_1",
        "type": "checkout.session.expired",
        "data": {"object": {"customer": "cus_y", "metadata": {"user_id": "u2"}}},
    }

    first = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(payload_1),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert first.status_code == 200

    second = client.post(
        "/billing/webhooks/stripe",
        data=json.dumps(payload_2),
        headers={"Stripe-Signature": "valid", "Content-Type": "application/json"},
    )
    assert second.status_code == 400
    assert second.json()["detail"] == "invalid_event"


def test_plans_endpoint_returns_real_plan_fields() -> None:
    client = TestClient(app)
    res = client.get("/billing/plans")
    assert res.status_code == 200
    plans = res.json()["plans"]
    assert len(plans) == 2
    free_plan = plans[0]
    basic_plan = plans[1]
    assert free_plan["id"] == "free"
    assert free_plan["price"] == "free"
    assert basic_plan["id"] == "basic"
    assert basic_plan["name"] == "Basic"
    assert basic_plan["price_id"] == "price_local"
    assert basic_plan["currency"] == "usd"
    assert basic_plan["interval"] == "month"
