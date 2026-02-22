# Trading Monitoring Dashboard

Monorepo for a futures monitoring dashboard.

## Structure
- `apps/frontend`: React frontend application (SPA)
- `apps/backend`: FastAPI backend services
- `packages/shared/contracts`: shared data contracts (TickEvent, Snapshot, RBAC enums)
- `packages/shared/config`: shared environment schema and config helpers
- `infra`: local infrastructure and deployment configs
- `docs`: design, plans, and product docs

## Boundary Rules
- `apps/*` may import from `packages/shared/*`
- `packages/shared/*` MUST NOT import from `apps/*`
- Shared code is build-time only; frontend and backend deploy independently
