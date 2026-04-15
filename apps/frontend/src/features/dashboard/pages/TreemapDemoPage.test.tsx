import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider, LANGUAGE_STORAGE_KEY } from "@/lib/i18n";
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
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    useRealtimeStore.getState().resetRealtime();
  });

  afterEach(() => {
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it("shows ranking rows with code and localized stock name", () => {
    useRealtimeStore.setState({
      indexContribRanking: {
        top: [{ rank_no: 1, symbol: "2330", contribution_points: 12.34 }],
        bottom: [{ rank_no: 2, symbol: "2412", contribution_points: -5.67 }],
      },
    });

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
