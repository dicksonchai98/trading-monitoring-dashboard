# Infrastructure

Local Docker Compose and environment templates for development and testing.

When adding compose files, reference the new app locations:
- `apps/frontend`
- `apps/backend`

## Stripe Billing Environment

Configure these backend environment variables before enabling Stripe billing routes:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_PORTAL_RETURN_URL` (optional; defaults to `STRIPE_SUCCESS_URL`)

Suggested env template:

- `infra/.env.backend.stripe.example`

Webhook endpoint to register in Stripe:

- `POST /billing/webhooks/stripe`

Recommended Stripe test-mode setup:

1. Set all variables above in the target environment.
2. Register the webhook endpoint and copy the webhook secret to `STRIPE_WEBHOOK_SECRET`.
3. Configure event subscriptions:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. Set webhook endpoint URL to `<backend-base-url>/billing/webhooks/stripe`.
