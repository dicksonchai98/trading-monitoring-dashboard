# Dockerfile Design (2026-03-03)

## Goal

Create Dockerfiles for the frontend and backend apps to provide fixed execution environments, local deployability, and service isolation.

## Scope

- Two Dockerfiles:
  - `apps/frontend/Dockerfile` (static site served with `serve`)
  - `apps/backend/Dockerfile` (FastAPI served with `uvicorn`)

## Architecture

### Frontend

- Base image: Node LTS (e.g., `node:20-slim`).
- Install dependencies.
- Run `npm run build`.
- Serve static output via `serve` on `PORT` (default 3000).

### Backend

- Base image: Python 3.12 slim.
- Install `requirements.txt`.
- Start `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

## Data Flow

- Frontend: build static assets -> `serve` hosts HTTP endpoint.
- Backend: `uvicorn` starts FastAPI -> provides API and SSE endpoints.

## Error Handling

- Build or dependency install failures should fail the image build or container startup.
- Runtime startup failures should exit quickly for clear diagnostics.

## Testing

- No new tests. Dockerfiles only.
