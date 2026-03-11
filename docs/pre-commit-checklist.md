# Pre-Commit Checklist

This repo enforces the following hooks from `.pre-commit-config.yaml`. Any backend Python changes must comply before commit.

## Hooks

- `ruff` (with `--fix`)
  - Scope: `apps/backend/**/*.py`
  - Fixes lint issues and may modify files
- `ruff-format`
  - Scope: `apps/backend/**/*.py`
  - Formats Python files and may modify files

## Practical Rules For Contributors (Human + AI)

1. Run formatting/linting on touched backend Python files before commit.
2. Expect auto-fixes to change files; re-stage files after hooks run.
3. If a commit fails due to hooks, do not bypass. Fix the issues and re-run.

## Common Failures And Fixes

- `B904`: In `except` blocks, use `except Exception as err:` and `raise ... from err`.
- `E501`: Split long lines to keep width within formatter limits.

## Quick Commands (PowerShell)

```powershell
# Run hooks manually on backend Python files
pre-commit run ruff --all-files
pre-commit run ruff-format --all-files

# Or run the full hook set
pre-commit run --all-files
```
