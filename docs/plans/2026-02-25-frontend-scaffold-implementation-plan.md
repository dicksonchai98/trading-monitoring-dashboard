# Frontend Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up `apps/frontend` with a strict TypeScript React scaffold aligned to MVP frontend contracts (SSE/JWT/RBAC/mock subscription).

**Architecture:** Use Vite + React for app runtime, Tailwind + CSS tokens for visual consistency, and feature-first folder organization. Add route guards + auth store scaffolding now so future API/SSE integration can plug in without refactor.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, React Router, React Query, Zustand, React Hook Form, Zod, Vitest, Testing Library.

---

### Task 1: Base Tooling and Config

**Files:**

- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/index.html`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/tsconfig.node.json`
- Create: `apps/frontend/vite.config.ts`
- Create: `apps/frontend/vitest.config.ts`
- Create: `apps/frontend/postcss.config.cjs`
- Create: `apps/frontend/tailwind.config.ts`

**Step 1: Write the failing test**

Use a build check as the first failing verification:

Run: `npm run build --prefix apps/frontend`
Expected: FAIL due to missing scaffold files/dependencies.

**Step 2: Add base configuration**

Create/modify files listed above with strict TS, Vite React plugin, Tailwind config, and test setup hooks.

**Step 3: Re-run verification**

Run: `npm run build --prefix apps/frontend`
Expected: still FAIL until source files are added.

**Step 4: Commit**

```bash
git add apps/frontend/package.json apps/frontend/index.html apps/frontend/tsconfig.json apps/frontend/tsconfig.node.json apps/frontend/vite.config.ts apps/frontend/vitest.config.ts apps/frontend/postcss.config.cjs apps/frontend/tailwind.config.ts
git commit -m "chore(frontend): add base Vite TS Tailwind tooling config"
```

### Task 2: App Entry and Providers

**Files:**

- Create: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/app/App.tsx`
- Create: `apps/frontend/src/app/providers.tsx`
- Create: `apps/frontend/src/app/router.tsx`
- Create: `apps/frontend/src/lib/query/client.ts`
- Create: `apps/frontend/src/styles/globals.css`

**Step 1: Write failing test**

Run: `npm run build --prefix apps/frontend`
Expected: FAIL if entry/provider/router imports are unresolved.

**Step 2: Implement minimal app runtime**

Add app root, query provider, router provider, and global styles import.

**Step 3: Verify**

Run: `npm run build --prefix apps/frontend`
Expected: progresses to next missing module errors (guards/components/pages).

**Step 4: Commit**

```bash
git add apps/frontend/src/main.tsx apps/frontend/src/app apps/frontend/src/lib/query/client.ts apps/frontend/src/styles/globals.css
git commit -m "feat(frontend): scaffold app entry, providers, and router shell"
```

### Task 3: Shared UI and Layout Shell

**Files:**

- Create: `apps/frontend/src/lib/utils/cn.ts`
- Create: `apps/frontend/src/components/ui/button.tsx`
- Create: `apps/frontend/src/components/ui/card.tsx`
- Create: `apps/frontend/src/components/ui/badge.tsx`
- Create: `apps/frontend/src/components/ui/sidebar.tsx`
- Create: `apps/frontend/src/app/layout/AppShell.tsx`

**Step 1: Write failing test**

Run: `npm run build --prefix apps/frontend`
Expected: FAIL from missing shared UI/layout modules.

**Step 2: Implement minimal reusable primitives**

Add class merge helper and simple shadcn-compatible base primitives.

**Step 3: Verify**

Run: `npm run build --prefix apps/frontend`
Expected: progresses to route/page/store errors.

**Step 4: Commit**

```bash
git add apps/frontend/src/lib/utils/cn.ts apps/frontend/src/components/ui apps/frontend/src/app/layout/AppShell.tsx
git commit -m "feat(frontend): add shared UI primitives and app shell"
```

### Task 4: Auth Types, Store, and Route Guards

**Files:**

- Create: `apps/frontend/src/lib/types/auth.ts`
- Create: `apps/frontend/src/lib/store/auth-store.ts`
- Create: `apps/frontend/src/lib/guards/GuardedRoute.tsx`

**Step 1: Write failing test**

Run: `npm run build --prefix apps/frontend`
Expected: FAIL with unresolved guard/store/type imports in router.

**Step 2: Implement minimal strict models**

Add role/entitlement/session models and guard logic for member/admin access with deterministic redirects.

**Step 3: Verify**

Run: `npm run build --prefix apps/frontend`
Expected: progresses to missing page components.

**Step 4: Commit**

```bash
git add apps/frontend/src/lib/types/auth.ts apps/frontend/src/lib/store/auth-store.ts apps/frontend/src/lib/guards/GuardedRoute.tsx
git commit -m "feat(frontend): add auth models, store, and route guards"
```

### Task 5: Feature Pages and Test Setup

**Files:**

- Create: `apps/frontend/src/features/auth/pages/LoginPage.tsx`
- Create: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.tsx`
- Create: `apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx`
- Create: `apps/frontend/src/features/admin/pages/AdminAuditPage.tsx`
- Create: `apps/frontend/src/features/common/pages/ForbiddenPage.tsx`
- Create: `apps/frontend/src/features/common/pages/NotFoundPage.tsx`
- Create: `apps/frontend/src/test/setup.ts`

**Step 1: Write failing test**

Run: `npm run build --prefix apps/frontend`
Expected: FAIL due to missing route target pages.

**Step 2: Implement minimal page shells**

Create feature pages with clear placeholders aligned to MVP modules and shell layout.

**Step 3: Verify**

Run: `npm run build --prefix apps/frontend`
Expected: PASS.

**Step 4: Commit**

```bash
git add apps/frontend/src/features apps/frontend/src/test/setup.ts
git commit -m "feat(frontend): scaffold MVP feature pages and test setup"
```

### Task 6: Dependency Install and Final Validation

**Files:**

- Modify: `apps/frontend/package-lock.json` (generated)

**Step 1: Install dependencies**

Run: `npm install --prefix apps/frontend`
Expected: successful lockfile generation/update.

**Step 2: Validate build and tests**

Run:

- `npm run build --prefix apps/frontend`
- `npm run test --prefix apps/frontend`

Expected:

- Build succeeds
- Test runner starts successfully (tests may be minimal)

**Step 3: Commit**

```bash
git add apps/frontend/package-lock.json
git commit -m "chore(frontend): install dependencies and validate scaffold"
```
