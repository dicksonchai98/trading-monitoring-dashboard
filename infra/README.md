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
- `infra/.env.backend.ingestor.example`

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

## Market Ingestor Environment

Configure these backend environment variables before enabling ingestor:

- `INGESTOR_ENABLED` (`true` or `false`)
- `INGESTOR_ENV` (`dev` / `prod`)
- `INGESTOR_CODE` (e.g. `MTX`)
- `INGESTOR_QUOTE_TYPES` (comma-separated, default `tick,bidask`)
- `INGESTOR_QUEUE_MAXSIZE`
- `INGESTOR_STREAM_MAXLEN`
- `INGESTOR_REDIS_RETRY_ATTEMPTS`
- `INGESTOR_REDIS_RETRY_BACKOFF_MS`
- `INGESTOR_SPOT_SYMBOLS_FILE` (default `infra/config/stock150.txt`)
- `INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT` (default `150`; set to current list size during staged rollout)
- `INGESTOR_SPOT_REQUIRED` (`false` by default; set `true` to fail fast when spot config is invalid)
- `REDIS_URL`
- `SHIOAJI_API_KEY`
- `SHIOAJI_SECRET_KEY`
- `SHIOAJI_SIMULATION`

Static symbol registry file for Phase 1:

- `infra/config/stock150.txt`
- one 4-digit TW stock symbol per line
- supports blank lines and `#` comment lines
- current project list is temporarily `156` symbols; set `INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT=156` until Phase 2 cleanup
