# Monorepo Structure Design (2026-02-19)

## Goal

Define a monorepo structure and module boundary rules for a React SPA frontend and FastAPI backend, with minimal shared code for contracts/config.

## Architecture

Target layout:

- `apps/frontend` React SPA
- `apps/backend` FastAPI modular monolith
- `packages/shared/contracts` shared data contracts (TickEvent, Snapshot, RBAC enums)
- `packages/shared/config` shared environment schema and config helpers
- `infra` docker-compose and env templates
- `docs` PRDs and plans

Boundary rules:
- `apps/*` may import from `packages/shared/*`
- `packages/shared/*` must not import from `apps/*`
- Shared code is **build-time only**; deploy artifacts remain independent

## Components

- Frontend consumes backend API/SSE and uses shared contracts for type safety
- Backend produces domain events and APIs, uses shared contracts for payload consistency
- Shared packages only contain contracts/config; no runtime coupling across apps

## Data Flow & Config

- Backend produces `TickEvent` and `Snapshot`
- Frontend consumes via API/SSE using shared contracts
- `shared/config` defines env keys and validation
- Frontend uses build-time env injection; backend uses runtime env

## Deployment & Environments

- Default: separate deploys (frontend static build, backend service)
- MVP option: single Docker Compose stack that runs both apps
- `infra` stores compose files and env templates

## Error Handling & Testing

- SSE disconnection: frontend auto-reconnect, backend isolates per-connection failures
- Contract drift: prevented by shared contracts in both builds
- Auth failures: backend is source of truth; frontend handles UX

Testing focus (MVP):
- Contracts compile in both frontend/backend
- Manual boundary verification (no lint enforcement yet)
- Basic SSE connection test

## Decisions

- Use monorepo structure under `apps/` and `packages/`
- Keep shared packages minimal: contracts + config
- Document boundary rules first; defer enforcement tooling
- Use SPA (no SSR/SSG requirements)

## Open Questions

- Add lint/build enforcement for boundary rules in a later phase
- Potentially split shared into `core` / `platform` later if it grows