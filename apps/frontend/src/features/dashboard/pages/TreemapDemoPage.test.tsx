import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TreemapDemoPage } from "@/features/dashboard/pages/TreemapDemoPage";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { I18nProvider, LANGUAGE_STORAGE_KEY } from "@/lib/i18n";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="mock-responsive-container">{children}</div>
    ),
    Treemap: () => <div data-testid="mock-treemap" />,
  };
});

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

  it("shows ranking rows with code and localized stock name", () => {
    renderPage();

    expect(screen.getByText("2330 TSMC")).toBeInTheDocument();
    expect(screen.getByText("2412 Chunghwa Telecom")).toBeInTheDocument();
  });

  it("falls back to symbol-only labels when a stock name is unavailable", () => {
    useRealtimeStore.setState({
      indexContribRanking: {
        trade_date: "2026-01-01",
        ts: Date.now(),
        index_code: "TXF",
        top: [{ rank_no: 1, symbol: "9999", contribution_points: 1.23 }],
        bottom: [],
      },
    });

    renderPage();

    expect(screen.getByText("9999")).toBeInTheDocument();
  });

  it("uses Chinese stock names when the locale is zh-TW", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh-TW");

    renderPage();

    expect(screen.getByText("2330 台積電")).toBeInTheDocument();
  });
});
