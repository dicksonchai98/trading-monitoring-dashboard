## ADDED Requirements

### Requirement: Crawler Admin Endpoint Authorization
The system SHALL enforce backend RBAC so that only admin users can access crawler trigger and job-management endpoints.

#### Scenario: Non-admin calls crawler run endpoint
- **WHEN** a user without admin role calls `POST /admin/crawler/run`
- **THEN** the API SHALL reject the request with authorization failure and SHALL NOT create a crawler job

#### Scenario: Non-admin calls crawler backfill endpoint
- **WHEN** a user without admin role calls `POST /admin/crawler/backfill`
- **THEN** the API SHALL reject the request with authorization failure and SHALL NOT create parent/child crawler jobs

#### Scenario: Non-admin calls crawler jobs list endpoint
- **WHEN** a user without admin role calls `GET /admin/crawler/jobs`
- **THEN** the API SHALL reject the request with authorization failure and SHALL NOT return crawler job data

#### Scenario: Non-admin calls crawler job detail endpoint
- **WHEN** a user without admin role calls `GET /admin/crawler/jobs/{job_id}`
- **THEN** the API SHALL reject the request with authorization failure and SHALL NOT return crawler job detail data

### Requirement: Crawler Trigger Auditability
The system SHALL create audit records for admin-triggered crawler run and backfill actions.

#### Scenario: Admin creates range backfill
- **WHEN** an admin successfully submits a backfill request
- **THEN** the system SHALL persist an audit record with actor identity, request scope, and parent job/correlation reference
