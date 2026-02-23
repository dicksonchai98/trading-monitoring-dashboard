## Context

This change introduces backend identity and access foundations for authentication, refresh-token lifecycle, and RBAC enforcement across REST and SSE endpoints. The current state lacks a single enforceable contract for route protection, token rotation, and standardized authorization outcomes, which creates inconsistent security behavior and weak acceptance coverage.

Constraints:
- Keep to MVP backend scope for register/login, refresh, RBAC matrix, and acceptance criteria.
- Maintain secure cookie-based refresh handling (HttpOnly, Secure, SameSite=Strict).
- Enforce authorization in backend regardless of frontend guard behavior.
- Align with existing spec-driven workflow and existing `identity-access-prd` capability.
- Current repository state does not yet contain backend module-level implementation files for auth/rbac routes; scaffolding is a prerequisite for this change.

Stakeholders:
- Backend API maintainers (auth, middleware, routes)
- Frontend consumers relying on consistent 401/403 behavior
- QA/automation owners responsible for acceptance test coverage

## Goals / Non-Goals

**Goals:**
- Define a single technical approach for issuing and validating `access_token` and rotating `refresh_token`.
- Enforce route-level RBAC for Auth/Billing/Realtime/Analytics/Admin endpoints with explicit role outcomes.
- Reuse one authorization policy path for REST and protected SSE endpoints.
- Standardize failure semantics (expired/tampered token, denylisted refresh token, insufficient role) and map them to deterministic 401/403 outcomes.
- Provide a design baseline that unblocks specs and implementation tasks for auth/rbac backend work.

**Non-Goals:**
- Introducing SSO, OAuth providers, MFA, or passwordless flows.
- Implementing a dedicated logout endpoint in this MVP.
- Redesigning non-identity domain APIs outside listed route groups.
- Treating frontend route guards as a security boundary.

## Decisions

1. Use split token strategy: short-lived access token + rotating refresh token in secure cookie.
Rationale:
- Limits blast radius of leaked access tokens.
- Supports silent session continuation via refresh endpoint.
Alternative considered:
- Single long-lived JWT. Rejected due to higher compromise window and weak revocation control.

2. Enforce refresh-token rotation with denylist on old refresh `jti`.
Rationale:
- Prevents replay of previously used refresh tokens.
- Creates explicit server-side invalidation behavior without global session state complexity.
Alternative considered:
- Non-rotating refresh token with expiry-only checks. Rejected because replay remains valid until expiry.

3. Centralize RBAC checks in shared authz middleware/policy and apply to both REST and SSE.
Rationale:
- Keeps authorization rules consistent across transport types.
- Reduces drift between endpoint-level ad hoc checks.
Alternative considered:
- Per-route inline role checks. Rejected due to duplication and inconsistent behavior risk.

4. Adopt the route permission matrix as the source of truth for authorization outcomes.
Rationale:
- Makes protected/public/admin-only contracts explicit and testable.
- Enables direct mapping between specification requirements and acceptance tests.
Alternative considered:
- Implicit route security by convention. Rejected because it is hard to verify and easy to regress.

5. Keep admin provisioning out-of-band (pre-provisioned in DB) for MVP.
Rationale:
- Avoids coupling identity bootstrap complexity to current delivery scope.
- Preserves focus on login/register + refresh + RBAC enforcement.
Alternative considered:
- Self-service admin escalation endpoints. Rejected due to elevated security risk and larger scope.

6. Add minimal backend scaffolding as an explicit prerequisite in this change.
Rationale:
- The current repository has backend build scaffolds but lacks implementation modules and route handlers required by planned tasks.
- Making scaffolding explicit avoids hidden prerequisites and reduces apply-time blocking.
Alternative considered:
- Keep scaffolding implicit and start from auth tasks directly. Rejected because task 1.1 has no concrete implementation targets without base modules.

## Risks / Trade-offs

- [Refresh token theft despite HttpOnly cookie] -> Mitigation: enforce Secure + SameSite=Strict, short refresh TTL, rotation with denylist, and monitor suspicious refresh patterns.
- [Role drift between issued claims and persisted user role] -> Mitigation: define claim-refresh strategy and validate role source at authz boundary where required.
- [Inconsistent SSE authorization handling] -> Mitigation: route SSE through the same authn/authz middleware contract used by REST protections.
- [Operational overhead of denylist storage growth] -> Mitigation: TTL-indexed denylist entries and background cleanup aligned with refresh expiry window.
- [Behavior regressions in route protection] -> Mitigation: acceptance tests mapped directly to public/protected/admin matrix and unauthorized scenarios.

## Migration Plan

1. Establish backend implementation scaffolding for auth/rbac modules, route groups, middleware wiring points, and test harness baseline.
2. Add or align auth/token service interfaces for issue/verify/rotate operations.
3. Introduce RBAC policy mapping for all routes in scope and wire middleware to route groups.
4. Enable refresh endpoint validation against JWT + denylist and old-token invalidation on successful rotation.
5. Update route handlers to use centralized authn/authz path for REST and SSE.
6. Add/expand acceptance tests for login/register, refresh rotation, and RBAC matrix.
7. Rollout behind normal deployment; rollback by reverting route guard wiring and refresh rotation enforcement changes as one unit.

## Open Questions

- Should role changes invalidate all existing refresh tokens immediately, or only apply on next refresh?
- Do we need explicit audit log event taxonomy for auth failures beyond admin endpoint access violations in MVP?
- Is additional CI policy enforcement required to ensure all new protected routes are registered in the RBAC matrix?
