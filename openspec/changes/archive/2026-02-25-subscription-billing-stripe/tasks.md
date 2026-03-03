## 1. Align Baseline Documentation

- [ ] 1.1 Update MVP design baseline from mock subscription flow to Stripe flow.
- [ ] 1.2 Update master PRD and product PRD to reflect Stripe checkout/webhook lifecycle.
- [ ] 1.3 Update subscription domain PRD API contracts and status model.

## 2. Add Technical Requirement Document (TRD)

- [ ] 2.1 Add Stripe subscription TRD under `docs/plans/`.
- [ ] 2.2 Document API contracts, webhook event mapping, idempotency strategy, and migration steps.

## 3. Define OpenSpec Requirements

- [ ] 3.1 Add capability spec for Stripe-based subscription billing MVP.
- [ ] 3.2 Define required behaviors for webhook verification, status transitions, and RBAC entitlement sync.
- [ ] 3.3 Define failure semantics and observability requirements.

## 4. Readiness Check

- [ ] 4.1 Verify no remaining mock-flow statements in updated baseline docs.
- [ ] 4.2 Record unresolved Stripe rollout decisions as open questions.
