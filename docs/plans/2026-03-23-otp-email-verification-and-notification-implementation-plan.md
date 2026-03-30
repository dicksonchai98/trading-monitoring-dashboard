# OTP Email Verification and Notification Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement email-only OTP verification for registration, plus a reusable notification email pipeline using SendGrid, Redis Streams, and outbox reliability patterns.

**Architecture:** Extend the existing FastAPI auth domain with OTP challenge + one-time opaque verification token flow, and gate existing `POST /auth/register` behind token validation. Build a shared email platform (`email_outbox` + dispatcher + worker + delivery logs + SendGrid webhook write-back) that supports both OTP and notification domains, while keeping notification triggers capability-first (service method only) for MVP.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Alembic, Redis Streams, SendGrid API + Event Webhook, pytest, React, TypeScript, React Query, React Hook Form, Zod, Vitest

---

### Task 1: Add OTP/Email configuration and defaults

**Files:**
- Modify: `apps/backend/app/config.py`
- Create: `apps/backend/tests/test_otp_email_config.py`

**Step 1: Write the failing test**

```python
from app import config


def test_otp_email_defaults() -> None:
    assert config.OTP_TTL_SECONDS == 300
    assert config.OTP_RESEND_COOLDOWN_SECONDS == 60
    assert config.SENDGRID_API_KEY == ""
    assert config.OTP_CHANNEL == "email"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_otp_email_config.py -v`  
Expected: FAIL with missing config attributes.

**Step 3: Write minimal implementation**

Add new config keys:
- `OTP_CHANNEL` (fixed default `email`)
- `OTP_TTL_SECONDS`
- `OTP_MAX_VERIFY_ATTEMPTS`
- `OTP_RESEND_COOLDOWN_SECONDS`
- `OTP_SEND_MAX_RETRIES`
- `NOTIFICATION_SEND_MAX_RETRIES`
- `OTP_VERIFICATION_TOKEN_TTL_SECONDS`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_WEBHOOK_SIGNING_KEY`
- `EMAIL_STREAM_KEY` (for Redis Streams queue key)

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_otp_email_config.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/tests/test_otp_email_config.py
git commit -m "feat: add otp and sendgrid runtime configuration"
```

### Task 2: Add ORM models for OTP and email pipeline

**Files:**
- Create: `apps/backend/app/models/otp_challenge.py`
- Create: `apps/backend/app/models/otp_verification_token.py`
- Create: `apps/backend/app/models/email_outbox.py`
- Create: `apps/backend/app/models/email_delivery_log.py`
- Modify: `apps/backend/app/models/__init__.py`
- Modify: `apps/backend/tests/test_models_schema.py`

**Step 1: Write the failing test**

```python
from app.models.email_outbox import EmailOutboxModel
from app.models.otp_challenge import OtpChallengeModel
from app.models.otp_verification_token import OtpVerificationTokenModel


def test_otp_and_outbox_tables_exist() -> None:
    assert OtpChallengeModel.__tablename__ == "otp_challenges"
    assert OtpVerificationTokenModel.__tablename__ == "otp_verification_tokens"
    assert EmailOutboxModel.__tablename__ == "email_outbox"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_models_schema.py -v`  
Expected: FAIL with import error for new models.

**Step 3: Write minimal implementation**

Define models and enums:
- `otp_challenges.status`: `pending|verified|expired|locked|consumed`
- `email_outbox.status`: `pending|processing|sent|failed`
- `email_outbox.email_type`: `otp|notification`
- unique index on `email_outbox.idempotency_key`
- include timestamps and core fields from design doc

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_models_schema.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/models apps/backend/tests/test_models_schema.py
git commit -m "feat: add otp and email pipeline orm models"
```

### Task 3: Add Alembic migration for OTP and email tables

**Files:**
- Create: `apps/backend/alembic/versions/20260323_01_add_otp_and_email_pipeline_tables.py`
- Modify: `apps/backend/tests/test_migration_metadata.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_otp_email_migration_file_exists() -> None:
    path = Path("alembic/versions/20260323_01_add_otp_and_email_pipeline_tables.py")
    assert path.exists()
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_migration_metadata.py -v`  
Expected: FAIL because migration file is missing.

**Step 3: Write minimal implementation**

Create migration with:
- `otp_challenges`
- `otp_verification_tokens`
- `email_outbox`
- `email_delivery_logs`
- required unique indexes (`idempotency_key`, active token lookup indexes)

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_migration_metadata.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/alembic/versions/20260323_01_add_otp_and_email_pipeline_tables.py apps/backend/tests/test_migration_metadata.py
git commit -m "feat: add alembic migration for otp and email pipeline tables"
```

### Task 4: Add OTP hashing and opaque verification token primitives

**Files:**
- Create: `apps/backend/app/services/otp_crypto.py`
- Create: `apps/backend/tests/test_otp_crypto.py`

**Step 1: Write the failing test**

```python
from app.services.otp_crypto import hash_otp_code, verify_otp_code


def test_hash_and_verify_otp_constant_time() -> None:
    digest = hash_otp_code("123456")
    assert verify_otp_code("123456", digest) is True
    assert verify_otp_code("654321", digest) is False
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_otp_crypto.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

Implement:
- OTP hash with app pepper/secret and SHA-256 HMAC
- constant-time compare using `hmac.compare_digest`
- random opaque token generator and token hash helper

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_otp_crypto.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/otp_crypto.py apps/backend/tests/test_otp_crypto.py
git commit -m "feat: add otp hash and opaque token crypto helpers"
```

### Task 5: Add repositories for OTP challenges, verification tokens, and outbox

**Files:**
- Create: `apps/backend/app/repositories/otp_challenge_repository.py`
- Create: `apps/backend/app/repositories/otp_verification_token_repository.py`
- Create: `apps/backend/app/repositories/email_outbox_repository.py`
- Create: `apps/backend/app/repositories/email_delivery_log_repository.py`
- Create: `apps/backend/tests/test_otp_challenge_repository.py`
- Create: `apps/backend/tests/test_email_outbox_repository.py`

**Step 1: Write the failing tests**

```python
def test_create_or_refresh_pending_challenge_per_email() -> None:
    repo = OtpChallengeRepository(session_factory=SessionLocal)
    first = repo.create_or_replace_pending(email="u@example.com", otp_hash="h1")
    second = repo.create_or_replace_pending(email="u@example.com", otp_hash="h2")
    assert first.id != second.id
    assert repo.get_latest_pending("u@example.com").id == second.id
```

```python
def test_outbox_idempotency_key_unique() -> None:
    repo = EmailOutboxRepository(session_factory=SessionLocal)
    repo.create_task(..., idempotency_key="otp:u@example.com:1")
    with pytest.raises(ValueError, match="duplicate_outbox"):
        repo.create_task(..., idempotency_key="otp:u@example.com:1")
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/backend; python -m pytest tests/test_otp_challenge_repository.py tests/test_email_outbox_repository.py -v`  
Expected: FAIL with missing repositories.

**Step 3: Write minimal implementation**

Implement repository methods for:
- challenge create/read/update attempts/status
- one-time token create/consume
- outbox create + status transitions + retry count
- delivery log append

**Step 4: Run tests to verify they pass**

Run: `cd apps/backend; python -m pytest tests/test_otp_challenge_repository.py tests/test_email_outbox_repository.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/repositories apps/backend/tests/test_otp_challenge_repository.py apps/backend/tests/test_email_outbox_repository.py
git commit -m "feat: add otp and email pipeline repositories"
```

### Task 6: Implement OTP service (send/verify/consume)

**Files:**
- Create: `apps/backend/app/services/otp_service.py`
- Create: `apps/backend/tests/test_otp_service.py`
- Modify: `apps/backend/app/state.py`

**Step 1: Write the failing tests**

```python
def test_send_otp_respects_cooldown() -> None:
    service = build_otp_service()
    service.send_otp("u@example.com", requester_ip="1.1.1.1")
    with pytest.raises(ValueError, match="cooldown"):
        service.send_otp("u@example.com", requester_ip="1.1.1.1")
```

```python
def test_verify_otp_returns_one_time_token() -> None:
    service = build_otp_service()
    service.send_otp("u@example.com", requester_ip="1.1.1.1")
    token = service.verify_otp("u@example.com", "123456")
    assert token
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/backend; python -m pytest tests/test_otp_service.py -v`  
Expected: FAIL with missing service.

**Step 3: Write minimal implementation**

Implement:
- email-only guard (`OTP_CHANNEL` must be `email`)
- send path: registration existence check, cooldown, rate limit counters, challenge creation, outbox task creation
- verify path: attempt counting, lock/expiry checks, verified state transition, opaque token issuance
- consume token for register use (one-time)

**Step 4: Run tests to verify they pass**

Run: `cd apps/backend; python -m pytest tests/test_otp_service.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/otp_service.py apps/backend/app/state.py apps/backend/tests/test_otp_service.py
git commit -m "feat: implement otp domain service with one-time verification tokens"
```

### Task 7: Add auth API endpoints for send/verify OTP and gate register with token

**Files:**
- Modify: `apps/backend/app/routes/auth.py`
- Modify: `apps/backend/app/services/auth_service.py`
- Modify: `apps/backend/tests/test_identity_access_acceptance.py`
- Create: `apps/backend/tests/test_auth_otp_api.py`

**Step 1: Write the failing API tests**

```python
def test_send_otp_returns_202_accepted() -> None:
    client = TestClient(app)
    res = client.post("/auth/email/send-otp", json={"email": "new@example.com"})
    assert res.status_code == 202
```

```python
def test_register_requires_verification_token() -> None:
    client = TestClient(app)
    res = client.post("/auth/register", json={"username": "new@example.com", "password": "pass1"})
    assert res.status_code == 400
    assert res.json()["detail"] == "verification_required"
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/backend; python -m pytest tests/test_auth_otp_api.py tests/test_identity_access_acceptance.py -v`  
Expected: FAIL with missing endpoint and missing verification check.

**Step 3: Write minimal implementation**

Implement route contracts:
- `POST /auth/email/send-otp`
- `POST /auth/email/verify-otp`
- extend register payload with `verification_token`
- map errors to deterministic statuses:
  - `409 user_exists`
  - `429 otp_rate_limited` + retry info
  - `400 verification_required|invalid_verification_token|expired_verification_token`

**Step 4: Run tests to verify they pass**

Run: `cd apps/backend; python -m pytest tests/test_auth_otp_api.py tests/test_identity_access_acceptance.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/auth.py apps/backend/app/services/auth_service.py apps/backend/tests/test_auth_otp_api.py apps/backend/tests/test_identity_access_acceptance.py
git commit -m "feat: add otp auth endpoints and enforce token-gated registration"
```

### Task 8: Implement outbox dispatcher to Redis Streams

**Files:**
- Create: `apps/backend/app/services/email_outbox_dispatcher.py`
- Create: `apps/backend/tests/test_email_outbox_dispatcher.py`
- Modify: `apps/backend/app/state.py`

**Step 1: Write the failing test**

```python
def test_dispatcher_pushes_pending_outbox_to_stream() -> None:
    redis = FakeRedis()
    dispatcher = EmailOutboxDispatcher(redis_client=redis, repo=repo)
    dispatched = dispatcher.dispatch_once(limit=10)
    assert dispatched == 1
    assert redis.xadd_calls[0]["stream"] == "email:outbox:stream"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_email_outbox_dispatcher.py -v`  
Expected: FAIL with missing dispatcher.

**Step 3: Write minimal implementation**

Implement:
- polling `pending` outbox rows
- push envelope to Redis Stream
- transition row to `processing` with lease timestamp

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_email_outbox_dispatcher.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/email_outbox_dispatcher.py apps/backend/app/state.py apps/backend/tests/test_email_outbox_dispatcher.py
git commit -m "feat: add outbox dispatcher to redis streams"
```

### Task 9: Implement SendGrid provider adapter and email worker

**Files:**
- Create: `apps/backend/app/services/email_provider.py`
- Create: `apps/backend/app/services/sendgrid_provider.py`
- Create: `apps/backend/workers/email_worker.py`
- Create: `apps/backend/tests/test_sendgrid_provider.py`
- Create: `apps/backend/tests/test_email_worker.py`

**Step 1: Write the failing tests**

```python
def test_sendgrid_provider_maps_success_response() -> None:
    provider = SendGridProvider(api_key="k", from_email="noreply@example.com", http_client=FakeHttp())
    result = provider.send(...)
    assert result.accepted is True
```

```python
def test_email_worker_marks_outbox_sent_and_logs_delivery() -> None:
    worker = EmailWorker(...)
    worker.handle_message({"outbox_id": "...", "email_type": "otp"})
    assert repo.get_status(...) == "sent"
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/backend; python -m pytest tests/test_sendgrid_provider.py tests/test_email_worker.py -v`  
Expected: FAIL with missing provider/worker.

**Step 3: Write minimal implementation**

Implement:
- provider abstraction (`send(template_name, recipient, payload)`)
- SendGrid adapter with API key auth header
- worker logic: load outbox task -> send -> update status/log -> retry policy

**Step 4: Run tests to verify they pass**

Run: `cd apps/backend; python -m pytest tests/test_sendgrid_provider.py tests/test_email_worker.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/email_provider.py apps/backend/app/services/sendgrid_provider.py apps/backend/workers/email_worker.py apps/backend/tests/test_sendgrid_provider.py apps/backend/tests/test_email_worker.py
git commit -m "feat: add sendgrid adapter and email worker pipeline"
```

### Task 10: Add SendGrid webhook endpoint and event write-back

**Files:**
- Create: `apps/backend/app/routes/email_webhooks.py`
- Create: `apps/backend/app/services/email_webhook_service.py`
- Modify: `apps/backend/app/main.py`
- Create: `apps/backend/tests/test_sendgrid_webhook_api.py`

**Step 1: Write the failing API test**

```python
def test_sendgrid_webhook_writes_delivery_events() -> None:
    client = TestClient(app)
    res = client.post("/email/webhooks/sendgrid", json=[{"event": "delivered", "sg_message_id": "m1"}])
    assert res.status_code == 202
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_sendgrid_webhook_api.py -v`  
Expected: FAIL because route does not exist.

**Step 3: Write minimal implementation**

Implement:
- webhook signature verification helper
- accept MVP events: `delivered|bounce|dropped|deferred`
- map event to `email_delivery_logs` and outbox final status

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_sendgrid_webhook_api.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/email_webhooks.py apps/backend/app/services/email_webhook_service.py apps/backend/app/main.py apps/backend/tests/test_sendgrid_webhook_api.py
git commit -m "feat: add sendgrid webhook write-back endpoint"
```

### Task 11: Add notification domain service method (no trigger binding yet)

**Files:**
- Create: `apps/backend/app/services/notification_email_service.py`
- Create: `apps/backend/tests/test_notification_email_service.py`
- Modify: `apps/backend/app/state.py`

**Step 1: Write the failing test**

```python
def test_notification_service_creates_outbox_task_with_idempotency() -> None:
    service = NotificationEmailService(outbox_repo=repo)
    task = service.queue_notification(
        recipient="u@example.com",
        template_name="risk_alert",
        payload={"score": 98},
        idempotency_key="notify:risk_alert:u@example.com:20260323",
    )
    assert task.email_type == "notification"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_notification_email_service.py -v`  
Expected: FAIL with missing service.

**Step 3: Write minimal implementation**

Implement a single service method:
- validates payload/template presence
- creates outbox row with `email_type=notification`
- does not define business trigger sources in MVP

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_notification_email_service.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/notification_email_service.py apps/backend/app/state.py apps/backend/tests/test_notification_email_service.py
git commit -m "feat: add notification email service capability layer"
```

### Task 12: Update frontend register flow for email OTP verification

**Files:**
- Modify: `apps/frontend/src/features/auth/api/types.ts`
- Modify: `apps/frontend/src/features/auth/api/auth.ts`
- Modify: `apps/frontend/src/features/auth/validation/auth-schema.ts`
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.tsx`
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.test.tsx`

**Step 1: Write the failing UI tests**

```tsx
it("requests OTP before allowing register submit", async () => {
  renderLoginPage();
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
  expect(await screen.findByLabelText(/otp code/i)).toBeInTheDocument();
});
```

```tsx
it("submits register with verification token", async () => {
  // mock send-otp and verify-otp responses then assert register payload includes verification_token
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/frontend; npm.cmd run test -- src/features/auth/pages/LoginPage.test.tsx`  
Expected: FAIL because page has no OTP flow yet.

**Step 3: Write minimal implementation**

Implement register UX:
- register form uses `email` field instead of username
- add `Send OTP` and `Verify OTP` actions
- store returned `verification_token` in local form state
- include `verification_token` in register API payload
- show cooldown/rate-limit backend errors

**Step 4: Run test to verify it passes**

Run: `cd apps/frontend; npm.cmd run test -- src/features/auth/pages/LoginPage.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/api/types.ts apps/frontend/src/features/auth/api/auth.ts apps/frontend/src/features/auth/validation/auth-schema.ts apps/frontend/src/features/auth/pages/LoginPage.tsx apps/frontend/src/features/auth/pages/LoginPage.test.tsx
git commit -m "feat(frontend): add email otp verification register flow"
```

### Task 13: Add docs and operations runbook for OTP/email services

**Files:**
- Modify: `apps/backend/README.md`
- Create: `apps/backend/docs/otp-email-ops.md`
- Modify: `docs/plans/2026-03-23-otp-verification-and-notification-service-design.md`

**Step 1: Write the failing docs check**

```python
from pathlib import Path


def test_otp_email_ops_doc_exists() -> None:
    assert Path("docs/otp-email-ops.md").exists()
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_migration_metadata.py -k otp_email_ops_doc_exists -v`  
Expected: FAIL (new check not added yet).

**Step 3: Write minimal implementation**

Document:
- env vars
- local run commands for dispatcher and worker
- SendGrid webhook signature setup
- failure triage (outbox backlog, provider errors, replay policy)

**Step 4: Run docs-focused checks**

Run: `cd apps/backend; python -m pytest tests/test_migration_metadata.py -v`  
Expected: PASS after adding the metadata assertion.

**Step 5: Commit**

```bash
git add apps/backend/README.md apps/backend/docs/otp-email-ops.md docs/plans/2026-03-23-otp-verification-and-notification-service-design.md apps/backend/tests/test_migration_metadata.py
git commit -m "docs: add otp email ops runbook and integration notes"
```

## Final Verification Gate

Run backend suite:

```bash
cd apps/backend
python -m pytest -v
```

Expected:
- New OTP/email tests pass.
- Existing auth/billing/realtime tests remain green.

Run frontend auth-focused checks:

```bash
cd apps/frontend
npm.cmd run test -- src/features/auth/pages/LoginPage.test.tsx
npm.cmd run typecheck
```

Expected:
- Register-with-OTP flow tests pass.
- No TypeScript type regressions.

## Execution Log

- [x] Task 1 completed: OTP/email config defaults + config test added.
- [x] Task 2 completed: OTP/outbox/delivery ORM models + schema tests.
- [x] Task 3 completed: Alembic migration for OTP/email tables + migration metadata test.
- [x] Task 4 completed: OTP crypto primitives + security hardening fixes + tests.
- [x] Task 5 completed: repositories for OTP/token/outbox/delivery + concurrency fixes + tests.
- [x] Task 6 completed: `OtpService` send/verify/consume + state wiring + expanded tests.
- [x] Task 7 completed: auth OTP APIs + register verification gate + email-only registration alignment + affected test updates.
- [x] Task 8 completed: outbox dispatcher + claim/processing/failure handling + dispatcher tests.
- [x] Task 9 completed: SendGrid adapter + email worker + tests.
- [x] Task 10 completed: SendGrid webhook endpoint + write-back service + tests.
- [x] Task 11 completed: Notification domain service method + tests.
- [x] Gap fix completed: `429` now includes `retry_after_seconds` for OTP throttle responses.
- [x] Gap fix completed: dispatcher stale `processing` recovery path added.
- [ ] Task 12 pending: Frontend OTP register flow alignment.
- [x] Task 13 completed: backend/docs ops runbook updates.
