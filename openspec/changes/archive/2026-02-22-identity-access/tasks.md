## 1. Prepare PRD update structure

- [ ] 1.1 Review `docs/prd/domains/03-identity-access-prd.md` and map insertion points for interfaces, RBAC, token rules, failure modes, observability, tests, and acceptance criteria.
- [ ] 1.2 Add or normalize section headings in the identity PRD so each required requirement area has a clear location.

## 2. Define interfaces and access rules

- [ ] 2.1 Document the complete route inventory (auth, billing, realtime SSE, analytics, admin) with method/path/access class.
- [ ] 2.2 Add RBAC matrix for `visitor`, `user`, and `admin`, including default `user` role on register and pre-provisioned `admin` policy.
- [ ] 2.3 Add explicit SSE authorization rules, including expected unauthorized response behavior.

## 3. Define token lifecycle and security behavior

- [ ] 3.1 Specify register/login responses to return `access_token` and set `refresh_token` HttpOnly cookie.
- [ ] 3.2 Specify token TTL and transport constraints (`Authorization` header for access token; `HttpOnly + Secure + SameSite=Strict` cookie for refresh token).
- [ ] 3.3 Specify refresh-token rotation, JWT `jti` denylist checks, and invalidation of prior refresh token after successful refresh.

## 4. Define failure, observability, and testability contracts

- [ ] 4.1 Document required 401/403 outcomes for expired/tampered/unauthorized cases and required security-event logging for admin-route denial.
- [ ] 4.2 Add observability requirements (login success/failure, refresh success/failure, denylist hits, authorization denials by endpoint/role, SSE auth failures).
- [ ] 4.3 Add required test scenarios covering register, login, refresh rotation, public/protected/admin endpoint behavior, and protected SSE behavior.

## 5. Validate scope and quality gates

- [ ] 5.1 Confirm out-of-scope features are explicitly stated (no logout endpoint, no MFA, no lockout, no profile page).
- [ ] 5.2 Confirm only `docs/prd/domains/03-identity-access-prd.md` is modified and route differences vs other PRDs are documented within this PRD only.
- [ ] 5.3 Run final consistency review so route list, RBAC matrix, token rules, failure modes, observability, and tests do not conflict.
