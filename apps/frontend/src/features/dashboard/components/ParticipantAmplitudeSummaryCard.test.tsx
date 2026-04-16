import { render, screen } from "@testing-library/react";
import { ParticipantAmplitudeSummaryCard } from "@/features/dashboard/components/ParticipantAmplitudeSummaryCard";

describe("ParticipantAmplitudeSummaryCard", () => {
  it("renders the participant amplitude summary", () => {
    render(
      <ParticipantAmplitudeSummaryCard
        summary={{
          avg5: 12.3,
          avg10: 11.4,
          yesterday: 13.1,
          max5: 15.8,
          max10: 16.2,
        }}
      />,
    );

    expect(screen.getByText("Amplitude Summary")).toBeInTheDocument();
    expect(screen.getByText("12.3 點")).toBeInTheDocument();
    expect(screen.getByText("16.2 點")).toBeInTheDocument();
  });
});
