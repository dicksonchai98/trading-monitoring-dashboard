## Why

The backend currently lacks a complete, enforceable identity and access baseline for authentication, token lifecycle, and role-based authorization. We need this now to secure protected trading dashboard APIs and make access behavior testable and deterministic before broader feature rollout.

## What Changes

- Add backend implementation scaffolding for auth/rbac delivery (FastAPI app layout, route modules, auth middleware hooks, and test harness baseline) because the current repository state has only backend scaffolds and no module-level implementation targets.
- Add backend authentication flows for register/login with JWT access tokens and refresh-token cookie issuance.
- Add refresh-token rotation with denylist invalidation semantics for old refresh token JTIs.
- Define and enforce RBAC authorization for REST and SSE endpoints using the route permission matrix.
- Standardize auth/authorization error behavior for unauthenticated, expired/tampered token, and insufficient-role scenarios.
- Add backend acceptance tests covering login/register, refresh rotation, route protection, admin-only restrictions, and SSE authorization behavior.

## Capabilities

### New Capabilities

- `identity-authentication`: Registration, login, token issuance, and secure refresh-token handling for identity flows.
- `token-refresh-rotation`: Refresh-token rotation, denylist invalidation, and refresh validation contract.
- `rbac-route-authorization`: Role-based access rules for REST and SSE routes, including admin-only enforcement and expected 401/403 behavior.
- `identity-access-acceptance-tests`: End-to-end backend acceptance criteria and scenarios for auth, refresh, and RBAC protections.

### Modified Capabilities

- `identity-access-prd`: Update requirement-level route protection, token policy, and authorization outcomes to align with login/register + refresh + RBAC backend scope.

## Impact

- Affected project structure: backend app/module scaffolding and test scaffolding needed to host auth/rbac implementation.
- Affected backend modules: auth services, token utilities, middleware/guards, RBAC policy layer, and route handlers (Auth, Billing, Realtime, Analytics, Admin).
- Affected API/security behavior: Authorization header validation, HttpOnly refresh cookie policy, token TTL/rotation semantics, and 401/403 response contracts.
- Affected testing: Integration and acceptance coverage for identity and access control paths, including protected SSE endpoint authorization.
