## Why

The Identity & Access PRD needs to fully specify the MVP login/registration flow and its security guarantees so backend implementation and tests can be built against a clear, consistent contract. This aligns API routes, RBAC, and token handling with the agreed product scope.

## What Changes

- Define domain-grouped backend API routes for auth, billing, realtime SSE, analytics, and admin logs.
- Specify JWT issuance, refresh rotation, token TTLs, and transport policy (header + HttpOnly cookie).
- Define RBAC roles (`visitor`, `user`, `admin`) and the access matrix for public/protected/admin routes.
- Specify authorization failure semantics and required observability/test scenarios.
- Declare explicit out-of-scope items (logout endpoint, MFA, lockout, profile management).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `identity-access-prd`: update requirements for API routes, JWT/refresh flows, RBAC access matrix, security rules, observability, and test scenarios.

## Impact

- Documentation: `docs/prd/domains/03-identity-access-prd.md`
- Backend auth/authorization behavior will be implemented to match the updated PRD
- Test planning relies on the updated failure semantics and scenario list
