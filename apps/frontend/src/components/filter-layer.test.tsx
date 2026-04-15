import { render, screen } from "@testing-library/react";
import { FilterLayer } from "@/components/filter-layer";

describe("FilterLayer", () => {
  it("shows a loading spinner and disables select triggers while loading", () => {
    render(
      <FilterLayer
        fields={[
          {
            id: "metric",
            label: "Metric",
            type: "select",
            value: "day_range",
            options: [{ value: "day_range", label: "Day Range" }],
            loading: true,
            onValueChange: vi.fn(),
            triggerTestId: "metric-trigger",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("metric-trigger")).toBeDisabled();
    expect(screen.getByTestId("metric-trigger-loading")).toBeInTheDocument();
  });
});
