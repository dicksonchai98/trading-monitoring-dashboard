# Context7 API Key via .env Design

Date: 2026-02-23

## Summary
Move the Context7 API key out of `.codex/config.toml` and into `.env` as `CONTEXT_API_KEY`, then reference it from the MCP server args using environment variable interpolation.

## Architecture
- Store secret in `.env` (`CONTEXT_API_KEY=...`).
- Reference the env var in `.codex/config.toml` for the Context7 MCP server args.

## Components
- `.env`: add `CONTEXT_API_KEY`.
- `.codex/config.toml`: replace hardcoded API key with `${CONTEXT_API_KEY}`.

## Data Flow
`.env` loads into the process environment -> MCP startup reads `CONTEXT_API_KEY` -> `config.toml` passes it to `@upstash/context7-mcp` via `--api-key`.

## Error Handling
No additional handling. Missing `CONTEXT_API_KEY` will surface as an MCP auth/startup error.

## Testing
Manual verification by launching the MCP server and confirming it authenticates using the env var.
