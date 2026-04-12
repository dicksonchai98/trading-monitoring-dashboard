# Stripe Subscription Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate Stripe subscription flow gaps by hardening key validation, lifecycle handling, idempotency, and plans output in local Docker workflow.

**Architecture:** Keep existing FastAPI route/service/repository layering and add guardrails at configuration and provider boundaries, then extend lifecycle handlers in `BillingService` with test-first changes. Preserve MVP scope by adding only essential Stripe event handling and deterministic idempotency checks, followed by docs/runbook updates for `docker-compose.yml` local operation.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pytest, Docker Compose, Stripe Python SDK

---

### Task 1: Enforce Stripe Key Validation at Startup and Provider Boundaries

**Files:**
- Modify: `apps/backend/app/config.py`
- Modify: `apps/backend/app/services/stripe_provider.py`
- Create/Modify: `apps/backend/tests/test_stripe_config_validation.py`

**Step 1: Write the failing tests**

```python
def test_validate_stripe_settings_rejects_publishable_key(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "pk_test_bad")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_ok")
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_ok")
    monkeypatch.setenv("STRIPE_SUCCESS_URL", "https://example.com/success")
    monkeypatch.setenv("STRIPE_CANCEL_URL", "https://example.com/cancel")
    with pytest.raises(RuntimeError):
        validate_stripe_settings()


def test_stripe_provider_rejects_non_secret_key():
    with pytest.raises(ValueError):
        StripeProvider(secret_key="pk_test_bad")
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_stripe_config_validation.py -q`  
Expected: FAIL because current code accepts `pk_` values.

**Step 3: Write minimal implementation**

```python
# config.py
if not settings.secret_key.startswith("sk_"):
    raise RuntimeError("invalid STRIPE_SECRET_KEY")

# stripe_provider.py
if not secret_key.startswith("sk_"):
    raise ValueError("Stripe secret key is invalid")
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_stripe_config_validation.py -q`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/app/services/stripe_provider.py apps/backend/tests/test_stripe_config_validation.py
git commit -m "fix: enforce stripe secret key validation"
```

### Task 2: Prevent Active Subscription Downgrade During Checkout

**Files:**
- Modify: `apps/backend/app/services/billing_service.py`
- Modify: `apps/backend/tests/test_billing_stripe_flow.py`

**Step 1: Write the failing test**

```python
def test_checkout_does_not_downgrade_active_subscription():
    # seed active subscription, call /billing/checkout, assert status remains active
    assert status_after["status"] == "active"
    assert status_after["entitlement_active"] is True
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py::test_checkout_does_not_downgrade_active_subscription -q -v`  
Expected: FAIL because checkout currently writes `pending`.

**Step 3: Write minimal implementation**

```python
current = self._subscriptions.get_by_user_id(user.id)
if current and current.status == "active":
    next_status = "active"
    next_entitlement = True
else:
    next_status = "pending"
    next_entitlement = False
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py::test_checkout_does_not_downgrade_active_subscription -q -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/billing_service.py apps/backend/tests/test_billing_stripe_flow.py
git commit -m "fix: keep active entitlement when creating checkout session"
```

### Task 3: Add Missing Stripe Lifecycle Events

**Files:**
- Modify: `apps/backend/app/services/billing_service.py`
- Modify: `apps/backend/tests/test_billing_stripe_flow.py`

**Step 1: Write failing tests**

```python
def test_customer_subscription_updated_updates_local_state():
    assert status["status"] in {"active", "past_due", "canceled"}


def test_checkout_session_expired_keeps_or_marks_pending_without_entitlement():
    assert status["entitlement_active"] is False
```

**Step 2: Run tests to verify failures**

Run:  
`cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py::test_customer_subscription_updated_updates_local_state -q -v`  
`cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py::test_checkout_session_expired_keeps_or_marks_pending_without_entitlement -q -v`  
Expected: FAIL because events are currently ignored.

**Step 3: Write minimal implementation**

```python
if event_type == "customer.subscription.updated":
    return self._handle_subscription_updated(obj)
if event_type == "checkout.session.expired":
    return self._handle_checkout_expired(obj)
```

Map Stripe status to local status conservatively (`active/past_due/canceled`) and set `entitlement_active` consistently.

**Step 4: Run tests to verify pass**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py -k "subscription_updated or session_expired" -q`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/billing_service.py apps/backend/tests/test_billing_stripe_flow.py
git commit -m "feat: handle subscription updated and checkout expired webhooks"
```

### Task 4: Strengthen Idempotency With Payload Hash Consistency Check

**Files:**
- Modify: `apps/backend/app/repositories/billing_event_repository.py`
- Modify: `apps/backend/app/services/billing_service.py`
- Modify: `apps/backend/tests/test_billing_stripe_flow.py`

**Step 1: Write failing test**

```python
def test_duplicate_event_id_with_different_payload_is_flagged():
    # first payload processed, second same event.id with different payload
    assert response.status_code in {400, 409}
```

**Step 2: Run test to verify failure**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py::test_duplicate_event_id_with_different_payload_is_flagged -q -v`  
Expected: FAIL because duplicate event IDs are always ignored.

**Step 3: Write minimal implementation**

```python
# repository returns enum-like result: created / duplicate_same / duplicate_conflict
# service maps duplicate_conflict to BillingError("invalid_event")
```

**Step 4: Run test to verify pass**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py::test_duplicate_event_id_with_different_payload_is_flagged -q -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/repositories/billing_event_repository.py apps/backend/app/services/billing_service.py apps/backend/tests/test_billing_stripe_flow.py
git commit -m "fix: detect webhook payload hash conflicts for duplicate event ids"
```

### Task 5: Return Real Plan Metadata From `/billing/plans`

**Files:**
- Modify: `apps/backend/app/routes/billing.py`
- Modify: `apps/backend/app/config.py` (only if extra fields are needed)
- Modify: `apps/backend/tests/test_billing_stripe_flow.py` or create `apps/backend/tests/test_billing_plans_api.py`

**Step 1: Write failing test**

```python
def test_plans_endpoint_returns_real_plan_fields():
    body = client.get("/billing/plans").json()
    plan = body["plans"][0]
    assert plan["id"] == "basic"
    assert plan["price_id"] == "price_local"
```

**Step 2: Run test to verify failure**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_plans_api.py -q -v`  
Expected: FAIL because endpoint currently returns placeholder `"stripe-configured"`.

**Step 3: Write minimal implementation**

```python
return {"plans": [{"id": "basic", "name": "Basic", "price_id": settings.price_id}]}
```

Extend fields only to what frontend currently needs (YAGNI).

**Step 4: Run test to verify pass**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_plans_api.py -q -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/billing.py apps/backend/tests/test_billing_plans_api.py
git commit -m "feat: return configured stripe plan metadata from billing plans endpoint"
```

### Task 6: Ensure Docker Compose Local Env Does Not Override Stripe Values Unexpectedly

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docs/plans/2026-04-02-stripe-subscription-hardening.md` (if decisions change)
- Modify: `apps/backend/docs/stripe-webhook-handling.md`

**Step 1: Write failing verification scenario**

Document and reproduce: host shell has stale `STRIPE_SECRET_KEY=pk_...` while `.env` has `sk_...`; container gets wrong key via `${STRIPE_SECRET_KEY:-...}`.

**Step 2: Run verification**

Run:  
`docker compose up -d --force-recreate backend-api`  
`docker compose exec backend-api printenv STRIPE_SECRET_KEY`  
Expected before fix: may show stale host value.

**Step 3: Write minimal implementation**

Prefer one source of truth in local compose:
- keep Stripe secrets in `env_file: ./.env`
- remove duplicate `STRIPE_*` key interpolation from `environment:` when not required

**Step 4: Re-run verification**

Run:  
`docker compose up -d --force-recreate backend-api`  
`docker compose exec backend-api printenv STRIPE_SECRET_KEY`  
Expected after fix: deterministic `sk_...` from `.env`.

**Step 5: Commit**

```bash
git add docker-compose.yml apps/backend/docs/stripe-webhook-handling.md
git commit -m "chore: make stripe env resolution deterministic in local compose"
```

### Task 7: Full Regression Sweep and Final Documentation Pass

**Files:**
- Modify: `apps/backend/docs/stripe-webhook-handling.md`
- Modify: `apps/backend/README.md` (if endpoint behavior contract changes)

**Step 1: Run targeted billing tests**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_billing_stripe_flow.py tests/test_stripe_config_validation.py tests/test_billing_plans_api.py -q`

Expected: PASS.

**Step 2: Run startup/config sanity check**

Run: `docker compose up -d --force-recreate backend-api` then `docker compose logs backend-api --tail 80`  
Expected: no Stripe config runtime error on boot with valid `sk_...`.

**Step 3: Update docs with exact behavior**

Add:
- newly handled event types
- key format requirements
- duplicate event-id hash mismatch behavior
- local compose env precedence notes

**Step 4: Final commit**

```bash
git add apps/backend/docs/stripe-webhook-handling.md apps/backend/README.md
git commit -m "docs: update stripe billing flow and troubleshooting guidance"
```

### Guardrails for Execution

- Follow @superpowers:test-driven-development for every code change (RED -> GREEN -> REFACTOR).
- Use @superpowers:verification-before-completion before claiming done.
- Keep commits small and frequent (one task, one commit).
- Do not expand billing scope beyond listed events/fields (YAGNI).

