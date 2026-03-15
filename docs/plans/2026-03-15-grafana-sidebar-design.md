# Grafana-Style Sidebar Design (2026-03-15)

## Goal

Add a Grafana-style left sidebar to `test.pen`.

## Scope

- Sidebar only (no main content changes)
- Static layout (no interaction)
- Grafana-like styling: deep graphite background, high-contrast text

## Layout

- Position: left edge, full height
- Constraints: `x=0`, `y=0`, `top/right/bottom/left=0`
- Width: `20%`

## Structure

1. **Logo/Org block**
   - Simple wordmark + org name
2. **Search**
   - Minimal input-like frame (placeholder text)
3. **Nav list**
   - Items: `Dashboards`, `Alerting`, `Explore`, `Settings`
   - Active state: left highlight bar + brighter text
4. **Footer (optional)**
   - Small text for version/status

## Visual Style

- Background: near-black graphite
- Text: light gray / white
- Active item: accent bar (teal/cyan) and stronger contrast
- Icons: simple geometric placeholders (small squares/circles)

## Notes

- Pure Grafana feel (dense, utilitarian)
- Keep padding tight and consistent
