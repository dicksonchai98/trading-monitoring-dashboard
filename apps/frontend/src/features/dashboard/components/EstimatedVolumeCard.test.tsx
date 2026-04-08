import { render, screen } from "@testing-library/react";
import { EstimatedVolumeCard } from "@/features/dashboard/components/EstimatedVolumeCard";
import { useEstimatedVolumeTimeline } from "@/features/dashboard/hooks/use-estimated-volume-timeline";

vi.mock("@/features/dashboard/hooks/use-estimated-volume-timeline", () => ({
  useEstimatedVolumeTimeline: vi.fn(),
}));

describe("EstimatedVolumeCard", () => {
  const useEstimatedVolumeTimelineMock = vi.mocked(useEstimatedVolumeTimeline);

  beforeEach(() => {
    useEstimatedVolumeTimelineMock.mockReset();
  });

  it("shows loading state while timeline is loading", () => {
    useEstimatedVolumeTimelineMock.mockReturnValue({
      series: [],
      latest: null,
      loading: true,
      error: null,
    });

    render(<EstimatedVolumeCard />);

    expect(screen.getByText("Loading estimated volume timeline...")).toBeInTheDocument();
    expect(screen.queryByTestId("estimated-volume-compare-chart")).not.toBeInTheDocument();
  });

  it("shows error state when baseline load fails", () => {
    useEstimatedVolumeTimelineMock.mockReturnValue({
      series: [],
      latest: null,
      loading: false,
      error: "boom",
    });

    render(<EstimatedVolumeCard />);

    expect(screen.getByText("Unable to load estimated volume data.")).toBeInTheDocument();
    expect(screen.queryByTestId("estimated-volume-compare-chart")).not.toBeInTheDocument();
  });

  it("renders current comparison and timeline chart", () => {
    useEstimatedVolumeTimelineMock.mockReturnValue({
      series: [
        {
          minuteTs: Date.parse("2026-04-08T09:00:00+08:00"),
          minuteOfDay: 540,
          time: "09:00",
          yesterdayEstimated: 900,
          todayEstimated: 1000,
          positiveDiff: 100,
          negativeDiff: 0,
        },
      ],
      latest: {
        minuteTs: Date.parse("2026-04-08T09:00:00+08:00"),
        minuteOfDay: 540,
        time: "09:00",
        yesterdayEstimated: 900,
        todayEstimated: 1000,
        positiveDiff: 100,
        negativeDiff: 0,
      },
      loading: false,
      error: null,
    });

    render(<EstimatedVolumeCard />);

    expect(screen.getByText("成交量量比")).toBeInTheDocument();
    expect(screen.getByText("目前時間 09:00")).toBeInTheDocument();
    expect(screen.getByText("今日 1.0k")).toBeInTheDocument();
    expect(screen.getByText("昨日 900")).toBeInTheDocument();
    expect(screen.getByTestId("estimated-volume-compare-chart")).toBeInTheDocument();
  });
});
