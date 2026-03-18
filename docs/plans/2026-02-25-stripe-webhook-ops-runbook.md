# Stripe Webhook Ops Runbook (MVP)

## Scope

Operational handling for Stripe subscription webhook ingestion at `POST /billing/webhooks/stripe`.

## Retry and Duplicate Behavior

1. Stripe may redeliver the same event multiple times.
2. Backend deduplicates on `stripe_event_id` and marks duplicate events as `ignored`.
3. Non-2xx responses trigger Stripe retries; verify server logs and billing event status before manual replay.

## Incident Triage

1. Verify webhook secret and signature mismatch errors.
2. Inspect `billing_events` status distribution (`processed`, `ignored`, `failed`).
3. For `failed` events, identify parsing/transition errors and patch handling logic if required.
4. Replay events from Stripe Dashboard after fix deployment.
5. Confirm subscription status and entitlement alignment via `GET /billing/status`.

## Recovery Checklist

1. Fix configuration/code issue.
2. Deploy fix.
3. Replay failed events in Stripe test mode first.
4. Confirm no repeated failures and no unexpected state regressions.

## Migration / Rollback Notes

1. Schema is additive (`users.stripe_customer_id`, `subscriptions`, `billing_events`) and safe for forward rollout.
2. Rollback path:
   - Disable webhook endpoint routing at deployment layer if needed.
   - Revert service deployment.
   - Keep additive schema in place unless explicit data rollback is required.
