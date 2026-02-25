## Why

The current MVP planning artifacts define subscription activation via internal mock webhook. Product direction has changed to implement Stripe directly in MVP while keeping single-plan scope and RBAC entitlement linkage.

## What Changes

- Replace mock subscription flow references with Stripe Checkout + Webhook flow in design/PRD docs.
- Define Stripe webhook-driven subscription lifecycle (`active`, `past_due`, `canceled`) and idempotent event handling.
- Add MVP support for Customer Portal session creation.
- Add a dedicated TRD for backend implementation details and migration from mock.

## Capabilities

### New Capabilities
- `subscription-billing-prd`: Stripe-based checkout/webhook lifecycle for single-plan MVP subscription.

### Modified Capabilities
- `identity-access-prd`: billing route inventory remains domain-grouped and now includes Stripe provider endpoints.

## Impact

- Documentation updates in:
  - `docs/plans/2026-02-16-futures-dashboard-design.md`
  - `docs/prd/2026-02-16-futures-dashboard-master-prd.md`
  - `docs/prd/2026-02-16-futures-dashboard-prd.md`
  - `docs/prd/domains/04-subscription-billing-prd.md`
  - `docs/plans/2026-02-25-stripe-subscription-trd.md`
- Backend subscription/billing implementation plan should follow Stripe webhook as source of truth.
