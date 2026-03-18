import type { JSX } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";

type DateMode = "single" | "range";
type LoadStatus = "idle" | "loading" | "success" | "error";

interface LoadedItem {
  key: string;
  label: string;
  records: number;
  startTime: string;
  endTime: string;
}

interface ItemOption {
  key: string;
  label: string;
}

const itemOptions: ItemOption[] = [
  { key: "price", label: "Price Candles" },
  { key: "volume", label: "Volume" },
  { key: "dealer", label: "Dealer Position" },
  { key: "foreign", label: "Foreign Flow" },
  { key: "signals", label: "Historical Signals" },
];

function buildMockItems(selectedItems: string[]): LoadedItem[] {
  return selectedItems.map((key, index) => {
    const option = itemOptions.find((item) => item.key === key);
    const label = option?.label ?? key;
    const records = 280 + index * 140;

    return {
      key,
      label,
      records,
      startTime: "09:00",
      endTime: "13:45",
    };
  });
}

export function HistoricalDataLoaderPage(): JSX.Element {
  const [mode, setMode] = useState<DateMode>("single");
  const [singleDate, setSingleDate] = useState("2026-03-17");
  const [rangeStart, setRangeStart] = useState("2026-03-10");
  const [rangeEnd, setRangeEnd] = useState("2026-03-17");
  const [selectedItems, setSelectedItems] = useState<string[]>([
    "price",
    "dealer",
  ]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [loadedItems, setLoadedItems] = useState<LoadedItem[]>([]);

  function toggleItem(itemKey: string): void {
    setSelectedItems((current) =>
      current.includes(itemKey)
        ? current.filter((entry) => entry !== itemKey)
        : [...current, itemKey],
    );
  }

  function validateInputs(): string | null {
    if (selectedItems.length === 0) {
      return "Please select at least one load item.";
    }

    if (mode === "single" && !singleDate) {
      return "Please pick a date for single-day load.";
    }

    if (mode === "range") {
      if (!rangeStart || !rangeEnd) {
        return "Please provide both start and end date.";
      }
      if (rangeStart > rangeEnd) {
        return "Start date must be earlier than or equal to end date.";
      }
    }

    return null;
  }

  async function handleLoad(): Promise<void> {
    const validationError = validateInputs();
    if (validationError) {
      setStatus("error");
      setErrorMessage(validationError);
      setLoadedItems([]);
      setProgress(0);
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setProgress(8);

    const timer = window.setInterval(() => {
      setProgress((current) => (current >= 92 ? current : current + 7));
    }, 120);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
      const rows = buildMockItems(selectedItems);
      setLoadedItems(rows);
      setProgress(100);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Load failed. Please retry.");
    } finally {
      window.clearInterval(timer);
    }
  }

  const dateDisplay =
    mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;
  const totalRecords = loadedItems.reduce((sum, item) => sum + item.records, 0);

  return (
    <PageLayout
      title="Historical Data Loader"
      actions={<Badge variant="success">Mock Loader</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title="LOAD CONFIGURATION">
        <PanelCard title="Query Controls" span={4} note="Pick date mode and load targets before loading.">
          <div className="mt-[var(--panel-gap)] space-y-4 text-sm">
            <fieldset className="space-y-2">
              <legend className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Date Mode
              </legend>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  checked={mode === "single"}
                  data-testid="loader-mode-single"
                  name="date-mode"
                  onChange={() => setMode("single")}
                  type="radio"
                  value="single"
                />
                Single Date
              </label>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  checked={mode === "range"}
                  data-testid="loader-mode-range"
                  name="date-mode"
                  onChange={() => setMode("range")}
                  type="radio"
                  value="range"
                />
                Date Range
              </label>
            </fieldset>

            {mode === "single" ? (
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Trading Date
                </span>
                <input
                  className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
                  onChange={(event) => setSingleDate(event.target.value)}
                  type="date"
                  value={singleDate}
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    Start Date
                  </span>
                  <input
                    className="h-9 rounded-sm border border-border bg-card px-2 text-sm text-foreground"
                    onChange={(event) => setRangeStart(event.target.value)}
                    type="date"
                    value={rangeStart}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    End Date
                  </span>
                  <input
                    className="h-9 rounded-sm border border-border bg-card px-2 text-sm text-foreground"
                    onChange={(event) => setRangeEnd(event.target.value)}
                    type="date"
                    value={rangeEnd}
                  />
                </label>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Load Items
              </legend>
              <div className="grid grid-cols-1 gap-1">
                {itemOptions.map((item) => (
                  <label className="flex items-center gap-2 text-foreground" key={item.key}>
                    <input
                      checked={selectedItems.includes(item.key)}
                      onChange={() => toggleItem(item.key)}
                      type="checkbox"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center gap-2">
              <Button
                data-testid="history-load-button"
                disabled={status === "loading"}
                onClick={() => void handleLoad()}
              >
                {status === "loading" ? "Loading..." : "Load Data"}
              </Button>
              <Button
                disabled={status === "loading"}
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage("");
                  setLoadedItems([]);
                  setProgress(0);
                }}
                variant="outline"
              >
                Reset
              </Button>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Load Status" span={8} note="Shows current request state and latest output summary.">
          <div className="mt-[var(--panel-gap)] space-y-3 text-sm" data-testid="history-load-status">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Mode: {mode === "single" ? "Single Date" : "Date Range"}</Badge>
              <Badge variant="outline">Date: {dateDisplay}</Badge>
              <Badge variant="outline">Items: {selectedItems.length}</Badge>
            </div>

            {status === "loading" ? (
              <div className="space-y-2" data-testid="history-loading">
                <p className="text-muted-foreground">
                  Loading historical dataset. Please wait...
                </p>
                <div className="h-2 w-full rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary transition-all"
                    data-testid="history-progress"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[#ef4444]">
                {errorMessage}
              </div>
            ) : null}

            {status === "success" ? (
              <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
                Loaded {loadedItems.length} item groups with {totalRecords} records.
              </div>
            ) : null}

            {status === "idle" ? (
              <p className="text-muted-foreground">
                Configure date and items, then click Load Data.
              </p>
            ) : null}

            {loadedItems.length > 0 ? (
              <div className="overflow-x-auto rounded-sm border border-border" data-testid="history-result-table">
                <table className="w-full text-left text-xs">
                  <thead className="bg-shell text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Records</th>
                      <th className="px-3 py-2 font-medium">Session Start</th>
                      <th className="px-3 py-2 font-medium">Session End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadedItems.map((item) => (
                      <tr className="border-t border-border" key={item.key}>
                        <td className="px-3 py-2 text-foreground">{item.label}</td>
                        <td className="px-3 py-2 text-foreground">{item.records}</td>
                        <td className="px-3 py-2 text-foreground">{item.startTime}</td>
                        <td className="px-3 py-2 text-foreground">{item.endTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </PanelCard>
      </BentoGridSection>
    </PageLayout>
  );
}
