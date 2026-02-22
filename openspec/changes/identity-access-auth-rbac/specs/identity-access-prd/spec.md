## MODIFIED Requirements

### Requirement: Authentication and authorization failure semantics SHALL be testable
The identity PRD SHALL define these outcomes as backend-enforced contracts:

- Expired or tampered access token -> `401`
- Expired refresh token or denylist hit -> `401`
- Insufficient role -> `403`
- Non-admin access to admin-only route -> `403` and security event is logged

SSE endpoints SHALL follow the same auth model:

- `GET /realtime/strength` remains public
- `GET /realtime/weighted` requires authenticated `user` or `admin`, with unauthorized attempts returning `401` or `403`

These outcomes SHALL be represented as acceptance criteria tied to backend verification scenarios, not frontend-only behavior.

#### Scenario: Protected endpoint without authentication fails with 401
- **WHEN** an unauthenticated client calls `GET /billing/status`
- **THEN** the request is rejected with `401`

#### Scenario: Protected SSE endpoint enforces RBAC
- **WHEN** an unauthorized client subscribes to `GET /realtime/weighted`
- **THEN** the request is rejected with `401` or `403` based on auth state

### Requirement: Observability and verification scenarios SHALL be included
The identity PRD SHALL require observability signals for:

- Login success and failure counts
- Refresh success and failure counts, including denylist hits
- Authorization denial rate by endpoint and role
- SSE authorization failure count

The identity PRD SHALL define at least these backend acceptance scenarios:

- Register issues access token and refresh cookie
- Login issues access token and refresh cookie
- Refresh rotates token and invalidates old token
- Public endpoints allow anonymous access
- Protected endpoints return `401` when unauthenticated
- Admin-only endpoints return `403` for non-admin
- Protected SSE endpoints enforce `401`/`403` on unauthorized access

#### Scenario: PRD provides measurable operational signals
- **WHEN** observability requirements are reviewed
- **THEN** each required metric family is explicitly listed with outcome intent

