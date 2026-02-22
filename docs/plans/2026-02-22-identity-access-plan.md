# Identity & Access Design (2026-02-22)

## Goal

Deliver a complete MVP backend identity & access scope centered on **login/registration** and their **test scenarios**, while still covering the full feature set in this document: API routes, JWT/refresh flows, RBAC access matrix, and security rules. This document updates only the Identity PRD scope and does not modify other domain PRDs.

## Architecture

Route groups (Scheme B):

Auth
- `POST /auth/register` (public)
- `POST /auth/login` (public)
- `POST /auth/refresh` (protected)

Billing
- `GET /billing/plans` (public)
- `POST /billing/checkout` (protected: user/admin)
- `GET /billing/status` (protected: user/admin)

Realtime (SSE)
- `GET /realtime/strength` (public)
- `GET /realtime/weighted` (protected: user/admin)

Analytics
- `GET /analytics/history` (protected: user/admin)

Admin
- `GET /admin/logs` (admin only)
- `GET /admin/logs/{id}` (admin only)

Token model:
- `access_token`: 1 hour
- `refresh_token`: 7 days, rotating
- access via Authorization header, refresh via HttpOnly cookie
- Cookie policy: HttpOnly + Secure + SameSite=Strict
- Refresh validation: JWT + DB denylist (old `jti` added on refresh)

## Components

- Auth service issues access/refresh tokens and handles rotation
- RBAC policy enforces role-based access for all protected endpoints
- SSE endpoints enforce the same authorization rules as REST
- Admin audit endpoints restricted to `admin`

## Data Flow & Config

- Register/login returns `access_token` and sets refresh cookie
- Refresh exchanges refresh token for new access + new refresh cookie
- Authorization decisions use role claim + RBAC matrix
- Default roles: `admin`, `user`, `visitor` (anonymous)

RBAC access matrix:
- Public: `/auth/register`, `/auth/login`, `/billing/plans`, `/realtime/strength`
- Protected (user/admin): `/auth/refresh`, `/billing/checkout`, `/billing/status`, `/realtime/weighted`, `/analytics/history`
- Admin-only: `/admin/logs`, `/admin/logs/{id}`

## Deployment & Environments

- No special deployment changes required
- Cookie settings assume HTTPS for Secure flag

## Error Handling & Testing

Error handling:
- access token expired/tampered -> 401
- refresh token expired/denylist hit -> 401
- insufficient role -> 403
- non-admin access to admin endpoints -> 403 + security event

Testing focus (MVP):
- register/login returns access token + sets refresh cookie
- refresh rotates token and invalidates old refresh token
- public endpoints accessible without JWT
- protected endpoints return 401 when unauthenticated
- admin-only endpoints return 403 for non-admin
- SSE protected endpoint rejects unauthorized connections

## Decisions

- Register returns tokens (register = login)
- Refresh tokens rotate on use
- Admin users are pre-provisioned in DB only
- Frontend guards are UX-only; backend is source of truth
- No logout endpoint in MVP

## Open Questions

- When to align other domain PRDs with the new route structure
- Whether to add boundary enforcement for auth/rbac rules in CI
