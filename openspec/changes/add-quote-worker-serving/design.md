## Context

Current stream processing and serving paths are contract-complete for tick/bidask, but quote-derived features exist only as a design draft in `docs/plans/2026-04-06-quote-worker-design.md`.  
The approved design update in `docs/plans/2026-04-06-quote-serving-design.md` requires: explicit ACK contract, deterministic minute flush semantics, and quote serving APIs/SSE extension without breaking existing kbar/bidask contracts.

Key constraints:
- Reuse Redis Streams + consumer groups pattern.
- Reuse existing serving endpoint `/v1/stream/sse`.
- Keep auth/rate-limit behavior aligned with current serving baseline.
- Phase 1 supports one configured futures instrument.

## Goals / Non-Goals

**Goals:**
- Add reliable quote worker processing with explicit ACK boundaries.
- Produce quote Redis state (`latest`, `zset`) and minute DB snapshots.
- Add quote REST read APIs and SSE `quote_latest` event.
- Preserve existing serving and auth behavior for kbar/bidask.

**Non-Goals:**
- Multi-instrument quote support in phase 1.
- WebSocket introduction or SSE transport redesign.
- Refactoring existing kbar/bidask processing semantics.
- Implementing quote-series SSE bulk push as a default event in phase 1.

## Decisions

1. Keep worker pattern consistent with existing stream workers.
- Decision: quote worker uses `XAUTOCLAIM` + `XREADGROUP`, and ACK only after compute success, Redis state write success, and DB sink handoff success.
- Why: protects at-least-once behavior while preventing ack-before-state gaps.
- Alternative: ACK after DB commit was rejected due to throughput/latency impact.

2. Use minute snapshot persistence (not per-second DB writes).
- Decision: persist minute-last second snapshot to `quote_features_1m`.
- Why: aligns with approved design and keeps DB write volume controlled.
- Alternative: write every second rejected as unnecessary for phase 1.

3. Reuse existing SSE endpoint and add one quote event.
- Decision: extend `/v1/stream/sse` with `quote_latest`; preserve existing events unchanged.
- Why: lowest integration risk and fastest frontend adoption.
- Alternative: separate quote SSE endpoint rejected for phase 1 due to additional connection lifecycle complexity.

4. Define deterministic no-data minute behavior.
- Decision: if no emitted second snapshot in a minute, skip that minute DB row.
- Why: keeps persisted history semantically tied to observed data.
- Alternative: carry-forward rejected to avoid synthetic history contamination.

5. Keep auth model unchanged for quote serving.
- Decision: quote REST/SSE require authenticated access; visitor denied.
- Why: matches existing serving security baseline.

## Risks / Trade-offs

- [Risk] Quote field mapping semantics may diverge from business expectation in live sessions.  
  -> Mitigation: add runtime diagnostics and configurable mapping for phase-1 verification window.

- [Risk] Extending shared SSE loop can increase polling path load.  
  -> Mitigation: keep change-detection emission policy and existing poll interval controls.

- [Risk] Worker restart may temporarily reset in-memory state.  
  -> Mitigation: rely on pending reclaim + new event stream progression; avoid acking partial failures.

- [Risk] New endpoints may introduce inconsistent error semantics if copied loosely.  
  -> Mitigation: enforce same `503 redis_unavailable` / `503 db_unavailable` mapping used by current serving routes.

## Migration Plan

1. Add quote schema + migration (`quote_features_1m`).
2. Add quote worker runtime (disabled by default until rollout flag is on).
3. Add quote serving store helpers + REST endpoints.
4. Extend `/v1/stream/sse` with `quote_latest`.
5. Enable in dev/staging, verify mapping and push behavior, then enable in production.

Rollback:
- Disable quote worker and quote routes/SSE extension via feature flags or route toggle.
- Existing kbar/bidask flow remains unaffected.

## Open Questions

- Exact runtime mapping defaults for `tick_type` outside/inside semantics may require one more live-market validation pass before production lock.
