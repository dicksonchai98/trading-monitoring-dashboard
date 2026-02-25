## Context

Subscription flow in baseline artifacts currently models an internal mock webhook. Stripe integration requires external provider events, signature verification, and event idempotency while preserving current RBAC and API route grouping.

## Goals / Non-Goals

**Goals:**
- Keep MVP as single-plan subscription, but execute with real Stripe checkout/webhooks.
- Use webhook events as the only activation source of truth.
- Preserve modular boundaries (`billing`, `subscription`, `audit`) and deterministic RBAC updates.

**Non-Goals:**
- Multi-plan billing model.
- Tax, invoices export, refunds, coupons.
- Production-grade provider failover or multi-provider abstraction.

## Decisions

- Use `POST /billing/checkout` to create Stripe Checkout Session (`mode=subscription`).
- Keep webhook endpoint as public (`POST /billing/webhooks/stripe`) and enforce signature validation.
- Persist processed Stripe event IDs for idempotency and replay protection.
- Treat `checkout.session.completed` and `invoice.paid` as activation/continuation signals.
- Treat `invoice.payment_failed` and `customer.subscription.deleted` as downgrade/cancel signals.
- Keep `GET /billing/status` and `POST /billing/portal-session` protected for authenticated users.

## Risks / Trade-offs

- External dependency (Stripe) increases integration complexity.
  - Mitigation: strict observability and explicit failure paths.
- Webhook delivery can be delayed or retried.
  - Mitigation: event idempotency table + transactional handler.
- Redirect success pages can be misinterpreted as payment success.
  - Mitigation: explicitly document webhook-only activation rule.

## Migration Plan

1. Update design + PRD artifacts to Stripe baseline.
2. Add Stripe env configuration and endpoint contracts.
3. Add billing event persistence for deduplication.
4. Cut over from mock flow and deprecate mock endpoint in implementation.

## Open Questions

- Whether to pin Stripe API version in code config explicitly in MVP.
- Whether trial periods are needed for the single plan.
