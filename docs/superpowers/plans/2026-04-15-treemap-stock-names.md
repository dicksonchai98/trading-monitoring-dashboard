# Treemap Stock Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show localized stock names alongside stock codes in the treemap tiles and the right-side top/bottom ranking on `TreemapDemoPage`.

**Architecture:** Keep the change scoped to `TreemapDemoPage` and add one small in-file formatting layer that converts a symbol into a locale-aware display label. Cover the UI change with a new page-level Vitest file that renders the page through `I18nProvider`, seeds the realtime store directly, and mocks Recharts only as much as needed to make treemap leaf text assertions deterministic.

**Tech Stack:** React 19, TypeScript, Zustand, Recharts, Vitest, Testing Library

---

### Task 1: Add failing tests for ranking labels and locale fallback

**Files:**
- Create: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx`
- Reference: `apps/frontend/src/lib/i18n/index.tsx`
- Reference: `apps/frontend/src/features/realtime/store/realtime.store.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { TreemapDemoPage } from "@/features/dashboard/pages/TreemapDemoPage";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

function renderPage(): void {
  render(
    <I18nProvider>
      <TreemapDemoPage />
    </I18nProvider>,
  );
}

describe("TreemapDemoPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("ui.language.preset", "en");
    useRealtimeStore.getState().resetRealtime();
  });

  it("shows ranking rows with code and localized stock name", () => {
    renderPage();

    expect(screen.getByText("2330 TSMC")).toBeInTheDocument();
    expect(screen.getByText("2412 Chunghwa Telecom")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: FAIL because the ranking panel still renders symbol-only text such as `2330` and `2412`.

- [ ] **Step 3: Extend the failing test with the unknown-symbol fallback**

```tsx
it("falls back to symbol-only labels when a stock name is unavailable", () => {
  useRealtimeStore.setState({
    indexContribRanking: {
      top: [{ rank_no: 1, symbol: "9999", contribution_points: 1.23 }],
      bottom: [],
    },
  });

  renderPage();

  expect(screen.getByText("9999")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run test to verify the fallback assertion fails for the right reason**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: The suite still fails on the earlier ranking-label assertion; no test should fail due to syntax, import, or provider setup issues.

- [ ] **Step 5: Commit the red test scaffold**

```bash
git add apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx
git commit -m "test: cover treemap ranking stock names"
```

### Task 2: Implement shared label formatting and ranking rendering

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx`

- [ ] **Step 1: Write the minimal implementation**

Add locale access plus small formatting helpers near the existing mapping:

```tsx
const { locale } = useI18n();

const getStockName = (symbol: string): string | null => {
  const stockInfo = STOCK_NAME_MAP[symbol];
  if (!stockInfo) {
    return null;
  }
  return locale === "zh-TW" ? stockInfo.zh : stockInfo.en;
};

const formatStockLabel = (symbol: string): string => {
  const stockName = getStockName(symbol);
  return stockName ? `${symbol} ${stockName}` : symbol;
};
```

Then update the ranking rows:

```tsx
<span className="font-medium text-foreground">
  {formatStockLabel(item.symbol)}
</span>
```

- [ ] **Step 2: Run the test to verify it passes**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: PASS for the ranking label and unknown-symbol fallback coverage.

- [ ] **Step 3: Add a locale-sensitive regression**

Expand the same test file:

```tsx
it("uses Chinese stock names when the locale is zh-TW", () => {
  window.localStorage.setItem("ui.language.preset", "zh-TW");

  renderPage();

  expect(screen.getByText("2330 台積電")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the locale regression to verify it stays green**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: PASS, proving the page now reads `locale` from `useI18n()` correctly.

- [ ] **Step 5: Commit the ranking implementation**

```bash
git add apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx
git commit -m "feat: show stock names in treemap rankings"
```

### Task 3: Add failing treemap tile tests for dual-line labels

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx`

- [ ] **Step 1: Mock Recharts just enough to expose the treemap content callback**

At the top of the test file, add:

```tsx
import { vi } from "vitest";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="mock-responsive-container">{children}</div>
    ),
    Treemap: ({
      data,
      content,
    }: {
      data: Array<{ children?: Array<{ name: string; size: number; contribution_points: number }> }>;
      content: (props: Record<string, unknown>) => React.ReactNode;
    }) => (
      <svg data-testid="mock-treemap">
        {data.flatMap((sector, sectorIndex) =>
          (sector.children ?? []).map((child, childIndex) =>
            content({
              root: { children: data },
              depth: 2,
              x: childIndex * 120,
              y: sectorIndex * 80,
              width: 100,
              height: 60,
              index: childIndex,
              name: child.name,
              contribution_points: child.contribution_points,
            }),
          ),
        )}
      </svg>
    ),
  };
});
```

- [ ] **Step 2: Write the failing treemap assertions**

```tsx
it("shows stock code and stock name inside treemap leaf labels when the tile is large enough", () => {
  renderPage();

  expect(screen.getAllByText("2330")[0]).toBeInTheDocument();
  expect(screen.getByText("TSMC")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: FAIL because the current custom treemap content renders only the symbol text and not a second stock-name line.

- [ ] **Step 4: Add the small-tile safeguard test**

```tsx
it("keeps symbol-only labels when the treemap tile is too small for a stock name", () => {
  renderPage();

  expect(screen.queryByText("MediaTek")).toBeInTheDocument();
});
```

Then change the mock for one leaf width/height to a smaller box in a dedicated render path before implementation.

- [ ] **Step 5: Run the treemap tests again to keep the suite red for the right reason**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: The suite still fails only because the second line is not implemented yet.

### Task 4: Implement dual-line treemap labels and keep fallback behavior

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx`

- [ ] **Step 1: Update the custom treemap content signature to accept a formatter**

```tsx
function CustomizedContent(
  props: TreemapNode & {
    stockName?: string | null;
    onSectorDetected?: (
      name: string,
      x: number,
      y: number,
      width: number,
    ) => void;
  },
): JSX.Element {
  const { stockName } = props;
```

- [ ] **Step 2: Add the second line only when the tile is large enough**

```tsx
const showStockNameLabel = depth === 2 && width > 72 && height > 42 && Boolean(stockName);

{showSymbolLabel ? (
  <text
    x={x + width / 2}
    y={y + height / 2 + (showContributionLabel ? -14 : -2)}
    textAnchor="middle"
    fill="#f8fafc"
    fontSize={13}
    fontWeight={600}
  >
    {name}
  </text>
) : null}

{showStockNameLabel ? (
  <text
    x={x + width / 2}
    y={y + height / 2 + 2}
    textAnchor="middle"
    fill="#f8fafc"
    fontSize={11}
    fontWeight={400}
  >
    {stockName}
  </text>
) : null}
```

- [ ] **Step 3: Pass the localized stock name into the treemap renderer**

```tsx
content={(props) => (
  <CustomizedContent
    {...props}
    stockName={typeof props.name === "string" ? getStockName(props.name) : null}
    onSectorDetected={(name, x, y, width) => {
      setSectorLabels((prev) => {
        if (prev.some((s) => s.name === name && s.x === x && s.y === y)) {
          return prev;
        }
        return [...prev, { name, x, y, width }];
      });
    }}
  />
)}
```

- [ ] **Step 4: Run the page test suite to verify all cases pass**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: PASS for ranking labels, locale switching, treemap second-line names, and symbol-only fallback.

- [ ] **Step 5: Commit the treemap label implementation**

```bash
git add apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx
git commit -m "feat: show stock names in treemap tiles"
```

### Task 5: Final verification and cleanup

**Files:**
- Verify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx`
- Verify: `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx`
- Verify: `docs/superpowers/specs/2026-04-15-treemap-stock-names-design.md`

- [ ] **Step 1: Run the targeted page test one final time**

Run:

```bash
cd apps/frontend
npm test -- src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: PASS

- [ ] **Step 2: Review the final diff**

Run:

```bash
git --no-pager diff -- apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx apps/frontend/src/features/dashboard/pages/TreemapDemoPage.test.tsx
```

Expected: Diff only shows label-formatting and test coverage changes for the treemap page.

- [ ] **Step 3: Update the plan tracking status**

Run:

```bash
git status --short
```

Expected: Only the intended treemap page and test file remain modified before the final feature commit/merge workflow.
