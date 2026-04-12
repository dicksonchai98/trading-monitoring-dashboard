import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MarketThermometerPage } from "@/features/dashboard/pages/MarketThermometerPage";

describe("MarketThermometerPage", () => {
  it("renders market thermometer section and 50 stock panels", () => {
    render(
      <MemoryRouter initialEntries={["/market-thermometer"]}>
        <MarketThermometerPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("MARKET THERMOMETER")).toBeInTheDocument();
    expect(screen.getByTestId("market-heat-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("market-heat-stock-panel")).toHaveLength(50);
  });
});
