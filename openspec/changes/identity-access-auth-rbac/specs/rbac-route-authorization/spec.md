## ADDED Requirements

### Requirement: Route authorization SHALL enforce the RBAC matrix across REST endpoints
The backend SHALL enforce the following access classes:
- Public routes: `/auth/register`, `/auth/login`, `/billing/plans`, `/realtime/strength`
- Protected routes (`user` or `admin`): `/auth/refresh`, `/billing/checkout`, `/billing/status`, `/realtime/weighted`, `/analytics/history`
- Admin-only routes: `/admin/logs`, `/admin/logs/{id}`

Requests that do not satisfy route role policy MUST be rejected with `401` when unauthenticated and `403` when authenticated but unauthorized.

#### Scenario: Protected REST route rejects unauthenticated request
- **WHEN** a client without valid access token calls `GET /billing/status`
- **THEN** the backend returns `401`

#### Scenario: Admin route rejects authenticated non-admin request
- **WHEN** a `user` token calls `GET /admin/logs`
- **THEN** the backend returns `403`

### Requirement: SSE authorization SHALL use the same authn and RBAC policy as REST
The backend SHALL apply the same authentication and role checks to SSE subscriptions as to REST requests for equivalent route classes.

#### Scenario: Public SSE endpoint allows anonymous subscriber
- **WHEN** an unauthenticated client subscribes to `GET /realtime/strength`
- **THEN** the subscription is accepted

#### Scenario: Protected SSE endpoint rejects unauthorized subscriber
- **WHEN** an unauthenticated or insufficient-role client subscribes to `GET /realtime/weighted`
- **THEN** the backend rejects subscription with `401` or `403` according to auth state

