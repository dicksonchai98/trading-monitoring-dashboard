# OTP Email Verification and Notification Service Design V2 (2026-03-23)

## 1. Goals and Scope

This design defines a reusable email delivery foundation across two domains:

- OTP Verification Domain (required for MVP)
- Notification Email Domain (capability-first for MVP, without binding business triggers yet)

MVP scope is explicitly:

- OTP is used only for pre-registration email verification
- OTP channel is fixed to `email` (no SMS / TOTP / voice OTP)
- Initial provider is `SendGrid`
- MQ is `Redis Streams`
- Keep existing `POST /auth/register` and extend it with verification token validation

## 2. Confirmed Decisions

1. Return a clear error for already-registered emails (email enumeration risk accepted)
2. `send-otp` uses accepted semantics and does not guarantee final delivery
3. Duplicate requests within cooldown are rejected with `429` and remaining seconds
4. OTP verification issues a one-time `opaque` verification token (not JWT)
5. Notification domain is implemented first as a platform capability, without fixed trigger scenarios
6. No internal notification API for MVP; implement service method + tests only
7. Include SendGrid webhook write-back in MVP

## 3. Architecture Overview

```text
Client
  |
  v
FastAPI API
  |
  +--> Auth Service (OTP)
  |
  +--> Notification Service (domain abstraction)
  |
  v
PostgreSQL (otp_challenges / verification_tokens / email_outbox / delivery_logs)
  |
  v
Outbox Dispatcher
  |
  v
Redis Streams
  |
  v
Email Worker
  |
  v
SendGrid API
  |
  v
SendGrid Event Webhook -> FastAPI Webhook Endpoint -> delivery logs/status update
```

## 4. API Contract (Auth)

### 4.1 `POST /auth/email/send-otp`

- Input: `email`
- Behavior:
  - Validate email format
  - Return a clear "already registered" error if the email exists
  - Apply cooldown and rate limits
  - Create or update OTP challenge
  - Write an outbox task in the same transaction
  - Return accepted response immediately (without waiting for provider)
- Errors:
  - `429` (cooldown or rate limit), including `retry_after_seconds`

### 4.2 `POST /auth/email/verify-otp`

- Input: `email`, `otp_code`
- Behavior:
  - Read the latest valid challenge for the email
  - Validate expiration / lock status / max attempt limit
  - Compare OTP hash using constant-time comparison
  - Mark challenge as `verified` on success
  - Issue a short-lived one-time `verification_token` (opaque)

### 4.3 `POST /auth/register` (existing route)

- Add input field: `verification_token`
- Pre-checks:
  - Token is not expired and not used
  - `purpose=register`
  - Token-bound email must match registration email
- Atomic updates after successful registration:
  - Mark token `used_at`
  - Transition challenge from `verified -> consumed`

## 5. State Machine

### 5.1 `otp_challenges.status`

- `pending -> verified -> consumed`
- `pending -> expired`
- `pending -> locked`
- `expired/locked/consumed` cannot be verified again

Concurrency rule:

- Allow only one active `pending challenge` per email

## 6. Data Model

### 6.1 `otp_challenges`

Key fields:

- `id`
- `email`
- `otp_hash`
- `status` (`pending|verified|expired|locked|consumed`)
- `expires_at`
- `verify_attempts`
- `max_attempts`
- `last_sent_at`
- `created_at`, `updated_at`

### 6.2 `otp_verification_tokens` (new)

Key fields:

- `id`
- `token_hash`
- `challenge_id`
- `email`
- `purpose` (fixed to `register` in MVP)
- `expires_at`
- `used_at`
- `created_at`

Constraints:

- Token is consumable only when `used_at is null`
- Each token can be used only once

### 6.3 `email_outbox`

Key fields:

- `id`
- `email_type` (`otp|notification`)
- `recipient`
- `template_name`
- `payload_json`
- `status` (`pending|processing|sent|failed`)
- `retry_count`
- `max_retry`
- `idempotency_key`
- `created_at`, `updated_at`

Constraints:

- Unique index on `idempotency_key`

### 6.4 `email_delivery_logs`

Key fields:

- `id`
- `outbox_id`
- `provider` (MVP: `sendgrid`)
- `provider_message_id`
- `event_type`
- `result`
- `error_message`
- `attempt_no`
- `event_at`
- `provider_payload_json`

## 7. Consistency and Deduplication

### 7.1 Outbox Primary Path

- Business transaction and outbox write happen in the same DB transaction
- Dispatcher asynchronously pushes `pending outbox` rows to `Redis Streams`
- Worker consumes from MQ and updates outbox/log only

### 7.2 Deduplication Strategy

- API layer: cooldown / rate limit / business idempotency checks
- Outbox layer: unique constraint on `idempotency_key`
- Worker layer:
  - Skip directly when outbox is already `sent`
  - Recover timed-out `processing` rows for retry

## 8. Retry Strategy

### 8.1 OTP Emails

- Maximum 3 retries
- Exponential backoff
- Final state remains `failed`; user must request a new OTP

### 8.2 Notification Emails

- Maximum 5 retries
- Exponential backoff
- Move to `failed` after max retries; can be handled by manual ops or compensation jobs later

## 9. SendGrid Integration and Webhook

MVP provider: `SendGrid`

Webhook events (minimum MVP set):

- `delivered`
- `bounce`
- `dropped`
- `deferred`

Handling rules:

- Verify webhook signature at endpoint
- Write back events into `email_delivery_logs`
- Update outbox terminal status when needed

## 10. Notification Domain (MVP Strategy)

MVP ships the generic capability first, without fixed business triggers:

- Provide a notification service method
- Allow creation of notification outbox tasks through the same delivery pipeline
- Validate pipeline behavior through tests

Specific trigger scenarios (for example subscription changes or risk alerts) are defined in later phases.

## 11. Security and Observability

### 11.1 Security

- Never store OTP in plaintext; store hash only
- Use constant-time compare for OTP verification
- Enforce one-time consumption for registration verification tokens

### 11.2 Metrics

At minimum, track:

- OTP request count
- OTP verification success/failure rate
- Email delivery success rate
- Redis stream backlog
- Worker failure count
- Provider error code distribution

### 11.3 Alerts

- Abnormal increase in OTP failure rate
- Outbox `pending` backlog growth
- Continuous worker failures
- Sudden provider error spikes

## 12. Test Strategy (MVP Minimum)

- Unit:
  - OTP state transitions
  - One-time consumption of verification tokens
  - Idempotency key generation and constraints
- Integration:
  - outbox -> Redis Streams -> worker -> SendGrid adapter
  - webhook write-back state updates
- API:
  - end-to-end flow for `send-otp / verify-otp / register`
  - cooldown, rate limit, and max attempts
- Concurrency:
  - duplicate send requests
  - duplicate message consumption
  - registration token replay attempts
