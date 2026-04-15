import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { TreemapDemoPage } from "@/features/dashboard/pages/TreemapDemoPage";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

function renderPage(): void {
  render(
    <I18nProvider>
      <TreemapDemoPage />
    </I18nProvider>,
  );
}

describe("TreemapDemoPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("ui.language.preset", "en");
    useRealtimeStore.getState().resetRealtime();
  });

  it("shows ranking rows with code and localized stock name", () => {
    renderPage();

    expect(screen.getByText("2330 TSMC")).toBeInTheDocument();
    expect(screen.getByText("2412 Chunghwa Telecom")).toBeInTheDocument();
  });

  it("falls back to symbol-only labels when a stock name is unavailable", () => {
    useRealtimeStore.setState({
      indexContribRanking: {
        top: [{ rank_no: 1, symbol: "9999", contribution_points: 1.23 }],
        bottom: [],
      },
    });

    renderPage();

    expect(screen.getByText("9999")).toBeInTheDocument();
  });
});
