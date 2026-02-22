## ADDED Requirements

### Requirement: Registration and login SHALL issue session credentials
The backend SHALL provide `POST /auth/register` and `POST /auth/login` endpoints that authenticate the caller identity and return an `access_token` in the response body while setting a `refresh_token` in an HttpOnly cookie.

#### Scenario: Register returns access token and refresh cookie
- **WHEN** a client submits valid registration data to `POST /auth/register`
- **THEN** the response returns `access_token` and sets `refresh_token` cookie with required security flags

#### Scenario: Login returns access token and refresh cookie
- **WHEN** a client submits valid credentials to `POST /auth/login`
- **THEN** the response returns `access_token` and sets `refresh_token` cookie with required security flags

### Requirement: Authentication tokens SHALL follow explicit transport and lifetime rules
The backend SHALL enforce:
- Access token lifetime of 1 hour
- Refresh token lifetime of 7 days
- Access token transmission via `Authorization` header
- Refresh token transmission via cookie with `HttpOnly`, `Secure`, and `SameSite=Strict`

#### Scenario: Token claims reflect configured lifetimes
- **WHEN** the backend issues tokens for successful login
- **THEN** access and refresh token expirations match configured 1-hour and 7-day TTL policies

#### Scenario: Refresh cookie is hardened
- **WHEN** the backend sets `refresh_token` in any auth response
- **THEN** the cookie includes `HttpOnly`, `Secure`, and `SameSite=Strict`

