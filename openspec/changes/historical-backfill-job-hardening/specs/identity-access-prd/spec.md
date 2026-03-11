## MODIFIED Requirements

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
- `POST /api/admin/backfill/historical-jobs` (admin only)
- `GET /api/admin/backfill/historical-jobs` (admin only)
- `GET /api/admin/backfill/historical-jobs/{job_id}` (admin only)

#### Scenario: Route inventory is complete and unambiguous
- **WHEN** a reviewer validates the Identity PRD route list
- **THEN** every route above appears with method, path, and access class
