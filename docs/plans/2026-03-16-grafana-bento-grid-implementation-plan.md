# Grafana-Style Bento Grid Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Grafana-style 12-column bento grid layout to the right of the sidebar in `test.pen`.

**Architecture:** Use Pencil MCP to create a grid container in the main content area and insert empty card frames arranged as 12-column rows (8+4, 6+6, 3+3+3+3) with tight gaps, small radius, and subtle borders.

**Tech Stack:** Pencil MCP (`mcp__pencil__*`), `.pen` design file.

---

### Task 1: Inspect current `test.pen` layout

**Files:**
- Modify: `test.pen` (read-only inspection)

**Step 1: Read top-level nodes**

Run: `mcp__pencil__batch_get` (no `nodeIds`) to list top-level frames.
Expected: find existing `Dashboard Canvas`, `Grafana Sidebar`, `Main Content`.

**Step 2: Snapshot main content layout**

Run: `mcp__pencil__snapshot_layout` with `parentId` = main content node id, `maxDepth: 2`.
Expected: confirm empty or ready for insertion.

**Step 3: Commit**

Run:
```bash
git status --short
```
Expected: no changes yet.

### Task 2: Create grid container

**Files:**
- Modify: `test.pen`

**Step 1: Insert grid container frame**

Run: `mcp__pencil__batch_design` to insert a `frame` inside Main Content with:
- `layout: vertical`
- tight `gap` (8¡V12)
- padding (16¡V20)
- dark graphite fill
- `placeholder: true`

Expected: new grid container frame.

**Step 2: Commit**

```bash
git add test.pen
git commit -m "feat: add bento grid container"
```

### Task 3: Add bento grid rows and cards

**Files:**
- Modify: `test.pen`

**Step 1: Row 1 (8 + 4)**

Run: `mcp__pencil__batch_design` to add a horizontal row frame with two card frames.
Expected: two cards with small radius and subtle border.

**Step 2: Row 2 (6 + 6)**

Run: `mcp__pencil__batch_design` to add second row with two cards.
Expected: two mid-size cards.

**Step 3: Row 3 (3 + 3 + 3 + 3)**

Run: `mcp__pencil__batch_design` to add third row with four small cards.
Expected: four equal small cards.

**Step 4: Visual verification**

Run: `mcp__pencil__get_screenshot` on the grid container.
Expected: Grafana-like tight bento grid with consistent spacing.

**Step 5: Commit**

```bash
git add test.pen
git commit -m "feat: add grafana-style bento grid"
```
