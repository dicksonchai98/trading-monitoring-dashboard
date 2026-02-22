## ADDED Requirements

### Requirement: Identity and access acceptance suite SHALL cover core authentication flows
The test suite SHALL verify end-to-end backend behavior for registration, login, and refresh rotation contracts.

#### Scenario: Register flow validates credential issuance contract
- **WHEN** automated acceptance tests execute successful register flow
- **THEN** tests assert access token response payload and refresh cookie security flags

#### Scenario: Refresh flow validates rotation and old-token invalidation
- **WHEN** automated acceptance tests execute two sequential refresh attempts using the original token
- **THEN** the first attempt succeeds and the second attempt fails with `401`

### Requirement: Acceptance suite SHALL cover RBAC route-matrix outcomes
The test suite SHALL validate public, protected, and admin-only access outcomes for both REST and SSE endpoints.

#### Scenario: Public endpoints remain accessible without JWT
- **WHEN** acceptance tests call public routes anonymously
- **THEN** responses succeed without authentication

#### Scenario: Protected endpoints reject unauthenticated clients
- **WHEN** acceptance tests call protected routes without access token
- **THEN** responses return `401`

#### Scenario: Admin-only routes reject non-admin users
- **WHEN** acceptance tests call admin routes with a non-admin authenticated user
- **THEN** responses return `403`

#### Scenario: Protected SSE endpoint enforces authorization
- **WHEN** acceptance tests subscribe to protected SSE endpoint without valid authorization
- **THEN** connection is denied with authorization failure outcome

