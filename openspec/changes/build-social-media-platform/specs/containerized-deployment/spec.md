## ADDED Requirements

### Requirement: Containerized application topology
The system SHALL define docker-compose services for `nginx`, `app`, and `db` with network connectivity that allows external traffic to reach app through nginx.

#### Scenario: Compose startup
- **WHEN** docker compose starts the stack
- **THEN** nginx proxies incoming requests to the app service and app can connect to db

### Requirement: Reverse proxy forwarded headers
The system MUST forward host, client IP, and protocol headers from nginx to app and app MUST process forwarded headers.

#### Scenario: Forwarded scheme handling
- **WHEN** a request passes through nginx with forwarded proto header
- **THEN** the app recognizes the original request scheme and host context

### Requirement: Reproducible app image build
The system MUST provide a Dockerfile that restores, builds, and publishes the ASP.NET Core application into a runtime image exposing app port 8080.

#### Scenario: Build and run image
- **WHEN** the Dockerfile is built and container is started
- **THEN** the application process starts and listens on configured port

### Requirement: SQL Server-first runtime profile
The system MUST provide a default docker-compose database service and application connection settings targeting SQL Server for the first release.

#### Scenario: Default compose database target
- **WHEN** a developer runs docker compose with default configuration
- **THEN** the app connects to SQL Server without requiring PostgreSQL-specific overrides

### Requirement: Compose health checks and startup gating
The system MUST define health checks for critical services and MUST gate app startup on database readiness.

#### Scenario: Database not ready at app start
- **WHEN** database container is running but not yet healthy
- **THEN** application startup waits or retries until database readiness is satisfied
