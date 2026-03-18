# Frontend Folder and Component Blueprint

## Directory Layers

```txt
src/
  app/
    layout/
  features/
    auth/pages/
    dashboard/pages/
    subscription/pages/
    admin/pages/
    common/pages/
  components/
    ui/
  lib/
    guards/
    query/
    store/
    types/
    utils/
  styles/
  test/
```

## Component Hierarchy

1. Design tokens and primitives:
- `styles/globals.css`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`

2. Layout shell:
- `app/layout/AppShell.tsx`
- `components/ui/sidebar.tsx`

3. Route and guard layer:
- `app/router.tsx`
- `lib/guards/GuardedRoute.tsx`
- `lib/store/auth-store.ts`

4. Feature pages:
- `features/*/pages/*.tsx`

## Rules

- Keep server state in React Query.
- Keep auth/session and UI runtime state in Zustand.
- Keep route access checks in `GuardedRoute`.
- Keep feature logic in `features/*`, not in `components/ui`.
