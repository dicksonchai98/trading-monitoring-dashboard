## ADDED Requirements

### Requirement: Stripe checkout session creation SHALL be available for subscribed roles
The system SHALL expose `POST /billing/checkout` for authenticated `user` and `admin` actors to create a Stripe Checkout Session for the configured single MVP price, and SHALL return `checkout_url` and `session_id`.

#### Scenario: Authenticated member creates checkout session
- **WHEN** an authenticated `user` or `admin` calls `POST /billing/checkout` with valid payload
- **THEN** the system returns `200` with `checkout_url` and `session_id` for Stripe-hosted checkout

#### Scenario: Unauthenticated client is rejected for checkout session creation
- **WHEN** an unauthenticated client calls `POST /billing/checkout`
- **THEN** the request is rejected with `401`

### Requirement: Stripe webhook ingestion SHALL enforce signature verification and idempotency
The system SHALL expose `POST /billing/webhooks/stripe` as a public endpoint that validates `Stripe-Signature` using configured webhook secret, SHALL process valid events idempotently by `stripe_event_id`, and SHALL persist event processing outcome.

#### Scenario: Valid signed webhook event is processed once
- **WHEN** a webhook request with valid signature and unseen `stripe_event_id` is received
- **THEN** the event is processed and recorded with status `processed`

#### Scenario: Duplicate webhook event is ignored deterministically
- **WHEN** a webhook request with valid signature and existing `stripe_event_id` is received again
- **THEN** the request is acknowledged and recorded as `ignored` without duplicate subscription side effects

#### Scenario: Invalid webhook signature is rejected
- **WHEN** a webhook request contains missing or invalid `Stripe-Signature`
- **THEN** the request is rejected with non-2xx response and no subscription state mutation

### Requirement: Subscription lifecycle SHALL synchronize from Stripe events
The system SHALL update subscription state and RBAC entitlement based on Stripe lifecycle events, including `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.deleted`.

#### Scenario: Checkout completion activates subscription
- **WHEN** `checkout.session.completed` is processed for a user subscription
- **THEN** subscription status becomes `active` and entitlement is granted

#### Scenario: Payment failure marks subscription as past due
- **WHEN** `invoice.payment_failed` is processed for an active subscription
- **THEN** subscription status becomes `past_due` and entitlement policy follows configured MVP downgrade behavior

#### Scenario: Subscription deletion cancels access
- **WHEN** `customer.subscription.deleted` is processed
- **THEN** subscription status becomes `canceled` and entitlement is revoked

### Requirement: Billing status API SHALL reflect Stripe-backed subscription truth
The system SHALL expose `GET /billing/status` for authenticated `user` and `admin` actors and SHALL return Stripe-synchronized subscription status and period metadata for the current user.

#### Scenario: Billing status returns active subscription details
- **WHEN** an authenticated member with active Stripe subscription calls `GET /billing/status`
- **THEN** the response includes `status=active`, `stripe_price_id`, and current period end information

#### Scenario: Billing status returns canceled state after deletion event
- **WHEN** a member subscription has been canceled by webhook lifecycle processing
- **THEN** `GET /billing/status` returns `status=canceled`

### Requirement: Customer portal session SHALL be available for authenticated subscribers
The system SHALL expose `POST /billing/portal-session` for authenticated `user` and `admin` actors with Stripe customer linkage and SHALL return a Stripe customer portal URL.

#### Scenario: Portal session URL is returned for linked customer
- **WHEN** an authenticated member with a valid Stripe customer mapping calls `POST /billing/portal-session`
- **THEN** the system returns `200` with `portal_url`

#### Scenario: Portal session request without customer linkage is handled deterministically
- **WHEN** an authenticated member without Stripe customer mapping calls `POST /billing/portal-session`
- **THEN** the request is rejected with a deterministic client error response
