import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { buildSectorHeatmapViewModel } from "@/features/dashboard/lib/sector-heatmap";
import { SectorHeatmapPage } from "@/features/dashboard/pages/SectorHeatmapPage";

vi.mock("@/features/dashboard/components/SectorHeatmapTreemap", () => ({
  SectorHeatmapTreemap: ({
    sector,
  }: {
    sector: { sector: string; tiles: Array<{ symbol: string }> };
  }) => (
    <div data-testid={`mock-treemap-${sector.sector}`}>
      {sector.tiles.map((tile) => (
        <span key={tile.symbol}>{tile.symbol}</span>
      ))}
    </div>
  ),
}));

describe("SectorHeatmapPage", () => {
  it("renders four sector heatmap cards with representative symbols", () => {
    render(
      <MemoryRouter initialEntries={["/coming-soon/sector-heatmap"]}>
        <SectorHeatmapPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("SECTOR HEATMAP")).toBeInTheDocument();
    expect(
      screen.getByTestId("sector-heatmap-card-semiconductor"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sector-heatmap-card-finance")).toBeInTheDocument();
    expect(
      screen.getByTestId("sector-heatmap-card-traditional"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sector-heatmap-card-other")).toBeInTheDocument();
    expect(screen.getByText("2330")).toBeInTheDocument();
    expect(screen.getByText("2881")).toBeInTheDocument();
    expect(screen.getByText("2603")).toBeInTheDocument();
    expect(screen.getByText("3231")).toBeInTheDocument();
  });

  it("renders empty fallback when a sector has no symbols", () => {
    const viewModel = buildSectorHeatmapViewModel([
      {
        symbol: "2330",
        sector: "semiconductor",
        weightPct: 34.5,
        contributionPoints: 6.12,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/coming-soon/sector-heatmap"]}>
        <SectorHeatmapPage initialData={viewModel} />
      </MemoryRouter>,
    );

    const emptyFinance = screen.getByTestId("sector-heatmap-empty-finance");

    expect(emptyFinance).toBeInTheDocument();
    expect(
      within(emptyFinance).getByText("No symbols in this sector yet."),
    ).toBeInTheDocument();
  });
});
