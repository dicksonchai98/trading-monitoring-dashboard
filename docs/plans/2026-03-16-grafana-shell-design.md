# Grafana-Like Frontend Shell Design (2026-03-16)

## Goal

Define a high-density, Grafana-like frontend design system for the trading dashboard. The system should support a monitoring and trading-desk feel rather than a generic SaaS admin look. It must provide a reusable shell, semantic design tokens, and dashboard layout patterns that can be applied consistently across the React frontend.

## Design Direction

- Visual direction: high-contrast trading desk
- Density: high density with preserved readability
- Mood: operational, sharp, technical, data-first
- Layout model: app shell outside, stacked bento grid sections inside

This is intentionally not a full clone of Grafana. The goal is to borrow the operational clarity and dense monitoring language while keeping project-specific semantics and simpler implementation boundaries.

## Core Principles

- Prioritize information density over decoration.
- Use semantic tokens instead of raw color values in component code.
- Separate shell hierarchy from panel hierarchy.
- Keep page headers understated; panels are the dominant surface.
- Use bento grid sections as the primary dashboard composition unit.
- Ensure a consistent row rhythm inside each dashboard section.

## System Layers

### 1. Tokens

The design system starts with semantic tokens exposed through CSS custom properties and mapped into Tailwind utilities.

Token groups:

- Surface: `background`, `shell`, `card`, `panel-hover`
- Text: `foreground`, `muted-foreground`, `subtle-foreground`
- Border: `border`, `border-strong`
- Accent: `primary`, `info`
- Status: `success`, `warning`, `danger`
- Data visualization: `chart-1` through `chart-6`
- Shape: `radius`

These tokens should be sufficient to style the shell, panel states, navigation, badges, and future chart legends without scattering hardcoded values.

### 2. Shell

The shell consists of:

- Left sidebar navigation rail
- Main content canvas
- Page header area inside the main content

Shell rules:

- Sidebar is visually darker than panel surfaces.
- Main canvas is the deepest background.
- The shell uses borders and brightness contrast rather than heavy shadows.
- Navigation states must be high contrast and obvious in dense layouts.

### 3. Primitives

Primitive UI components should be normalized to the new tokens:

- `Card` becomes the base monitoring panel surface.
- `Button` supports primary, secondary, and ghost usage in a dense toolbar style.
- `Badge` supports semantic states for operational dashboards.
- `Sidebar` becomes a system navigation component instead of page-specific markup.

### 4. Dashboard Patterns

Dashboard pages should be composed from reusable patterns:

- `PageHeader`
- `GridSection`
- `PanelHeader`
- `PanelBody`
- dense table/list rows
- status strips or signal bars

These patterns should be reusable rather than embedded ad hoc in each page.

## Layout Model

### App Shell

- The application uses a persistent left sidebar and a single main content canvas.
- The page header sits at the top-left of the main content region.
- The page header is informational, not dominant.

### Dashboard Interior

The dashboard interior uses stacked bento grid sections.

Each section contains:

- a grid header at the top-left
- one or more rows of panels
- panels that vary by column span
- a consistent panel height rhythm

For the current dashboard direction:

- the first section contains rows one and two
- the second section contains row three

This makes each section a reusable dashboard composition unit with its own label and panel grouping.

## Bento Grid Rules

- Base grid model: 12 columns
- Vertical unit: 30px
- Panels can vary by width span
- Section headers belong to the grid section, not to individual panels
- Panel headers belong inside the card
- Dashboard rows should use a consistent panel height when visual rhythm is more important than varied prominence

For the current trading dashboard, all rows should use equal panel height for a disciplined rhythm.

## Typography

- Primary UI font: `IBM Plex Sans`
- Technical/meta font: `IBM Plex Mono`
- Page title may use a stronger display treatment, but operational labels and meta text should remain compact

Usage rules:

- Page title: sans, strong weight
- Breadcrumbs and route metadata: mono
- Panel meta and span labels: mono
- Dense navigation labels: sans

## Component Rules

### Sidebar

- Dark shell surface
- Tight vertical rhythm
- Clear active item state
- Minimal decoration
- Utility-focused footer or workspace block only where needed

### PageHeader

- Left-aligned
- One main title
- One compact route or context line underneath
- No hero treatment

### PanelHeader

- Compact, centered or tightly structured depending on panel type
- Operational metadata kept visible but subdued
- No oversized text

### Card / Panel

- Small corner radius
- Clear border contrast
- Dense internal padding
- Background surface distinct from shell

### Badge

- Must support neutral, success, warning, and danger
- Should feel operational, not marketing-like

### Button

- Tool-like appearance
- Avoid overly rounded or oversized controls

## State Design

The system must define states consistently:

- active
- hover
- success
- warning
- danger
- empty
- disabled

These states should be token-driven and reusable across navigation, panels, badges, and controls.

## Rollout Scope

First-pass implementation should cover:

- global tokens in CSS
- Tailwind token mapping
- shell styling
- sidebar restyling
- card, button, and badge updates
- new `PageHeader` and `PanelHeader`
- dashboard page updated to stacked bento grid sections

This scope is enough to establish the system without forcing a full-page rewrite of every route.

## Testing Strategy

- Verify token-backed components render without raw color regressions.
- Verify sidebar active and hover states remain legible.
- Verify dashboard panels use the expected section/header hierarchy.
- Verify dashboard layout remains readable on desktop widths used by the product.
- Add targeted component or page tests where behavior changes materially.

## Non-Goals

- Full redesign of every route in one pass
- Complex animation system
- Pixel-perfect cloning of Grafana
- Introducing a charting system in this step

## Output of This Design

After implementation, the frontend should have:

- a semantic token system for dark monitoring UI
- a coherent Grafana-like shell
- reusable dashboard section and panel patterns
- a denser, more operational visual language for the trading interface
