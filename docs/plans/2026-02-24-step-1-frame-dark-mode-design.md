# Step 1 Frame Dark Mode Design (2026-02-24)

## Goal

Switch only the "Step 1 Frame" in `pencil-welcome.pen` to dark mode by changing its theme mode to `Dark`.

## Scope

- Only the frame with `name: "Step 1 Frame"` is updated
- No other frames or shared tokens are modified
- No fill/background overrides are added

## Change Detail

Update the frame theme block from:

```json
"theme": { "Mode": "Light" }
```

to:

```json
"theme": { "Mode": "Dark" }
```

## Risks

- If `$--background` is not dark-aware, the visible change could be subtle.

## Testing

- Open the design file and verify that "Step 1 Frame" renders in dark mode.

## Rollback

- Revert `theme.Mode` back to `"Light"` for "Step 1 Frame".
