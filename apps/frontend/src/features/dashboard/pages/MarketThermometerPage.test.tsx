import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MarketThermometerPage } from "@/features/dashboard/pages/MarketThermometerPage";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("MarketThermometerPage", () => {
  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
  });

  it("renders only spot items with numeric last_price", () => {
    useRealtimeStore.setState({
      spotLatestList: {
        ts: Date.parse("2026-04-10T10:10:00+08:00"),
        market_strength_score: 0.5,
        market_strength_pct: 25,
        market_strength_count: 2,
        sector_strength: {
          weighted: 71.25,
          financial: 44.5,
          tech: 88.8,
        },
        items: [
          {
            symbol: "2330",
            open: 940,
            session_low: 900,
            session_high: 960,
            last_price: 950.5,
            price_chg: 5.2,
            pct_chg: 0.55,
            is_new_high: true,
            is_new_low: false,
            strength_state: "new_high",
            strength_score: 2,
            strength_pct: 96.3,
          },
          {
            symbol: "2317",
            open: 151.2,
            session_low: 148,
            session_high: 152,
            last_price: 150.1,
            price_chg: -1.2,
            pct_chg: -0.79,
            is_new_high: false,
            is_new_low: true,
            strength_state: "new_low",
            strength_score: -2,
            strength_pct: 8.2,
          },
          {
            symbol: "2881",
            open: 65,
            session_low: 63,
            session_high: 66,
            last_price: 64.2,
            price_chg: -0.8,
            pct_chg: -1.23,
            is_new_high: false,
            is_new_low: false,
            strength_state: "strong_down",
            strength_score: -1,
            strength_pct: 22.6,
          },
          {
            symbol: "6505",
            open: 120,
            session_low: 118,
            session_high: 122,
            last_price: 121.4,
            price_chg: 1.4,
            pct_chg: 1.17,
            is_new_high: false,
            is_new_low: false,
            strength_state: "strong_up",
            strength_score: 1,
            strength_pct: 66.4,
          },
          {
            symbol: "2308",
            open: 850,
            session_low: 840,
            session_high: 860,
            last_price: 858,
            price_chg: 8,
            pct_chg: 0.94,
            is_new_high: false,
            is_new_low: false,
            strength_state: "new_high",
            strength_score: 2,
            strength_pct: 92.2,
          },
          {
            symbol: "2454",
            last_price: null,
            price_chg: null,
            pct_chg: null,
            is_new_high: false,
            is_new_low: false,
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/market-thermometer"]}>
        <MarketThermometerPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("MARKET THERMOMETER")).toBeInTheDocument();
    expect(screen.getAllByTestId("market-heat-stock-panel")).toHaveLength(5);
    expect(screen.getByText("2330")).toBeInTheDocument();
    expect(screen.getByText("2317")).toBeInTheDocument();
    expect(screen.queryByText("2454")).not.toBeInTheDocument();
    expect(screen.getByText("+5.20")).toBeInTheDocument();
    expect(screen.getByText("+0.55%")).toBeInTheDocument();
    expect(screen.getByText("-1.20")).toBeInTheDocument();
    expect(screen.getByText("-0.79%")).toBeInTheDocument();
    expect(screen.getByTestId("market-thermometer-weighted-strength-value")).toHaveTextContent("71.3%");
    expect(screen.getByTestId("market-thermometer-financial-strength-value")).toHaveTextContent("44.5%");
    expect(screen.getByTestId("market-thermometer-tech-strength-value")).toHaveTextContent("88.8%");
    expect(screen.getByTestId("market-thermometer-strength-score")).toHaveTextContent("+25.00%");
    expect(screen.getByTestId("market-thermometer-strength-count")).toHaveTextContent("2 symbols");
  });

  it("renders waiting state when no valid last_price rows exist", () => {
    useRealtimeStore.setState({
      spotLatestList: {
        ts: Date.parse("2026-04-10T10:10:00+08:00"),
        items: [
          { symbol: "2330", last_price: null },
          { symbol: "2317", last_price: null },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/market-thermometer"]}>
        <MarketThermometerPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("market-heat-empty")).toBeInTheDocument();
    expect(screen.getByText("Waiting for spot latest data...")).toBeInTheDocument();
  });
});
