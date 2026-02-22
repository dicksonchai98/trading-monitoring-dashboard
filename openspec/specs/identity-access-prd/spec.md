# Identity Access Prd

## Purpose

This spec defines the required identity, authentication, and authorization behavior for the trading monitoring dashboard.

## Requirements

### Requirement: Identity and access API surface SHALL be explicitly defined
The identity PRD SHALL define the following API routes as normative interfaces using the domain-grouped structure:

- `POST /auth/register` (public)
- `POST /auth/login` (public)
- `POST /auth/refresh` (protected: authenticated refresh token required)
- `GET /billing/plans` (public)
- `POST /billing/checkout` (protected: `user` or `admin`)
- `GET /billing/status` (protected: `user` or `admin`)
- `GET /realtime/strength` (public)
- `GET /realtime/weighted` (protected: `user` or `admin`)
- `GET /analytics/history` (protected: `user` or `admin`)
- `GET /admin/logs` (admin only)
- `GET /admin/logs/{id}` (admin only)

#### Scenario: Route inventory is complete and unambiguous
- **WHEN** a reviewer validates the Identity PRD route list
- **THEN** every route above appears with method, path, and access class

### Requirement: Role model and RBAC matrix SHALL be specified
The identity PRD SHALL define roles `visitor`, `user`, and `admin` and SHALL map access as follows:

- Public routes are accessible to `visitor`, `user`, and `admin`
- Protected routes are accessible only to authenticated `user` and `admin`
- Admin routes are accessible only to `admin`

Newly registered accounts SHALL default to role `user`, and role `admin` MUST only be assigned by pre-provisioning in persistent storage.

#### Scenario: Default role assignment is constrained
- **WHEN** a new account is created via `POST /auth/register`
- **THEN** the resulting role is `user` and never `admin`

#### Scenario: Admin-only routes reject non-admin actors
- **WHEN** a `user` or `visitor` attempts `GET /admin/logs` or `GET /admin/logs/{id}`
- **THEN** the request is rejected with `403`

### Requirement: Token issuance and transport policy SHALL be explicit
The identity PRD SHALL require:

- `register` response returns `access_token` and sets `refresh_token` HttpOnly cookie
- `login` response returns `access_token` and sets `refresh_token` HttpOnly cookie
- Access token TTL SHALL be 1 hour
- Refresh token TTL SHALL be 7 days
- Access token MUST be sent in `Authorization` header
- Refresh token MUST be sent as cookie with `HttpOnly`, `Secure`, and `SameSite=Strict`

#### Scenario: Login response contains both token channels
- **WHEN** authentication succeeds through `POST /auth/login`
- **THEN** the response body includes `access_token` and response cookies include `refresh_token` with required flags

### Requirement: Refresh flow SHALL rotate tokens and enforce denylist revocation
The identity PRD SHALL require refresh tokens to be JWTs validated with denylist checks by `jti`. On successful refresh, the previous refresh token `jti` SHALL be recorded in denylist and MUST be rejected for subsequent refresh attempts.

#### Scenario: Refresh rotation invalidates previous token
- **WHEN** a valid refresh token is exchanged through `POST /auth/refresh`
- **THEN** the system issues a new access token and refresh cookie, and marks old token `jti` as denied

#### Scenario: Denylisted refresh token is rejected
- **WHEN** a refresh request uses a token whose `jti` exists in denylist
- **THEN** the request is rejected with `401`

### Requirement: Authentication and authorization failure semantics SHALL be testable
The identity PRD SHALL define these outcomes:

- Expired or tampered access token -> `401`
- Expired refresh token or denylist hit -> `401`
- Insufficient role -> `403`
- Non-admin access to admin-only route -> `403` and security event is logged

SSE endpoints SHALL follow the same auth model:

- `GET /realtime/strength` remains public
- `GET /realtime/weighted` requires authenticated `user` or `admin`, with unauthorized attempts returning `401` or `403`

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

The identity PRD SHALL also define at least these test scenarios:

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

### Requirement: Scope boundaries SHALL prevent unintended expansion
The identity PRD update SHALL be limited to `docs/prd/domains/03-identity-access-prd.md`. The PRD MUST state that logout endpoint, MFA, login lockout, and profile management are out of scope for this change.

#### Scenario: Scope check passes during review
- **WHEN** reviewers validate change scope
- **THEN** only the identity domain PRD is required and excluded features are explicitly documented
