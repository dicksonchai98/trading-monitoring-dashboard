"""Email webhook routes."""

from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.state import email_webhook_service

router = APIRouter(prefix="/email/webhooks", tags=["email-webhooks"])


@router.post("/sendgrid", status_code=status.HTTP_202_ACCEPTED)
async def sendgrid_webhook(
    request: Request,
    x_sendgrid_signature: str | None = Header(default=None),
) -> dict[str, int]:
    payload = await request.body()
    if not email_webhook_service.verify_signature(payload, x_sendgrid_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_signature")

    try:
        events = json.loads(payload.decode("utf-8"))
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_payload"
        ) from err

    if not isinstance(events, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_payload")

    processed = email_webhook_service.process_events(events)
    return {"processed": processed}
