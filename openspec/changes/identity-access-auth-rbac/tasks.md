## 1. Auth and Token Foundations

- [ ] 1.1 Add/align auth service interfaces for `register`, `login`, and `refresh` flows in backend modules.
- [ ] 1.2 Implement access token issuance with 1-hour TTL and refresh token issuance with 7-day TTL.
- [ ] 1.3 Set refresh token transport to secure cookie flags (`HttpOnly`, `Secure`, `SameSite=Strict`) on register/login responses.
- [ ] 1.4 Ensure access token transport contract uses `Authorization` header validation in protected request pipeline.

## 2. Refresh Rotation and Denylist

- [ ] 2.1 Implement refresh endpoint token validation path for JWT verification plus denylist `jti` lookup.
- [ ] 2.2 Implement refresh rotation that issues new token pair and records previous refresh token `jti` in denylist.
- [ ] 2.3 Reject denylisted or expired refresh tokens with `401` and prevent token minting on failure.
- [ ] 2.4 Add denylist persistence cleanup strategy aligned with refresh token expiry window.

## 3. RBAC Enforcement Across REST and SSE

- [ ] 3.1 Define centralized RBAC matrix mapping for public, protected (`user`/`admin`), and admin-only routes.
- [ ] 3.2 Wire RBAC middleware/guards into Auth, Billing, Realtime, Analytics, and Admin route groups.
- [ ] 3.3 Apply identical authn/authz policy checks to protected SSE endpoint handling.
- [ ] 3.4 Enforce deterministic authorization outcomes: unauthenticated -> `401`, insufficient role -> `403`.

## 4. Error Semantics and Observability

- [ ] 4.1 Map expired/tampered access token failures to `401` responses in auth middleware.
- [ ] 4.2 Emit security event for non-admin access attempts to admin-only endpoints.
- [ ] 4.3 Add/align metrics for login success/failure, refresh success/failure + denylist hits, authorization denial rate, and SSE auth failures.

## 5. Acceptance and Integration Testing

- [ ] 5.1 Add acceptance test for successful register/login returning access token and secure refresh cookie.
- [ ] 5.2 Add acceptance test for refresh rotation where old refresh token reuse fails with `401`.
- [ ] 5.3 Add acceptance tests for anonymous access to public endpoints and `401` on protected endpoints without auth.
- [ ] 5.4 Add acceptance test for `403` on admin endpoints when authenticated as non-admin.
- [ ] 5.5 Add acceptance test for protected SSE endpoint unauthorized subscription rejection.

## 6. Spec and PRD Alignment

- [ ] 6.1 Update identity domain PRD content at `docs/prd/domains/03-identity-access-prd.md` to reflect modified requirement deltas.
- [ ] 6.2 Verify route matrix, token policy, and acceptance scenarios are consistent between implementation and OpenSpec capability specs.
- [ ] 6.3 Perform end-to-end review to confirm this change satisfies all artifacts before archive/apply workflow.

