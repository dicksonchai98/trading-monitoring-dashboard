# OTP Email Ops Runbook

## Scope

This runbook covers:

- OTP send/verify/register email verification flow
- Email outbox dispatcher
- Email worker with SendGrid provider
- SendGrid webhook write-back

## Required Environment Variables

- `OTP_CHANNEL=email`
- `OTP_TTL_SECONDS`
- `OTP_MAX_VERIFY_ATTEMPTS`
- `OTP_RESEND_COOLDOWN_SECONDS`
- `OTP_SEND_MAX_RETRIES`
- `NOTIFICATION_SEND_MAX_RETRIES`
- `OTP_VERIFICATION_TOKEN_TTL_SECONDS`
- `OTP_HASH_SECRET`
- `OPAQUE_TOKEN_HASH_SECRET`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_OTP_TEMPLATE_ID`
- `SENDGRID_WEBHOOK_SIGNING_KEY`
- `EMAIL_STREAM_KEY`
- `EMAIL_STREAM_GROUP`
- `EMAIL_STREAM_CONSUMER`
- `REDIS_URL`

## Local Run

API:

```bash
uvicorn app.main:app --reload
```

Combined worker (recommended):

```bash
python -m workers.email_pipeline_worker
```

Dispatcher (manual run in shell/python):

```python
from app.state import get_email_outbox_dispatcher
print(get_email_outbox_dispatcher().dispatch_once(limit=100))
```

Worker (module usage):

```python
from app.db.session import SessionLocal
from app.repositories.email_outbox_repository import EmailOutboxRepository
from app.repositories.email_delivery_log_repository import EmailDeliveryLogRepository
from app.services.sendgrid_provider import SendGridProvider
from app.workers.email_worker import EmailWorker

worker = EmailWorker(
    outbox_repository=EmailOutboxRepository(session_factory=SessionLocal),
    delivery_log_repository=EmailDeliveryLogRepository(session_factory=SessionLocal),
    provider=SendGridProvider(api_key="...", from_email="noreply@example.com"),
)
```

Notes:
- `SENDGRID_OTP_TEMPLATE_ID` must be a valid SendGrid dynamic template id (`d-...`).
- `POST /auth/email/send-otp` returns `202 accepted` after enqueueing outbox task; delivery is done by worker.

## SendGrid Webhook Setup

- Endpoint: `POST /email/webhooks/sendgrid`
- Header: `X-SendGrid-Signature`
- Signature: HMAC-SHA256 over raw request body with `SENDGRID_WEBHOOK_SIGNING_KEY`

Supported events:

- `delivered`
- `bounce`
- `dropped`
- `deferred`

## Failure Triage

1. Outbox backlog:
- Check pending/processing counts in `email_outbox`.
- Run dispatcher and verify messages are published to Redis stream.

2. Worker failures:
- Inspect `email_delivery_logs.error_message`.
- Check `email_outbox.retry_count` and `status=failed`.

3. Webhook mismatch:
- Verify `SENDGRID_WEBHOOK_SIGNING_KEY` and incoming signature header.
- Confirm raw body is passed unchanged to signature verification.

