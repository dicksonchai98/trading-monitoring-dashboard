# GitHub Actions Fast CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fast GitHub Actions workflow that runs on PRs targeting `master`, checking backend (ruff + pytest) and frontend (npm build) without deployment.

**Architecture:** Single workflow with two parallel jobs (`backend`, `frontend`) to keep checks fast. Backend uses Python 3.10 and runs ruff + pytest; frontend uses Node 20 and runs `npm run build`.

**Tech Stack:** GitHub Actions, Python 3.10, Node.js 20, ruff, pytest, npm.

---

### Task 1: Add fast CI workflow for PRs to master

**Files:**
- Create: `.github/workflows/ci-fast.yml`

**Step 1: Write the workflow file**

Create `.github/workflows/ci-fast.yml` with:
- Trigger: `pull_request` targeting `master`
- Job `backend`:
  - Checkout
  - Setup Python 3.10
  - Install `apps/backend/requirements.txt`
  - Run `python -m ruff check apps/backend`
  - Run `python -m ruff format --check apps/backend`
  - Run `pytest` limited to backend (e.g., `apps/backend/tests`)
- Job `frontend`:
  - Checkout
  - Setup Node 20
  - Install dependencies in `apps/frontend`
  - Run `npm run build`

**Step 2: Validate locally**

No local GitHub Actions runner in this repo. Validate by visual review and YAML correctness.

**Step 3: Commit**

```bash
git add .github/workflows/ci-fast.yml
git commit -m "ci: add fast PR checks for frontend and backend"
```
