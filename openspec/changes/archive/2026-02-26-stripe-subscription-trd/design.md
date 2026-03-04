## Context

This change implements Stripe-backed subscription billing for the MVP in the FastAPI modular-monolith backend, aligned with the existing architecture baseline in `docs/plans/2026-02-16-futures-dashboard-design.md` and the change proposal.

Current state:
- Billing and entitlement concepts exist, but concrete Stripe runtime behavior and webhook-driven lifecycle handling need to be codified and implemented as the operational path.
- RBAC remains backend-enforced source of truth, with auditability requirements for security-relevant actions.
- MVP scope is single-plan subscription with Checkout, webhook processing, and portal session support.

Constraints and stakeholders:
- Backend team owns API, event handling, and persistence boundaries.
- Frontend consumes checkout/portal URLs and billing status; no major UI workflow redesign is required.
- Security/reliability constraints: webhook signature validation, idempotent event handling, deterministic 401/403 behavior, and auditable admin/security actions.

## Goals / Non-Goals

**Goals:**
- Deliver end-to-end Stripe subscription flow for single-plan MVP:
  - `POST /billing/checkout`
  - `POST /billing/webhooks/stripe`
  - `GET /billing/status`
  - `POST /billing/portal-session`
- Ensure webhook processing is signature-verified, idempotent, and resilient to duplicate/out-of-order delivery.
- Persist required Stripe identifiers and billing event processing records in PostgreSQL.
- Keep subscription state and RBAC entitlements synchronized from Stripe lifecycle events.
- Preserve architecture boundaries (`billing`, `subscription`, `rbac_policy`, `audit`) and SSE/auth baseline behavior.

**Non-Goals:**
- Multi-plan pricing, metered billing, usage-based invoicing, or proration complexity.
- Historical billing analytics and reporting warehouse design.
- New payment provider abstraction beyond Stripe for this change.
- Expanded instrument coverage or unrelated market-data pipeline changes.

## Decisions

1. Use Stripe Checkout + Customer Portal as the only MVP subscription UX surface
- Decision: Backend generates Checkout/Portal sessions and returns URLs to client.
- Rationale: Minimizes frontend complexity and follows Stripe hosted flow best practices.
- Alternative considered: Fully custom payment form and subscription UI. Rejected due to PCI/compliance and higher implementation risk.

2. Webhook is the source of truth for subscription state transitions
- Decision: Treat webhook events as authoritative for `active`, `past_due`, and `canceled` transitions; checkout API creates intent but not final activation.
- Rationale: Aligns with asynchronous payment lifecycle and avoids false-positive activation.
- Alternative considered: Mark active immediately after checkout session creation. Rejected because payment completion is not guaranteed.

3. Enforce webhook authenticity and idempotency at ingestion boundary
- Decision: Verify `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`; persist `stripe_event_id` with unique constraint and processing status (`processed|ignored|failed`).
- Rationale: Prevents replay/forged events and provides deterministic duplicate handling.
- Alternative considered: In-memory dedupe only. Rejected due to process restarts and multi-instance inconsistency.

4. Split responsibilities across existing module boundaries
- Decision:
  - `billing` module: Stripe SDK calls, endpoint orchestration, webhook parsing/dispatch
  - `subscription` module: domain state machine and entitlement synchronization
  - `rbac_policy` module: entitlement policy resolution
  - `audit` module: security-relevant and admin-relevant event records
- Rationale: Keeps modular monolith boundaries clear and testable.
- Alternative considered: Single large billing service owning all concerns. Rejected due to coupling and reduced maintainability.

5. Database model keeps Stripe mapping explicit on subscription entities
- Decision: Persist `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `current_period_end`, and status in subscription data; keep billing event table for webhook ledger.
- Rationale: Supports status reconciliation, troubleshooting, and deterministic reprocessing behavior.
- Alternative considered: Store raw Stripe payload only and derive all state on read. Rejected due to runtime complexity and weak operational clarity.

6. Failure semantics remain explicit and deterministic
- Decision:
  - Invalid/missing auth for protected billing routes: `401/403` per current policy
  - Invalid webhook signature: reject request (non-2xx)
  - Duplicate known event id: return success with ignored outcome
- Rationale: Matches existing security baseline and prevents noisy retries for safe duplicates.
- Alternative considered: Always return error on duplicates. Rejected due to unnecessary webhook retries.

## Risks / Trade-offs

- [Webhook delivery order variance] -> Mitigation: state transitions guarded by current state + event type rules; ignore invalid backward transitions.
- [Duplicate webhook deliveries] -> Mitigation: unique `stripe_event_id` and idempotent processing outcome persisted in DB.
- [Operational coupling to Stripe availability] -> Mitigation: bounded timeouts, retry policy for outbound Stripe calls, and clear degraded responses for checkout/portal creation.
- [Schema drift between existing user data and Stripe customer data] -> Mitigation: deterministic customer lookup/create strategy keyed by internal user and unique email constraints.
- [Secret misconfiguration in environments] -> Mitigation: startup config validation and explicit deployment checklist for required Stripe env vars.

## Migration Plan

1. Add DB migration for subscription Stripe fields and `billing_event` ledger table with required unique indexes.
2. Introduce billing configuration contract for:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID`
   - `STRIPE_SUCCESS_URL`
   - `STRIPE_CANCEL_URL`
3. Implement checkout, webhook, billing-status, and portal-session endpoints behind existing auth/RBAC middleware.
4. Add webhook event mapping and subscription state machine integration.
5. Add/adjust tests (unit/integration/API/non-functional where applicable).
6. Deploy with Stripe webhook endpoint configuration in target environment.
7. Rollback strategy: disable webhook endpoint ingestion and billing routes via config flag/revert deployment; preserve DB changes as backward-compatible additive fields/tables.

## Open Questions

- Should `invoice.payment_failed` immediately downgrade entitlement or include a configurable grace window in MVP?
- Do we require explicit periodic reconciliation job with Stripe API in MVP, or defer to post-MVP?
- Should portal access be allowed for `past_due` subscriptions by policy, or restricted to `active` only?
- What is the expected retry/backoff policy for transient Stripe API failures in checkout/portal endpoints?
