# Treemap stock names design

## Problem

The treemap demo page currently shows stock symbols only. Users need both the treemap tiles and the right-side top/bottom contributor ranking to include stock names, while preserving the existing contribution-focused layout.

## Scope

- Update `TreemapDemoPage` only.
- Show stock code plus localized stock name in the treemap tiles when space allows.
- Show stock code plus localized stock name in the right-side ranking items.
- Keep the current mock-data fallback and SSE-driven data flow unchanged.

## Approach

Use the existing symbol-to-name mapping already defined in `TreemapDemoPage` as the source of truth for display labels. Add a small shared formatter inside the page so treemap tiles and ranking rows render the same label shape and locale behavior.

## UI behavior

### Treemap

- For stock leaf tiles, render:
  - first line: stock code
  - second line: localized stock name
- If the tile is too small, keep the current fallback behavior and show only the stock code.
- Contribution value rendering stays unchanged.

### Ranking panel

- For each ranking row, render `code + localized name`.
- Preserve the existing contribution color treatment and ranking number layout.
- If a symbol is not present in the mapping, fall back to the symbol only.

## Data and localization

- Reuse the existing `STOCK_NAME_MAP` in the page.
- Use the active locale to choose Chinese or English stock name.
- Do not change SSE payload contracts or ranking/sector data structures.

## Error handling

- Missing mapping must not break rendering.
- Unknown symbols render as symbol-only labels.
- No new loading or error UI is introduced.

## Testing

- Add or update page-level tests for `TreemapDemoPage`.
- Verify ranking rows include both code and localized name.
- Verify treemap leaf labels include stock names when rendered with mock data.
- Verify unknown symbols still render safely.
