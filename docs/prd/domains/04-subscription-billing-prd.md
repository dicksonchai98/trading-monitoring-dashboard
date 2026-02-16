# Domain PRD: Subscription and Billing (Mock)

- Domain: Subscription & Billing
- Version: v1.0
- Date: 2026-02-16
- Parent: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain Goal
Implement a single-plan subscription lifecycle using intent creation and mock webhook callback, preparing contracts for future real payment integration.

## 2. In Scope (MVP)
1. Single plan definition.
2. Subscription intent creation.
3. Mock webhook callback endpoint.
4. Subscription state transition to active.

## 3. Out of Scope (MVP)
1. Real payment provider integration.
2. Multi-plan pricing and coupon logic.
3. Invoice/tax processing.

## 4. Public Interfaces
1. Subscription intent endpoint
- `POST /subscriptions/intent`

2. Mock webhook endpoint
- `POST /subscriptions/mock-webhook`

## 5. Processing Rules
1. Intent is persisted before any activation flow.
2. Mock webhook must validate internal secret/signature.
3. State transitions must be idempotent.

## 6. Failure Modes
1. Duplicate webhook callback.
- Action: idempotent no-op update.

2. Invalid webhook signature.
- Action: reject request and log security event.

## 7. Observability
1. Intent creation count.
2. Webhook success/failure count.
3. Subscription activation rate.

## 8. Test Scenarios
1. Intent creation returns expected response and persistence.
2. Valid webhook activates subscription.
3. Duplicate webhook remains consistent.
4. Invalid webhook is rejected.

## 9. Acceptance Criteria
1. Intent -> webhook -> active state works end-to-end.
2. Subscription state is consistent under retry/replay conditions.
