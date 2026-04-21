import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ParticipantSignalsCard } from "@/features/dashboard/components/ParticipantSignalsCard";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: unknown }) => {
      const child = Children.only(children) as ReactElement<{
        width: number;
        height: number;
      }>;
      return isValidElement(child)
        ? cloneElement(child, { width: 400, height: 240 })
        : null;
    },
  };
});

describe("ParticipantSignalsCard", () => {
  it("renders the participant signal chart", () => {
    render(
      <ParticipantSignalsCard
        loading={false}
        error={null}
        series={[
          {
            day: "04/15",
            tradeDate: "2026-04-15",
            open: 10,
            high: 16,
            low: 8,
            close: 12,
            amplitude: 8,
          },
          {
            day: "04/16",
            tradeDate: "2026-04-16",
            open: 12,
            high: 18,
            low: 9,
            close: 15,
            amplitude: 9,
          },
        ]}
      />,
    );

    expect(screen.getByText("Participant Signals")).toBeInTheDocument();
    expect(screen.getByTestId("participant-amplitude-chart")).toBeInTheDocument();
    expect(screen.getByText("Daily amplitude")).toBeInTheDocument();
  });
});
