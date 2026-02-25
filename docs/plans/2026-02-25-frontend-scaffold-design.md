# Frontend Scaffold Design (MVP)

## Goal

Create a production-ready frontend scaffold in `apps/frontend` that matches MVP contracts:

- Near-month futures dashboard UX
- SSE-first realtime model
- JWT + RBAC route access
- Mock subscription entitlement flow

## Scope

In this change, we create foundational structure and starter pages/components only.  
No real backend integration or payment provider logic is added.

## Architecture

- Framework: React + TypeScript + Vite
- Styling: Tailwind + CSS variable design tokens
- UI layer: shadcn-compatible primitives + domain components
- Data/state:
  - React Query for server state
  - Zustand for client global state (auth/session/sse status)
- Routing:
  - public routes
  - member-guarded routes (with entitlement)
  - admin-guarded routes

## Folder Blueprint

```txt
apps/frontend/
  src/
    app/                    # app entry, providers, router, shell
      layout/
    features/
      auth/pages/
      dashboard/pages/
      subscription/pages/
      admin/pages/
      common/pages/
    components/
      ui/                   # reusable UI primitives
    lib/
      guards/
      query/
      store/
      types/
      utils/
    styles/
    test/
```

## Component Layering Strategy

1. Tokens and primitives first:
- colors, spacing, radius, typography, elevation
- `Card`, `Badge`, `Button`, `Sidebar`

2. App shell:
- `AppShell` with shared sidebar/navigation

3. Page composition:
- dashboard/subscription/admin pages built from shared primitives

4. Data adapters:
- hooks/services added after scaffold to connect SSE/auth APIs

## Guard and State Contract

- Role model: `visitor | member | admin`
- Member routes require active entitlement
- Guard returns deterministic redirects for unauthorized/forbidden
- Placeholder auth store included for immediate UI wiring

## Output of This Design

- Runnable scaffold with strict TypeScript
- Shared layout and route guards
- Starter pages that mirror current UI design direction
- Stable base for next implementation phase (API + SSE wiring)

