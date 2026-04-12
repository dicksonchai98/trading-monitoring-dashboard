# Main Force Card Minimal Semicircle Design

Date: 2026-04-08  
Status: Approved

## 1. Goal

Fix the `主力大戶` card visual breakage by simplifying it to a stable minimal design:
- semicircle chart only
- single fixed active color
- realtime numeric value below chart

No complex thresholds, no extra labels, no color switching.

## 2. Scope

In scope:
- `主力大戶` card rendering only
- mapping `main_force_big_order_strength` to semicircle fill ratio
- safe layout to prevent overflow/clipping

Out of scope:
- threshold markers
- tier labels
- multi-color strength zones
- changes to other dashboard cards

## 3. Component Design

For `主力大戶` card:
1. Top area: semicircle `PieChart` with two slices
   - `active`: value percent
   - `rest`: `100 - value`
2. Bottom area: realtime text (`xx.x%`)

Style constraints:
- use one fixed active color
- use neutral gray for `rest`
- keep chart inside container (`overflow-hidden`)
- responsive width with bounded max width

## 4. Data Mapping

Source field:
- `metric_latest.main_force_big_order_strength`

Mapping:
- input domain: `[0, 1]`
- clamp to `[0, 1]`
- chart percent: `value * 100`
- display: `percent.toFixed(1) + "%"`

Missing values:
- initial: `--`
- later null/undefined: keep last valid value

## 5. Error Handling

- Invalid/non-numeric payload values are ignored.
- Realtime stream remains unchanged; only view rendering is simplified.

## 6. Testing

Required checks:
1. initial state displays `--`
2. incoming value `0.631` displays `63.1%`
3. semicircle active slice updates with value
4. missing follow-up value keeps last valid displayed percent
5. card layout does not use complex overlays that can overflow

## 7. Acceptance Criteria

- `主力大戶` card shows only semicircle + numeric percent
- active semicircle length follows realtime value
- single fixed color only
- no threshold/tier/extra decorative elements
- no overflow or obvious layout breakage in card container
