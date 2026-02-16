# Domain PRD: Identity and Access

- Domain: Identity & Access
- Version: v1.0
- Date: 2026-02-16
- Parent: `docs/prd/2026-02-16-futures-dashboard-master-prd.md`

## 1. Domain Goal
Provide secure authentication and consistent authorization using JWT and RBAC across all protected APIs.

## 2. In Scope (MVP)
1. JWT issuance and validation.
2. Role model: `visitor`, `member`, `admin`.
3. RBAC policy checks for protected CRUD.
4. Standardized 401/403 behavior.

## 3. Out of Scope (MVP)
1. OAuth social login.
2. Fine-grained per-user ACL.
3. Enterprise SSO.

## 4. Public Interfaces
1. Auth endpoint
- `POST /auth/login`

2. Middleware and policy
- JWT middleware verifies token
- `can(role, resource, action)` policy function

## 5. Processing Rules
1. Backend is source of truth for authorization.
2. Frontend route guard cannot bypass backend RBAC.
3. Forbidden operations must be audit logged.

## 6. Failure Modes
1. Expired/invalid token.
- Action: return 401.

2. Insufficient role permissions.
- Action: return 403 and write audit event.

## 7. Observability
1. Auth failure count.
2. Forbidden action count by endpoint.
3. Token verification error trend.

## 8. Test Scenarios
1. Valid JWT accesses protected endpoint.
2. Invalid JWT gets 401.
3. Role without permission gets 403.
4. Admin role can execute allowed CRUD.

## 9. Acceptance Criteria
1. All protected endpoints enforce RBAC consistently.
2. No critical protected CRUD endpoint is exposed without policy checks.
