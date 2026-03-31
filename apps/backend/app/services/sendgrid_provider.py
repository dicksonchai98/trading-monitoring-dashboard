"""SendGrid email provider adapter."""

from __future__ import annotations

import httpx

from app.services.email_provider import EmailProvider, EmailSendResult


class SendGridProvider(EmailProvider):
    def __init__(
        self,
        *,
        api_key: str,
        from_email: str,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._from_email = from_email
        self._http = http_client or httpx.Client(timeout=10.0)

    def send(
        self,
        *,
        recipient: str,
        template_name: str,
        payload: dict[str, object],
    ) -> EmailSendResult:
        body = {
            "from": {"email": self._from_email},
            "personalizations": [
                {
                    "to": [{"email": recipient}],
                    "dynamic_template_data": payload,
                }
            ],
            "template_id": template_name,
        }
        response = self._http.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        accepted = response.status_code in (200, 202)
        message_id = response.headers.get("X-Message-Id")
        return EmailSendResult(
            accepted=accepted,
            provider="sendgrid",
            provider_message_id=message_id,
            error_message=None if accepted else response.text,
            raw_payload={"status_code": response.status_code},
        )
