# Treemap page i18n design

## Goal

Add frontend i18n coverage for the Treemap demo page and ensure the sidebar realtime navigation uses the same localized labels consistently.

## Scope

In scope:
- `apps/frontend/src/features/dashboard/pages/TreemapDemoPage.tsx`
- `apps/frontend/src/lib/i18n/messages.ts`
- Sidebar realtime navigation labels used from `apps/frontend/src/components/app-sidebar.tsx`

Out of scope:
- Reworking broader dashboard information architecture
- Renaming existing routes
- Changing realtime page behavior beyond localized labels

## Design

### Treemap page strings

Move all fixed user-facing strings on the Treemap page into `messages.ts` under a dedicated `dashboard.treemap.*` namespace. This includes:
- page title
- section title
- section tooltip
- top contributors title
- bottom contributors title

### Sector labels

Sector labels currently come from hard-coded values embedded in the treemap data. Replace these display strings with stable sector ids and map them to localized labels through i18n keys. The rendered sector header text should come from translation lookup, not from raw English literals in the page data structure.

### Sidebar realtime group

The sidebar already uses i18n for the realtime section and child items through `nav.realtime`, `nav.overview`, and `nav.marketThermometer`. Keep that pattern and only add or adjust message entries if the Treemap page needs to appear under the realtime group or if any displayed label in that group is still hard-coded.

## Data flow

`TreemapDemoPage` should use `useT()` for page-level strings while keeping `useI18n()` for locale-dependent stock-name formatting already used in ranking and treemap tiles. Sector ids from treemap data should be translated at render time through `t(...)`.

## Error handling

If a sector translation key is missing, the page should fall back to the sector id instead of crashing. Existing stock symbol fallback behavior remains unchanged.

## Testing impact

Existing Treemap page tests should be updated only as needed for localized labels. The sidebar should continue using the existing nav translation pattern without introducing a second localization mechanism.
