## ADDED Requirements

### Requirement: Subscription billing MVP SHALL use Stripe checkout and webhook lifecycle
The system SHALL implement single-plan subscription initiation using Stripe Checkout and SHALL treat Stripe webhook events as the authoritative source for subscription activation and status updates.

#### Scenario: Checkout session is created for authenticated member
- **WHEN** an authenticated `user` or `admin` calls `POST /billing/checkout`
- **THEN** the backend creates a Stripe Checkout Session in `subscription` mode
- **AND** returns a redirectable checkout URL

#### Scenario: Unauthenticated checkout request is denied
- **WHEN** an unauthenticated client calls `POST /billing/checkout`
- **THEN** the request is rejected with `401`

### Requirement: Stripe webhook endpoint SHALL verify signatures and process events idempotently
The system SHALL verify Stripe webhook signatures on `POST /billing/webhooks/stripe`. The system SHALL persist Stripe event IDs and MUST NOT apply duplicate state transitions for the same event ID.

#### Scenario: Invalid webhook signature is rejected
- **WHEN** webhook payload signature verification fails
- **THEN** the request is rejected with `400` (or equivalent failure status)
- **AND** an audit/observability event is recorded

#### Scenario: Duplicate Stripe event is ignored safely
- **WHEN** a webhook event with previously processed `event_id` is received
- **THEN** the handler returns success without reapplying subscription state changes

### Requirement: Subscription status and entitlements SHALL sync with Stripe lifecycle events
The system SHALL map Stripe events to subscription states and entitlement updates:
- `checkout.session.completed` -> `active` and entitlement enabled
- `invoice.paid` -> keep `active`
- `invoice.payment_failed` -> `past_due` and entitlement policy updated
- `customer.subscription.deleted` -> `canceled` and entitlement revoked

#### Scenario: Checkout completion activates entitlement
- **WHEN** a valid `checkout.session.completed` webhook is processed
- **THEN** the subscription becomes `active`
- **AND** the user entitlement is updated for protected features

#### Scenario: Payment failure downgrades access
- **WHEN** a valid `invoice.payment_failed` webhook is processed
- **THEN** the subscription becomes `past_due`
- **AND** access policy reflects downgraded entitlement

### Requirement: Billing management endpoints SHALL remain role-protected
`GET /billing/status` and `POST /billing/portal-session` SHALL require authentication (`user` or `admin`).

#### Scenario: Member can open customer portal
- **WHEN** an authenticated member calls `POST /billing/portal-session`
- **THEN** the backend returns a valid portal URL for the member's Stripe customer

#### Scenario: Visitor cannot access billing status
- **WHEN** an unauthenticated client calls `GET /billing/status`
- **THEN** the request is rejected with `401`

### Requirement: Observability for Stripe billing SHALL be measurable
The system SHALL expose operational signals for:
- checkout success/failure count
- webhook signature failure count
- webhook processing success/failure and latency
- subscription status distribution

#### Scenario: Metrics coverage is reviewable
- **WHEN** operational requirements are reviewed
- **THEN** each metric family above is explicitly listed with intent
