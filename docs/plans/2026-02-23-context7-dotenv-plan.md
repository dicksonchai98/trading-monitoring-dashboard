# Context7 API Key in .env Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Store the Context7 API key in `.env` as `CONTEXT_API_KEY` and reference it from `.codex/config.toml`.

**Architecture:** Keep secrets in dotenv and pass them to the MCP server via environment variable interpolation in the existing `args` array. No runtime behavior changes beyond where the key is sourced.

**Tech Stack:** dotenv, MCP server config (TOML)

---

### Task 1: Add `CONTEXT_API_KEY` to `.env`

**Files:**
- Modify: `.env`

**Step 1: Write the failing test**

No automated test harness is present for dotenv in this repo. Skip test creation.

**Step 2: Run test to verify it fails**

No automated tests to run for this change.

**Step 3: Write minimal implementation**

Add a new line to `.env`:

```dotenv
CONTEXT_API_KEY=your_api_key_here
```

**Step 4: Run test to verify it passes**

No automated tests to run for this change.

**Step 5: Commit**

```bash
git add .env
git commit -m "chore: add context7 api key env var"
```

### Task 2: Reference `CONTEXT_API_KEY` in `.codex/config.toml`

**Files:**
- Modify: `.codex/config.toml`

**Step 1: Write the failing test**

No automated test harness is present for MCP config parsing. Skip test creation.

**Step 2: Run test to verify it fails**

No automated tests to run for this change.

**Step 3: Write minimal implementation**

Replace the hardcoded API key with the env var:

```toml
args = ["-y", "@upstash/context7-mcp", "--api-key", "${CONTEXT_API_KEY}"]
```

**Step 4: Run test to verify it passes**

Manual check: start the MCP server and confirm it authenticates with the provided key.

**Step 5: Commit**

```bash
git add .codex/config.toml
git commit -m "chore: use env var for context7 api key"
```

### Task 3: Manual verification

**Files:**
- No file changes

**Step 1: Manual run**

Run the MCP server startup command used by your environment and confirm it authenticates without prompting for `YOUR_API_KEY`.

**Step 2: Commit**

No commit required.
