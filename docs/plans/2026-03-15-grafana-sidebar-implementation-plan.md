# Grafana-Style Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Grafana-style left sidebar to `test.pen`.

**Architecture:** Use Pencil MCP to create a new left-anchored sidebar frame in `test.pen`, then add logo/search/nav elements with Grafana-like styling.

**Tech Stack:** Pencil MCP (`mcp__pencil__*`), `.pen` design file.

---

### Task 1: Inspect `test.pen` structure

**Files:**
- Modify: `test.pen` (read-only inspection)

**Step 1: Read top-level nodes**

Run: use `mcp__pencil__get_editor_state` with `include_schema=true` (if needed), then `mcp__pencil__batch_get` with no `nodeIds` to list top-level frames.
Expected: list of canvas nodes / frames to place sidebar relative to.

**Step 2: Identify empty space**

Run: `mcp__pencil__find_empty_space_on_canvas` (direction `left`, width `280`, height `900`, padding `40`).
Expected: coordinates for a clean insertion spot if needed.

**Step 3: Commit**

Run:
```bash
git status --short
```
Expected: no changes yet.

### Task 2: Create sidebar frame

**Files:**
- Modify: `test.pen`

**Step 1: Insert sidebar frame**

Run: `mcp__pencil__batch_design` to insert a frame with `width: "20%"`, `height: "fill_container"`, `x:0`, `y:0`, dark fill.
Expected: new sidebar frame node.

**Step 2: Add layout/padding**

Run: `mcp__pencil__batch_design` to set layout `vertical`, padding, gap.
Expected: sidebar has consistent spacing.

**Step 3: Commit**

```bash
git add test.pen
git commit -m "feat: add grafana-style sidebar frame"
```

### Task 3: Populate sidebar content

**Files:**
- Modify: `test.pen`

**Step 1: Add logo/org block**

Run: `mcp__pencil__batch_design` to insert logo text + org name.
Expected: top block rendered.

**Step 2: Add search block**

Run: `mcp__pencil__batch_design` to insert search container with placeholder text.
Expected: search row rendered.

**Step 3: Add nav list**

Run: `mcp__pencil__batch_design` to insert nav items with one active state.
Expected: nav list aligned and readable.

**Step 4: Visual verification**

Run: `mcp__pencil__get_screenshot` on the sidebar frame.
Expected: Grafana-style sidebar appearance.

**Step 5: Commit**

```bash
git add test.pen
git commit -m "feat: add grafana-style sidebar content"
```
