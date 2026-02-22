## Context

This change is a requirements-definition update for Identity & Access and is intentionally scoped to documentation. The target is `docs/prd/domains/03-identity-access-prd.md`, which must become implementation-ready by defining route interfaces, RBAC, JWT/refresh semantics, failure behavior, observability, and test scenarios. Existing domain PRDs are not modified.

The selected API scheme is domain-grouped routes (auth, billing, realtime, analytics, admin). Security constraints include short-lived access tokens, rotating refresh tokens, cookie-hardening, denylist revocation, and backend-enforced authorization (frontend guards remain non-authoritative UX controls).

## Goals / Non-Goals

**Goals:**

- Produce a complete, internally consistent Identity & Access PRD that can be translated directly into backend implementation tasks.
- Make endpoint authorization behavior explicit and testable for `visitor`, `user`, and `admin` roles, including SSE endpoints.
- Define token exchange and revocation requirements with concrete TTL/transport/security policy.
- Define measurable observability signals and minimum acceptance-oriented test scenarios.

**Non-Goals:**

- Implement backend code, middleware, or database schema changes in this change.
- Add endpoints or features outside the specified scope (for example logout, MFA, lockout, profile management).
- Modify other PRD files to align route naming; differences are documented only inside the identity PRD.

## Decisions

- **Decision: Treat this as a doc-only contract change before code work.**  
  Rationale: The primary risk is ambiguous auth behavior; codifying requirements first reduces rework and security regressions.  
  Alternative considered: Implement directly in code and backfill docs. Rejected due to high drift risk and unclear acceptance boundaries.

- **Decision: Use domain-grouped route scheme (`/auth`, `/billing`, `/realtime`, `/analytics`, `/admin`).**  
  Rationale: Matches PRD direction and gives clear access boundaries for RBAC and ownership by domain area.  
  Alternative considered: Flat auth-oriented route grouping. Rejected because it obscures functional ownership and endpoint intent.

- **Decision: Use access token (Authorization header) + refresh token (HttpOnly Secure SameSite=Strict cookie) split transport.**  
  Rationale: Reduces refresh token exposure to JavaScript while keeping API auth ergonomic with bearer tokens.  
  Alternative considered: Storing both tokens in local storage/session storage. Rejected due to larger XSS blast radius.

- **Decision: Use JWT refresh tokens with denylist by `jti` and rotation on refresh.**  
  Rationale: Supports stateless validation while enabling explicit revocation of used/compromised tokens.  
  Alternative considered: Opaque refresh tokens only. Rejected for this PRD because the agreed design explicitly requires JWT + denylist.

- **Decision: Explicitly require RBAC enforcement on SSE endpoints and backend as source of truth.**  
  Rationale: Streaming endpoints are commonly under-guarded; PRD must remove ambiguity and require 401/403 parity with REST endpoints.  
  Alternative considered: Rely on frontend route guards for SSE visibility. Rejected because frontend controls are bypassable.

- **Decision: Define observability as counters/rates tied to auth and authorization outcomes.**  
  Rationale: Implementation teams need measurable indicators for operational and security validation.  
  Alternative considered: Log-only requirements. Rejected because logs alone do not provide reliable trend and alerting signals.

## Risks / Trade-offs

- **[Risk] Route naming may diverge from other domain PRDs** -> Mitigation: document differences explicitly in this PRD while preserving no-change constraint for other PRDs.
- **[Risk] Denylist storage and retention details are unspecified at PRD level** -> Mitigation: constrain only behavioral contract (denylist hit rejects; rotated token invalidated) and defer storage mechanics to implementation design.
- **[Risk] Strict SameSite cookie policy can affect some cross-site integration cases** -> Mitigation: keep requirement explicit for security baseline and treat any exceptions as future scoped change.
- **[Risk] No logout endpoint leaves user-initiated session termination undefined** -> Mitigation: explicitly list as out-of-scope so teams do not assume it exists.
- **[Risk] Doc-only change may be interpreted inconsistently without acceptance tests** -> Mitigation: include concrete test scenarios and acceptance criteria directly in PRD.

## Migration Plan

1. Update `docs/prd/domains/03-identity-access-prd.md` sections for interfaces, RBAC matrix, token rules, failure modes, observability, and test scenarios.
2. Validate internal consistency:
   - Every endpoint appears in both interface list and RBAC classification.
   - Token TTL/transport/rotation rules are coherent across rules and failure sections.
   - SSE authorization expectations appear in both rules and tests.
3. Review wording for requirement clarity (normative, testable statements).
4. Land PRD update; implementation planning then consumes the finalized requirements.

Rollback strategy: revert PRD changes if inconsistencies are found during review; no runtime rollback needed because no production code is changed.

## Open Questions

- Should refresh endpoint failure logging include reason codes (expired vs denylist) as a required metric dimension?
- Should admin-log endpoint access denials require additional audit fields beyond default security event logging?
