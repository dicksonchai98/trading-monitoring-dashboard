# Dashboard Half Gauge Alignment Design

## Goal

Fix the five dashboard pie-with-needle metric cards so the chart renders as a half-circle gauge and the needle uses the same center and angle system as the pie.

## Scope

- Keep the existing five metric cards and their values.
- Keep Recharts as the rendering library.
- Change only the gauge geometry and needle placement logic.

## Design

The gauge should render as a top half-circle using `Pie` with `startAngle={180}` and `endAngle={0}`. The needle must derive its center point and angle from the same shared geometry values used by the pie so the indicator cannot drift away from the chart center.

Implementation will centralize `cx`, `cy`, `innerRadius`, and `outerRadius` into one gauge geometry object. The needle angle will map the 0-100 range across the same 180-degree arc as the half gauge. Tests remain structural and count-based to avoid brittle pixel assertions in JSDOM.
