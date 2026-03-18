import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";

describe("RealtimeDashboardPage", () => {
  it("renders dashboard sections and updated live metric panels", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Futures Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
    expect(screen.getByText("LIVE METRICS")).toBeInTheDocument();
    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("PARTICIPANT OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("漲跌家數")).toBeInTheDocument();
    expect(screen.getByText("成交量量比")).toBeInTheDocument();
    expect(screen.getByText("SSE Connected")).toBeInTheDocument();

    expect(screen.getAllByTestId("dashboard-metric-panel")).toHaveLength(5);
    expect(screen.getByTestId("live-metrics-core-column")).toBeInTheDocument();
    expect(
      screen.getByTestId("live-metrics-contribution-column"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("live-metrics-core-card")).toHaveLength(3);
    expect(
      screen.getAllByTestId("live-metrics-contribution-card"),
    ).toHaveLength(3);
    expect(screen.getByTestId("live-metrics-otc-line-panel")).toBeInTheDocument();
    expect(screen.getByTestId("live-metrics-gap-panel")).toBeInTheDocument();
    expect(screen.getByTestId("live-metrics-gap-kline-chart")).toBeInTheDocument();
    expect(screen.getByTestId("breadth-distribution-chart")).toBeInTheDocument();
    expect(screen.getByTestId("estimated-volume-compare-chart")).toBeInTheDocument();

    expect(screen.getByText("振幅")).toBeInTheDocument();
    expect(screen.getByText("預估量")).toBeInTheDocument();
    expect(screen.getByText("價差")).toBeInTheDocument();
    expect(screen.getByText("臺積電貢獻點數")).toBeInTheDocument();
    expect(screen.getByText("權值前20貢獻點數")).toBeInTheDocument();
    expect(screen.getByText("上市漲跌家數")).toBeInTheDocument();
    expect(screen.getByText("OTC 櫃買指數")).toBeInTheDocument();
    expect(screen.getAllByTestId("panel-chart")).toHaveLength(14);
  });
});
