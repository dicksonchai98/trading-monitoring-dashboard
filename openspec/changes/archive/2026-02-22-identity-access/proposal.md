## Why

The identity and access PRD is currently incomplete and does not provide a testable contract for API authorization behavior. We need to formalize auth routes, RBAC rules, token lifecycle, and failure handling now so implementation can proceed without ambiguous security decisions.

## What Changes

- Define domain-grouped Identity & Access API interfaces in the PRD, including auth, billing, realtime SSE, analytics, and admin endpoints.
- Specify JWT + refresh-token flow, including token TTLs, cookie transport policy, rotation behavior, and denylist-based revocation.
- Add a role access matrix for `visitor`, `user`, and `admin` across public, protected, and admin-only endpoints.
- Document authorization and authentication failure modes with explicit 401/403 behavior and security logging requirements.
- Add observability and test scenario requirements for auth flows, RBAC enforcement, and SSE authorization.
- Keep scope doc-only: update `docs/prd/domains/03-identity-access-prd.md` and do not modify other domain PRDs.

## Capabilities

### New Capabilities

- `identity-access-prd`: Defines normative Identity & Access product requirements, including route-level RBAC, token handling, failure semantics, observability, and acceptance tests.

### Modified Capabilities

- None.

## Impact

- Affected spec artifacts: `openspec/changes/identity-access/specs/identity-access-prd/spec.md` (new).
- Affected product documentation: `docs/prd/domains/03-identity-access-prd.md`.
- Affected implementation planning inputs: backend auth middleware, API authorization, SSE guards, and telemetry/test coverage expectations.
- No runtime code or external dependency changes in this change; this is a requirements-definition update.
