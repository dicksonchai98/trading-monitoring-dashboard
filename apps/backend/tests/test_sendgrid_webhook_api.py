from __future__ import annotations

import hashlib
import hmac
import json

from app.config import SENDGRID_WEBHOOK_SIGNING_KEY
from app.db.session import SessionLocal
from app.main import app
from app.models.email_delivery_log import EmailDeliveryLogModel
from app.models.email_outbox import EmailOutboxModel
from app.repositories.email_outbox_repository import EmailOutboxRepository
from fastapi.testclient import TestClient
from sqlalchemy import select


def _signature(payload: bytes) -> str:
    return hmac.new(
        SENDGRID_WEBHOOK_SIGNING_KEY.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()


def test_sendgrid_webhook_writes_delivery_events() -> None:
    client = TestClient(app)
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    outbox = repo.create_task(
        email_type=EmailOutboxModel.EmailType.OTP,
        recipient="u@example.com",
        template_name="otp_template",
        payload_json={"otp_code": "123456"},
        idempotency_key="otp:u@example.com:webhook-1",
    )
    payload_obj = [{"event": "delivered", "sg_message_id": "m1", "outbox_id": outbox.id}]
    payload = json.dumps(payload_obj).encode("utf-8")

    res = client.post(
        "/email/webhooks/sendgrid",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-SendGrid-Signature": _signature(payload),
        },
    )
    assert res.status_code == 202
    assert res.json()["processed"] == 1
    assert repo.get_status(outbox.id) == "sent"

    with SessionLocal() as session:
        row = session.execute(
            select(EmailDeliveryLogModel).where(EmailDeliveryLogModel.outbox_id == outbox.id)
        ).scalar_one()
        assert row.event_type == "delivered"
        assert row.result == "sent"


def test_sendgrid_webhook_rejects_invalid_signature() -> None:
    client = TestClient(app)
    payload = json.dumps([{"event": "delivered"}]).encode("utf-8")
    res = client.post(
        "/email/webhooks/sendgrid",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-SendGrid-Signature": "bad",
        },
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_signature"
