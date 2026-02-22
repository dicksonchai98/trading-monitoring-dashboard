## 1. Update API & RBAC Sections

- [ ] 1.1 Insert domain-grouped API route list (Auth/Billing/Realtime/Analytics/Admin) in `03-identity-access-prd.md`
- [ ] 1.2 Define RBAC roles (`visitor`, `user`, `admin`) and access matrix for public/protected/admin routes
- [ ] 1.3 Document default role assignment and admin pre-provisioning rule

## 2. Define Token & Refresh Policies

- [ ] 2.1 Specify access/refresh token TTLs and transport channels (header + HttpOnly cookie)
- [ ] 2.2 Define refresh rotation and denylist requirements (JWT `jti` revocation)
- [ ] 2.3 Add SSE authorization rules for public vs protected streams

## 3. Failure Semantics, Observability, and Tests

- [ ] 3.1 Add auth/authorization failure outcomes (401/403) with examples
- [ ] 3.2 Add observability signals (login/refresh counts, denylist hits, denial rates, SSE auth failures)
- [ ] 3.3 Add test scenarios covering register/login/refresh, protected routes, admin-only, SSE auth

## 4. Scope & Consistency Review

- [ ] 4.1 Document out-of-scope items (logout, MFA, lockout, profile)
- [ ] 4.2 Review PRD for consistency with this change and record any cross-PRD mismatches as notes
