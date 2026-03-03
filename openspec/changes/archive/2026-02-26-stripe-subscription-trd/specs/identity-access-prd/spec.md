## MODIFIED Requirements

### Requirement: Identity and access API surface SHALL be explicitly defined
The identity PRD SHALL define the following API routes as normative interfaces using the domain-grouped structure:

- `POST /auth/register` (public)
- `POST /auth/login` (public)
- `POST /auth/refresh` (protected: authenticated refresh token required)
- `GET /billing/plans` (public)
- `POST /billing/checkout` (protected: `user` or `admin`)
- `POST /billing/webhooks/stripe` (public, Stripe signature required)
- `GET /billing/status` (protected: `user` or `admin`)
- `POST /billing/portal-session` (protected: `user` or `admin`)
- `GET /realtime/strength` (public)
- `GET /realtime/weighted` (protected: `user` or `admin`)
- `GET /analytics/history` (protected: `user` or `admin`)
- `GET /admin/logs` (admin only)
- `GET /admin/logs/{id}` (admin only)

#### Scenario: Route inventory is complete and unambiguous
- **WHEN** a reviewer validates the Identity PRD route list
- **THEN** every route above appears with method, path, and access class

### Requirement: Authentication and authorization failure semantics SHALL be testable
The identity PRD SHALL define these outcomes:

- Expired or tampered access token -> `401`
- Expired refresh token or denylist hit -> `401`
- Insufficient role -> `403`
- Non-admin access to admin-only route -> `403` and security event is logged
- Missing or invalid Stripe webhook signature on `POST /billing/webhooks/stripe` -> non-2xx and no subscription state mutation

SSE endpoints SHALL follow the same auth model:

- `GET /realtime/strength` remains public
- `GET /realtime/weighted` requires authenticated `user` or `admin`, with unauthorized attempts returning `401` or `403`

#### Scenario: Protected endpoint without authentication fails with 401
- **WHEN** an unauthenticated client calls `GET /billing/status`
- **THEN** the request is rejected with `401`

#### Scenario: Protected SSE endpoint enforces RBAC
- **WHEN** an unauthorized client subscribes to `GET /realtime/weighted`
- **THEN** the request is rejected with `401` or `403` based on auth state

#### Scenario: Stripe webhook with invalid signature is rejected
- **WHEN** a request to `POST /billing/webhooks/stripe` has missing or invalid signature
- **THEN** the request is rejected with non-2xx response and no billing entitlement mutation occurs
