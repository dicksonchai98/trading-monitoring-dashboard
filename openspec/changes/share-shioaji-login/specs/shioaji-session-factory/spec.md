## ADDED Requirements

### Requirement: Shared Shioaji session factory
The system SHALL provide a shared factory that constructs Shioaji API/client instances with standardized credentials and simulation mode for any service that needs Shioaji access.

#### Scenario: Build Shioaji API/client using shared factory
- **WHEN** a service requests a Shioaji session via the shared factory
- **THEN** the factory returns a Shioaji API/client configured with `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`, and `SHIOAJI_SIMULATION`

### Requirement: Consistent login flow
The shared factory and client wrappers MUST preserve the established login sequence used by market ingestion.

#### Scenario: Login flow is consistent with ingestion
- **WHEN** the shared factory client performs login
- **THEN** it uses `api.login(api_key=..., secret_key=..., fetch_contract=False)` and allows `fetch_contracts()` to be called explicitly when contract context is needed