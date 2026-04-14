# AGENTS Instructions for `apps/frontend`

## Purpose

This file defines strict implementation guardrails for any agent working in `apps/frontend`.
All frontend work must align with `docs/plans/2026-02-16-futures-dashboard-design.md`.

## Product Intent (MVP Only)

Build a frontend MVP for a futures monitoring dashboard that:

- Displays near-month Taiwan index futures data only
- Receives near real-time updates via SSE every 1 second
- Enforces JWT auth and role-based page access (`admin`, `member`, `visitor`)
- Supports a mock subscription flow gating protected member content

Do not expand beyond MVP unless explicitly requested by the user.

## Scope Contract

### In Scope

- Dashboard UI for near-month Taiwan index futures snapshot display
- SSE client integration for 1-second snapshot refresh
- Login/session handling using JWT from backend API
- Auth contract: login with `user_id`; register with `user_id + email + verification_token`
- Frontend route guards based on role and subscription entitlement state
- Admin/member/visitor page-level access handling
- UX states for loading, disconnected SSE, unauthorized, and forbidden

### Out of Scope (Do Not Implement)

- Options, spot, foreign instruments, or multi-instrument market screens
- Historical backfill charts or scraping features
- Real payment provider integrations
- Multi-plan subscription pricing/checkout systems
- WebSocket migration (MVP remains SSE)

## Architecture and Integration Rules

### Data Source and Update Model

- Treat backend as source of truth for computed snapshots.
- Consume snapshot updates from SSE endpoint on a fixed 1-second cadence.
- Do not compute market indicators in frontend if backend already owns computation.
- Do not introduce polling if SSE is available.

### Auth and Access Control

- JWT is required for authenticated routes.
- Route-level guard must exist for role-based access:
  - `visitor`: public-only pages
  - `member`: member pages (requires active subscription entitlement)
  - `admin`: admin pages
- Frontend guards improve UX but never replace backend authorization.
- Handle `401` and `403` explicitly with correct UX and redirection behavior.

### Subscription UX (Mock Flow Compatible)

- Support UI states for subscription intent, pending, and active.
- Assume backend webhook simulation activates entitlement asynchronously.
- Keep state transitions resilient to refresh/reconnect.

### Auth UX Flow

- Registration must use deterministic two-step flow:
  - Step 1: email OTP verification
  - Step 2: credentials input (`user_id`, `password`)
- Do not mix OTP modal state with credentials form submission state.

## Routing Contract

- Organize routes by access level (public/member/admin).
- Every protected route must declare its required role/entitlement requirement.
- Prevent accidental rendering flashes of protected content before auth state resolves.

## UI/UX Contract

- Prioritize operational clarity over decorative complexity.
- Surface key market snapshot fields clearly and consistently.
- Show connection status for SSE (connected/retrying/disconnected).
- Use page-level skeletons for bootstrap/loading states (`page-skeleton` test id) on auth/dashboard/subscription pages.
- Provide deterministic fallback UI for:
  - Empty snapshot
  - Stale snapshot
  - Permission denied
  - Session expired

## Code Quality Rules

- Use TypeScript strict typing for API payloads, auth models, and SSE messages.
- Keep API and SSE schema definitions centralized (single source for frontend types).
- Avoid hidden global state mutations; use predictable state transitions.
- Keep components focused: data adapters/hooks separate from presentation where practical.

## Testing and Verification Requirements

At minimum, implement and keep passing:

- Unit tests for route-guard logic by role and subscription entitlement
- Unit tests for auth/session edge cases (`401`, token expiry)
- Integration-style tests for SSE state handling (connect, message, reconnect/failure)
- UI tests for unauthorized/forbidden redirects and protected-page behavior

When changing access logic or SSE handling, update/add tests in the same change.

## Change Control

Before implementing frontend features, verify they map to MVP scope above.
If a request conflicts with this contract, stop and ask for explicit approval to expand scope.

## Non-Negotiable Constraints

- Keep SSE as the real-time mechanism for MVP.
- Keep target domain to near-month Taiwan index futures only.
- Keep role model limited to `admin`, `member`, `visitor` unless explicitly expanded.
- Do not add real payment integration in MVP frontend.

