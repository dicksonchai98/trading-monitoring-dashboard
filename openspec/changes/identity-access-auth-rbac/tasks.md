## 0. Backend Prerequisite Scaffolding

- [x] 0.1 Create backend implementation skeleton for domain route groups (`auth`, `billing`, `realtime`, `analytics`, `admin`) with FastAPI router registration points.
- [x] 0.2 Create auth/rbac baseline modules (token utility, auth middleware, RBAC policy map, security event hook) with no-op or minimal behavior needed to unblock task 1+ implementation.
- [x] 0.3 Create backend test harness baseline for API and acceptance tests (test app wiring, fixtures, and auth helper setup) required by section 5 tasks.

## 1. Auth and Token Foundations

- [x] 1.1 Add/align auth service interfaces for `register`, `login`, and `refresh` flows in backend modules.
- [x] 1.2 Implement access token issuance with 1-hour TTL and refresh token issuance with 7-day TTL.
- [x] 1.3 Set refresh token transport to secure cookie flags (`HttpOnly`, `Secure`, `SameSite=Strict`) on register/login responses.
- [x] 1.4 Ensure access token transport contract uses `Authorization` header validation in protected request pipeline.

## 2. Refresh Rotation and Denylist

- [x] 2.1 Implement refresh endpoint token validation path for JWT verification plus denylist `jti` lookup.
- [x] 2.2 Implement refresh rotation that issues new token pair and records previous refresh token `jti` in denylist.
- [x] 2.3 Reject denylisted or expired refresh tokens with `401` and prevent token minting on failure.
- [x] 2.4 Add denylist persistence cleanup strategy aligned with refresh token expiry window.

## 3. RBAC Enforcement Across REST and SSE

- [x] 3.1 Define centralized RBAC matrix mapping for public, protected (`user`/`admin`), and admin-only routes.
- [x] 3.2 Wire RBAC middleware/guards into Auth, Billing, Realtime, Analytics, and Admin route groups.
- [x] 3.3 Apply identical authn/authz policy checks to protected SSE endpoint handling.
- [x] 3.4 Enforce deterministic authorization outcomes: unauthenticated -> `401`, insufficient role -> `403`.

## 4. Error Semantics and Observability

- [x] 4.1 Map expired/tampered access token failures to `401` responses in auth middleware.
- [x] 4.2 Emit security event for non-admin access attempts to admin-only endpoints.
- [x] 4.3 Add/align metrics for login success/failure, refresh success/failure + denylist hits, authorization denial rate, and SSE auth failures.

## 5. Acceptance and Integration Testing

- [x] 5.1 Add acceptance test for successful register/login returning access token and secure refresh cookie.
- [x] 5.2 Add acceptance test for refresh rotation where old refresh token reuse fails with `401`.
- [x] 5.3 Add acceptance tests for anonymous access to public endpoints and `401` on protected endpoints without auth.
- [x] 5.4 Add acceptance test for `403` on admin endpoints when authenticated as non-admin.
- [x] 5.5 Add acceptance test for protected SSE endpoint unauthorized subscription rejection.

## 6. Spec and PRD Alignment

- [x] 6.1 Update identity domain PRD content at `docs/prd/domains/03-identity-access-prd.md` to reflect modified requirement deltas.
- [x] 6.2 Verify route matrix, token policy, and acceptance scenarios are consistent between implementation and OpenSpec capability specs.
- [x] 6.3 Perform end-to-end review to confirm this change satisfies all artifacts before archive/apply workflow.
