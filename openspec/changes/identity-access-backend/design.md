## Context

The MVP requires a clear, testable backend identity/auth specification that matches the agreed login/registration flow and access boundaries. Current documentation needs to explicitly define API routes, RBAC, token handling, and failure semantics so implementation and tests can proceed without ambiguity. This change is documentation-driven and scoped to the Identity PRD.

## Goals / Non-Goals

**Goals:**
- Define a complete backend identity/access contract for MVP (routes, JWT/refresh, RBAC matrix).
- Make authorization outcomes and observability requirements explicit and testable.
- Preserve the agreed route grouping (Scheme B) and role model.

**Non-Goals:**
- Adding new endpoints beyond the agreed scope (e.g., logout).
- MFA, login lockout, user profile management, or multi-tenant authorization.
- Updating other domain PRDs in this change.

## Decisions

- Use domain-grouped routes (`/auth`, `/billing`, `/realtime`, `/analytics`, `/admin`) to align with product scope and keep API surface consistent across domains.
- Adopt rotating refresh tokens with a DB denylist to allow revocation and prevent reuse.
- Set access token TTL to 1 hour and refresh token TTL to 7 days to balance UX and security.
- Transport access tokens via Authorization header and refresh tokens via HttpOnly cookie (Secure + SameSite=Strict).
- Enforce RBAC uniformly for REST and SSE endpoints; backend is source of truth.

## Risks / Trade-offs

- **Strict cookie policy may block cross-site usage** ¡÷ Mitigation: document that same-site is expected; adjust policy if cross-site is required later.
- **Denylist requires storage and cleanup** ¡÷ Mitigation: store `jti` with TTL aligned to refresh expiry.
- **Doc-only change could diverge from other PRDs** ¡÷ Mitigation: explicitly scope updates to Identity PRD and record an open question to align later.

## Migration Plan

- Documentation-only update; no data migration required.
- Rollback is simply reverting the PRD changes if needed.

## Open Questions

- When to align other domain PRDs with the new route structure.
- Whether to add CI checks to enforce RBAC boundary rules.
