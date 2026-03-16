# Frontend Auth Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder login page with a tab-based login/register screen that calls backend auth APIs and updates frontend session state.

**Architecture:** Keep a single public `/login` route and render two form modes inside the same page. Use `react-hook-form` + `zod` for validation, `@tanstack/react-query` mutations for API calls, and a small token decode helper to derive role data from the returned access token so the existing route guard can redirect users back to the requested page.

**Tech Stack:** React 19, TypeScript, React Router, React Query, React Hook Form, Zod, Vitest, Testing Library

---

### Task 1: Define auth page behavior with failing tests

**Files:**
- Create: `apps/frontend/src/features/auth/pages/LoginPage.test.tsx`
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.tsx`

**Step 1: Write failing tests**
- Assert login mode renders email/password fields and submit button text.
- Assert register tab switches visible copy and submit text.
- Assert successful login stores session and navigates back to `state.from`.
- Assert failed submit shows backend error copy.

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- src/features/auth/pages/LoginPage.test.tsx`
Expected: FAIL because the page is still a placeholder scaffold.

### Task 2: Add auth form support modules

**Files:**
- Create: `apps/frontend/src/features/auth/api/auth.ts`
- Create: `apps/frontend/src/features/auth/validation/auth-schema.ts`
- Create: `apps/frontend/src/features/auth/lib/token.ts`
- Modify: `apps/frontend/src/lib/store/auth-store.ts`
- Modify: `apps/frontend/src/lib/types/auth.ts`

**Step 1: Implement minimal helpers**
- Add login/register fetch functions.
- Add form schemas and types.
- Add access-token payload decoding helper.
- Align frontend role mapping with backend token claims.

### Task 3: Implement tab auth page

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.tsx`

**Step 1: Replace placeholder UI**
- Add tab switcher, shared form fields, loading state, inline error state, and redirect-on-success behavior.
- Redirect authenticated users away from `/login`.

### Task 4: Verify behavior

**Files:**
- Test: `apps/frontend/src/features/auth/pages/LoginPage.test.tsx`

**Step 1: Run focused tests**

Run: `npm.cmd run test -- src/features/auth/pages/LoginPage.test.tsx`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm.cmd run typecheck`
Expected: PASS
