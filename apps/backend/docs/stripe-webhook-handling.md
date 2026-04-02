# Stripe Webhook Handling Guide

This document describes how the backend currently handles Stripe webhook events at:

- `POST /billing/webhooks/stripe`

Implementation reference:

- `app/routes/billing.py`
- `app/services/billing_service.py`
- `app/repositories/billing_event_repository.py`

## 1. Request Validation and Idempotency

Before any business logic, the backend applies these checks:

1. `Stripe-Signature` header must exist.
2. Signature must be valid (`stripe.Webhook.construct_event`).
3. Webhook payload must contain valid `event.id` and `event.type`.
4. Event idempotency uses `stripe_event_id` unique key in `billing_events`.
5. Duplicate `event.id` with a different payload hash is treated as `invalid_event`.

Possible outcomes:

- `invalid_signature` -> HTTP `400`
- `invalid_event` -> HTTP `400`
- duplicate `event.id` -> HTTP `200` with `{"status":"ignored"}`
- duplicate `event.id` + different payload -> HTTP `400` with `{"detail":"invalid_event"}`
- internal processing error -> HTTP `500` with `{"detail":"billing_error"}`

## 2. Events Actively Handled

These event types are recognized and can mutate subscription state:

1. `checkout.session.completed`
2. `invoice.paid`
3. `invoice.payment_failed`
4. `customer.subscription.deleted`
5. `customer.subscription.updated`
6. `checkout.session.expired`

### 2.1 `checkout.session.completed`

Purpose:

- Activate subscription after successful checkout completion.

Expected source fields:

- `data.object.metadata.user_id` (preferred)
- fallback: `data.object.customer` -> map to internal user
- `data.object.subscription`
- optional `data.object.current_period_end`

State behavior:

- transition target: `active`
- sets `entitlement_active = true`
- writes audit event `subscription_status_changed`

Possible cases:

- `user_id` exists and valid -> processed
- no `user_id`, but customer can map to user -> processed
- user not found / customer not mapped -> ignored
- invalid transition (for example already `canceled`) -> ignored

### 2.2 `invoice.paid`

Purpose:

- Keep subscription in healthy paid state.

Expected source fields:

- `data.object.subscription`
- optional `data.object.customer`
- optional `data.object.current_period_end`

State behavior:

- transition target: `active`
- sets `entitlement_active = true`
- writes audit event `subscription_status_changed`

Possible cases:

- known subscription id + valid transition -> processed
- unknown subscription id -> ignored
- invalid transition -> ignored

### 2.3 `invoice.payment_failed`

Purpose:

- Mark subscription as payment overdue.

Expected source fields:

- `data.object.subscription`
- optional `data.object.customer`
- optional `data.object.current_period_end`

State behavior:

- transition target: `past_due`
- sets `entitlement_active = false`
- writes audit event `subscription_status_changed`

Possible cases:

- known subscription id + valid transition -> processed
- unknown subscription id -> ignored
- invalid transition -> ignored

### 2.4 `customer.subscription.deleted`

Purpose:

- Cancel subscription and revoke entitlement.

Expected source fields:

- `data.object.id` (Stripe subscription id)

State behavior:

- transition target: `canceled`
- sets `entitlement_active = false`
- writes audit event `subscription_status_changed`

Possible cases:

- known subscription id + valid transition -> processed
- unknown subscription id -> ignored
- invalid transition -> ignored

### 2.5 `customer.subscription.updated`

Purpose:

- Synchronize local subscription status with Stripe status changes.

Expected source fields:

- `data.object.id` (Stripe subscription id)
- `data.object.status`
- optional `data.object.customer`
- optional `data.object.current_period_end`

State behavior:

- `active` / `trialing` -> local `active` + entitlement true
- `past_due` / `unpaid` / `incomplete` -> local `past_due` + entitlement false
- `canceled` / `incomplete_expired` -> local `canceled` + entitlement false

### 2.6 `checkout.session.expired`

Purpose:

- Ensure abandoned checkout sessions remain non-entitled.

Expected source fields:

- `data.object.metadata.user_id` (preferred)
- fallback: `data.object.customer` -> map to internal user

State behavior:

- target status: `pending`
- sets `entitlement_active = false`
- ignored when current status is already `active`

## 3. Stripe Events That May Arrive But Are Not Used

Stripe often sends additional events during checkout. Examples seen in logs:

- `payment_method.attached`
- `customer.created`
- `customer.updated`
- `customer.subscription.created`
- `setup_intent.created`
- `setup_intent.succeeded`
- `invoice.created`
- `invoice.finalized`
- `invoice.payment_succeeded`

Current behavior:

- these events are accepted and stored for idempotency tracking
- business state is not changed
- result is `{"status":"ignored"}` with HTTP `200`

This is expected and safe for MVP.

## 4. Subscription State Transition Rules

Current allowed transitions:

- `pending` -> `active`, `past_due`, `canceled`
- `active` -> `past_due`, `canceled`
- `past_due` -> `active`, `canceled`
- `canceled` -> (no transitions)

If an event implies a disallowed transition, it is ignored.

## 5. Data Side Effects

For each unique event id:

1. Insert billing event row with temporary status `processing`
2. Apply lifecycle logic
3. Mark event status:
   - `processed` if lifecycle applied
   - `ignored` if valid but no state change needed
   - `failed` if exception occurs during processing

Related tables:

- `billing_events`
- `subscriptions`
- `users` (`stripe_customer_id`)

## 6. Operational Troubleshooting

If Stripe CLI shows webhook delivery failure:

1. Ensure backend is running on the forwarded host/port.
2. Ensure route is correct: `/billing/webhooks/stripe`.
3. Ensure `STRIPE_WEBHOOK_SECRET` matches current `stripe listen` session.
4. Check app logs for `invalid_signature`, `invalid_event`, or `billing_error`.

If events return `200` but no state change:

1. Confirm event type is one of the 6 handled lifecycle events.
2. Check whether subscription id/user mapping exists.
3. Check if transition is disallowed by current state.
4. Check `billing_events.status` to distinguish `processed` vs `ignored`.
