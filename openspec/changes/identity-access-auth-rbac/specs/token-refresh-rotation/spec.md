## ADDED Requirements

### Requirement: Refresh endpoint SHALL rotate refresh tokens on every successful exchange
The backend SHALL require refresh operations through `POST /auth/refresh` to mint a new access token and a new refresh token, and SHALL invalidate reuse of the previously accepted refresh token.

#### Scenario: Successful refresh rotates token pair
- **WHEN** a valid refresh token is submitted to `POST /auth/refresh`
- **THEN** the backend returns a new access token and sets a new refresh token cookie

### Requirement: Refresh validation SHALL enforce denylist checks by token jti
The backend SHALL reject refresh requests whose token `jti` is present in the denylist, and SHALL insert the previous refresh token `jti` into denylist after successful rotation.

#### Scenario: Reused rotated refresh token is denied
- **WHEN** a client reuses a refresh token that was already exchanged
- **THEN** `POST /auth/refresh` returns `401` because the old token `jti` is denylisted

#### Scenario: Expired refresh token is rejected
- **WHEN** a client sends an expired refresh token to `POST /auth/refresh`
- **THEN** the backend returns `401` and does not mint new tokens

