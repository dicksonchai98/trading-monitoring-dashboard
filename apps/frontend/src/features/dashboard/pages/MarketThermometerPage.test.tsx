import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MarketThermometerPage } from "@/features/dashboard/pages/MarketThermometerPage";

describe("MarketThermometerPage", () => {
  it("renders market thermometer heading and 50 stock panels", () => {
    render(
      <MemoryRouter initialEntries={["/market-thermometer"]}>
        <MarketThermometerPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "大盤溫度計" })).toBeInTheDocument();
    expect(screen.getByText("/market-thermometer")).toBeInTheDocument();
    expect(screen.getByText("MARKET THERMOMETER")).toBeInTheDocument();
    expect(screen.getByTestId("market-heat-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("market-heat-stock-panel")).toHaveLength(50);
  });
});
