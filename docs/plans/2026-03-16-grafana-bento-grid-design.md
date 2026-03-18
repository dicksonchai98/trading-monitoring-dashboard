# Grafana-Style Bento Grid Layout (2026-03-16)

## Goal

Add a Grafana-style 12-column bento grid layout to the right side of the sidebar in `test.pen`.

## Scope

- Add layout grid + empty card placeholders only
- Sidebar remains unchanged
- No actual data content inside cards

## Layout

- 12-column grid in the main content area (right of sidebar)
- Tight spacing (Grafana-like dense layout)
- Small corner radius
- Small text styling for optional card titles (12¡V13px)

## Grid Structure (Balanced)

- Row 1: `8 + 4` (primary + secondary)
- Row 2: `6 + 6` (two mid cards)
- Row 3: `3 + 3 + 3 + 3` (four small cards)

## Visual Style

- Background: deep graphite
- Cards: slightly lighter graphite
- Border: subtle low-contrast stroke
- Radius: small (approx 6px)
- Typography: small size for labels if present

## Notes

- This is a reusable base grid; each page can replace card content later.
- Future: define Tailwind tokens for radius/spacing/typography.
