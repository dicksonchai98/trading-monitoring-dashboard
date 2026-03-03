## 1. Configuration and Data Model

- [x] 1.1 Add Stripe billing environment configuration contract (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`) with startup validation.
- [x] 1.2 Add database migration for subscription Stripe fields (`stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `current_period_end`, status indexes/constraints).
- [x] 1.3 Add `billing_event` persistence model/table with unique `stripe_event_id`, processing status, payload hash, and processed timestamp.
- [x] 1.4 Update ORM/repository mappings for subscription and billing event entities.

## 2. Billing API Endpoints

- [x] 2.1 Implement `POST /billing/checkout` for authenticated `user`/`admin` to create Stripe Checkout Session and return `checkout_url` and `session_id`.
- [x] 2.2 Implement Stripe customer lookup/create strategy for checkout and portal flows.
- [x] 2.3 Implement `GET /billing/status` to return Stripe-synchronized subscription status and period metadata.
- [x] 2.4 Implement `POST /billing/portal-session` for authenticated `user`/`admin` and return `portal_url` for linked Stripe customer.
- [x] 2.5 Enforce deterministic error responses for invalid auth and missing customer linkage paths.

## 3. Webhook Processing and Subscription Lifecycle

- [x] 3.1 Implement `POST /billing/webhooks/stripe` endpoint with raw-body signature verification using `STRIPE_WEBHOOK_SECRET`.
- [x] 3.2 Implement webhook idempotency guard using unique `stripe_event_id` and persisted processing outcomes (`processed|ignored|failed`).
- [x] 3.3 Map Stripe lifecycle events (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`) to subscription transitions.
- [x] 3.4 Implement subscription state machine guards for valid transitions (`pending`, `active`, `past_due`, `canceled`) including duplicate/out-of-order handling.
- [x] 3.5 Synchronize RBAC entitlement updates on subscription transition side effects.
- [x] 3.6 Add audit records for security-relevant/admin-relevant billing and entitlement mutations.

## 4. Identity Access Spec Alignment

- [x] 4.1 Update route registration and docs to include `POST /billing/webhooks/stripe` and `POST /billing/portal-session` in the identity/billing API inventory.
- [x] 4.2 Enforce and verify auth semantics (`401/403`) on protected billing routes.
- [x] 4.3 Enforce webhook invalid-signature rejection with non-2xx response and no state mutation.

## 5. Testing and Verification

- [x] 5.1 Add unit tests for webhook signature validation, event mapping, and subscription transition logic.
- [x] 5.2 Add unit tests for idempotency behavior (duplicate `stripe_event_id` -> ignored without duplicate side effects).
- [x] 5.3 Add integration test for checkout intent -> webhook processing -> entitlement synchronization.
- [x] 5.4 Add API tests for `POST /billing/checkout`, `GET /billing/status`, `POST /billing/portal-session`, and webhook endpoint behavior.
- [x] 5.5 Add negative tests for unauthorized access (`401/403`) and invalid webhook signatures.
- [x] 5.6 Run full backend test suite for affected modules and fix regressions.

## 6. Deployment and Operational Readiness

- [x] 6.1 Configure Stripe webhook endpoint in target environments with correct secret wiring.
- [x] 6.2 Add operational runbook for webhook retries, duplicate event handling, and incident triage.
- [x] 6.3 Validate migration/rollback procedure in staging with Stripe test mode data.

