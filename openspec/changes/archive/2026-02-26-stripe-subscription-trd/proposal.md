## Why

The project has already aligned on Stripe as the MVP billing direction, and now needs a concrete, production-oriented subscription implementation. This change enables real checkout, webhook-driven entitlement updates, and auditable subscription state transitions for the single-plan MVP.

## What Changes

- Add Stripe Checkout session creation for authenticated `user` and `admin` clients with a single configured price.
- Add Stripe webhook ingestion endpoint with signature verification, event idempotency, and deterministic processing outcomes.
- Add Customer Portal session creation for authenticated subscribers.
- Persist Stripe identifiers and billing event processing records in PostgreSQL.
- Drive subscription state transitions (`pending`, `active`, `past_due`, `canceled`) from Stripe events and sync RBAC entitlements.
- Extend billing status API behavior to reflect Stripe-backed subscription truth.
- Establish Stripe subscription execution as the MVP billing runtime path.

## Capabilities

### New Capabilities
- `stripe-billing-subscription`: Stripe Checkout, webhook, portal, and billing-event processing requirements for the MVP single-plan subscription flow.

### Modified Capabilities
- `identity-access-prd`: Update normative API surface and access-control requirements to include Stripe webhook and portal session endpoints, plus Stripe-backed billing lifecycle semantics for protected billing routes.

## Impact

- Backend modules: `billing_provider`/`billing`, `subscription`, `rbac_policy`, `audit`, and related API routers.
- Data model: subscription fields for Stripe customer/subscription IDs and billing event table for idempotent webhook handling.
- Infrastructure/config: Stripe secrets, webhook secret, price ID, and success/cancel URLs in environment configuration.
- API surface: `POST /billing/checkout`, `POST /billing/webhooks/stripe`, `GET /billing/status`, and `POST /billing/portal-session`.
- Testing: unit tests for webhook event mapping and idempotency, integration tests for checkout->webhook->entitlement flow, and API tests for auth/signature enforcement.

## References

- Stripe Docs - Build subscriptions: https://docs.stripe.com/billing/subscriptions/build-subscriptions
