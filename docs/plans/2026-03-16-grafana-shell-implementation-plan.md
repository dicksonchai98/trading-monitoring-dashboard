# Grafana-Like Frontend Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the first pass of a Grafana-like, high-density trading shell for the frontend, including semantic tokens, shell primitives, and stacked bento grid dashboard sections.

**Architecture:** The frontend keeps the current React and Tailwind structure, but introduces a semantic token layer in global CSS and Tailwind config. Shared primitives absorb the new shell language first, then the dashboard page is refactored into reusable page header, panel header, and stacked grid sections so the new system is visible without rewriting every route.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3, Vitest, React Testing Library

---

### Task 1: Add failing tests for shell and dashboard hierarchy

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.tsx`
- Create: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
- Modify: `apps/frontend/src/app/layout/AppShell.tsx`
- Create: `apps/frontend/src/app/layout/AppShell.test.tsx`
- Check: `apps/frontend/src/test/setup.ts`

**Step 1: Write the failing dashboard test**

Add a test that renders the realtime dashboard page and expects:
- a page header title
- a grid section header for the primary section
- a grid section header for the secondary section
- repeated panel header labels inside panel cards

**Step 2: Run test to verify it fails**

Run: `npm test -- RealtimeDashboardPage.test.tsx`

Expected: FAIL because the current page only renders a simple three-card layout and does not contain the required section structure.

**Step 3: Write the failing shell test**

Add a test that renders the app shell with mocked outlet content and expects:
- a darker shell container
- a sidebar region
- a main canvas region

**Step 4: Run test to verify it fails**

Run: `npm test -- AppShell.test.tsx`

Expected: FAIL because the current shell does not yet expose the new structure and semantic hooks expected by the test.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx apps/frontend/src/app/layout/AppShell.test.tsx
git commit -m "test: define grafana shell and dashboard structure"
```

### Task 2: Extend semantic design tokens

**Files:**
- Modify: `apps/frontend/src/styles/globals.css`
- Modify: `apps/frontend/tailwind.config.ts`

**Step 1: Write the failing token test or assertion target**

If there is an existing CSS snapshot or component test covering token-driven class usage, extend it first. If there is no practical CSS-level test, document that this task is verified through dependent component tests in later tasks and keep this task implementation-only.

**Step 2: Implement the token foundation**

Add semantic tokens for:
- shell
- panel hover
- subtle foreground
- strong border
- info
- success
- warning
- danger
- chart series colors

Map them through Tailwind so components can use semantic utility names instead of raw values.

**Step 3: Run focused verification**

Run: `npm run typecheck`

Expected: PASS

**Step 4: Commit**

```bash
git add apps/frontend/src/styles/globals.css apps/frontend/tailwind.config.ts
git commit -m "feat: add grafana shell design tokens"
```

### Task 3: Restyle shared shell primitives

**Files:**
- Modify: `apps/frontend/src/components/ui/card.tsx`
- Modify: `apps/frontend/src/components/ui/sidebar.tsx`
- Modify: `apps/frontend/src/components/ui/button.tsx`
- Modify: `apps/frontend/src/components/ui/badge.tsx`
- Create or modify tests for any component behavior that changes materially

**Step 1: Write failing tests for changed component behavior**

Add or update tests to assert:
- `Card` uses dense monitoring-panel classes
- `Sidebar` exposes clear active navigation state and shell hierarchy
- `Badge` supports semantic status variants
- `Button` supports dense tool-like variants if variant logic changes

**Step 2: Run tests to verify they fail**

Run: `npm test -- card badge button sidebar`

Expected: FAIL for the components whose new semantic variants or structure do not yet exist.

**Step 3: Write minimal implementation**

Update the shared primitives so they consume the new semantic tokens and reflect the high-density monitoring look.

**Step 4: Run tests to verify they pass**

Run: `npm test -- card badge button sidebar`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/components/ui/card.tsx apps/frontend/src/components/ui/sidebar.tsx apps/frontend/src/components/ui/button.tsx apps/frontend/src/components/ui/badge.tsx
git commit -m "feat: restyle shell primitives for grafana theme"
```

### Task 4: Add reusable page and panel header components

**Files:**
- Create: `apps/frontend/src/components/ui/page-header.tsx`
- Create: `apps/frontend/src/components/ui/panel-header.tsx`
- Create: `apps/frontend/src/components/ui/page-header.test.tsx`
- Create: `apps/frontend/src/components/ui/panel-header.test.tsx`

**Step 1: Write the failing tests**

Add tests that assert:
- `PageHeader` renders title plus compact context line
- `PanelHeader` renders title plus metadata with dense layout semantics

**Step 2: Run tests to verify they fail**

Run: `npm test -- page-header panel-header`

Expected: FAIL because the files and components do not yet exist.

**Step 3: Write minimal implementation**

Create the two components using semantic tokens and compact layout rules.

**Step 4: Run tests to verify they pass**

Run: `npm test -- page-header panel-header`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/components/ui/page-header.tsx apps/frontend/src/components/ui/panel-header.tsx apps/frontend/src/components/ui/page-header.test.tsx apps/frontend/src/components/ui/panel-header.test.tsx
git commit -m "feat: add page and panel header components"
```

### Task 5: Refactor the app shell

**Files:**
- Modify: `apps/frontend/src/app/layout/AppShell.tsx`
- Update: `apps/frontend/src/app/layout/AppShell.test.tsx`

**Step 1: Confirm the shell test still fails for the expected reason**

Run: `npm test -- AppShell.test.tsx`

Expected: FAIL if the shell structure or class hooks are still missing.

**Step 2: Implement the shell layout**

Update the shell to:
- emphasize the shell/sidebar split
- expose a denser main canvas
- preserve current routing behavior

**Step 3: Run shell test**

Run: `npm test -- AppShell.test.tsx`

Expected: PASS

**Step 4: Commit**

```bash
git add apps/frontend/src/app/layout/AppShell.tsx apps/frontend/src/app/layout/AppShell.test.tsx
git commit -m "feat: apply grafana shell layout"
```

### Task 6: Refactor the realtime dashboard into stacked bento sections

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.tsx`
- Update: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
- Reuse: `apps/frontend/src/components/ui/card.tsx`
- Reuse: `apps/frontend/src/components/ui/page-header.tsx`
- Reuse: `apps/frontend/src/components/ui/panel-header.tsx`
- Reuse: `apps/frontend/src/components/ui/badge.tsx`

**Step 1: Confirm the dashboard test still fails for the expected reason**

Run: `npm test -- RealtimeDashboardPage.test.tsx`

Expected: FAIL because the old dashboard structure is still present.

**Step 2: Implement the minimal dashboard refactor**

Replace the simple summary card grid with:
- one page header
- one primary grid section containing two rows
- one secondary grid section containing the third row
- equal panel heights across all rows
- grid section headers above each section

**Step 3: Run dashboard test**

Run: `npm test -- RealtimeDashboardPage.test.tsx`

Expected: PASS

**Step 4: Commit**

```bash
git add apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx
git commit -m "feat: refactor dashboard into bento grid sections"
```

### Task 7: Full verification

**Files:**
- No new files required

**Step 1: Run frontend test suite**

Run: `npm test`

Expected: PASS

**Step 2: Run frontend typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Review changed files**

Run:

```bash
git diff -- apps/frontend/src apps/frontend/tailwind.config.ts apps/frontend/src/styles/globals.css
```

Expected: only the planned shell, token, primitive, and dashboard files changed.

**Step 4: Commit**

```bash
git add apps/frontend
git commit -m "feat: add grafana-like frontend shell system"
```
