import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { Typography } from "@/components/ui/typography";
import { useT } from "@/lib/i18n";

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
  labelKey:
    | "dashboard.loader.item.price"
    | "dashboard.loader.item.volume"
    | "dashboard.loader.item.dealer"
    | "dashboard.loader.item.foreign"
    | "dashboard.loader.item.signals";
}

const itemOptions: ItemOption[] = [
  { key: "price", labelKey: "dashboard.loader.item.price" },
  { key: "volume", labelKey: "dashboard.loader.item.volume" },
  { key: "dealer", labelKey: "dashboard.loader.item.dealer" },
  { key: "foreign", labelKey: "dashboard.loader.item.foreign" },
  { key: "signals", labelKey: "dashboard.loader.item.signals" },
];

function buildMockItems(
  selectedItems: string[],
  resolveLabel: (key: ItemOption["labelKey"]) => string,
): LoadedItem[] {
  return selectedItems.map((key, index) => {
    const option = itemOptions.find((item) => item.key === key);
    const label = option ? resolveLabel(option.labelKey) : key;
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
  const t = useT();
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

  const resolvedItemOptions = useMemo(
    () =>
      itemOptions.map((item) => ({
        key: item.key,
        label: t(item.labelKey),
      })),
    [t],
  );

  function toggleItem(itemKey: string): void {
    setSelectedItems((current) =>
      current.includes(itemKey)
        ? current.filter((entry) => entry !== itemKey)
        : [...current, itemKey],
    );
  }

  function validateInputs(): string | null {
    if (selectedItems.length === 0) {
      return t("dashboard.loader.error.selectItem");
    }

    if (mode === "single" && !singleDate) {
      return t("dashboard.loader.error.singleDate");
    }

    if (mode === "range") {
      if (!rangeStart || !rangeEnd) {
        return t("dashboard.loader.error.rangeDate");
      }
      if (rangeStart > rangeEnd) {
        return t("dashboard.loader.error.rangeOrder");
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
      const rows = buildMockItems(selectedItems, (key) => t(key));
      setLoadedItems(rows);
      setProgress(100);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage(t("dashboard.loader.error.retry"));
    } finally {
      window.clearInterval(timer);
    }
  }

  const dateDisplay =
    mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;
  const totalRecords = loadedItems.reduce((sum, item) => sum + item.records, 0);

  return (
    <PageLayout
      title={t("dashboard.loader.title")}
      actions={<Badge variant="success">{t("dashboard.loader.badge")}</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title={t("dashboard.loader.sectionTitle")}>
        <PanelCard title={t("dashboard.loader.query.title")} span={4} note={t("dashboard.loader.query.note")}>
          <div className="mt-[var(--panel-gap)] space-y-4 text-sm">
            <fieldset className="space-y-2">
              <Typography as="legend" variant="overline" className="text-muted-foreground">
                {t("dashboard.loader.modeLegend")}
              </Typography>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  checked={mode === "single"}
                  data-testid="loader-mode-single"
                  name="date-mode"
                  onChange={() => setMode("single")}
                  type="radio"
                  value="single"
                />
                {t("dashboard.loader.mode.single")}
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
                {t("dashboard.loader.mode.range")}
              </label>
            </fieldset>

            {mode === "single" ? (
              <label className="flex flex-col gap-1">
                <Typography as="span" variant="overline" className="text-muted-foreground">
                  {t("dashboard.loader.tradingDate")}
                </Typography>
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
                  <Typography as="span" variant="overline" className="text-muted-foreground">
                    {t("dashboard.loader.startDate")}
                  </Typography>
                  <input
                    className="h-9 rounded-sm border border-border bg-card px-2 text-sm text-foreground"
                    onChange={(event) => setRangeStart(event.target.value)}
                    type="date"
                    value={rangeStart}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <Typography as="span" variant="overline" className="text-muted-foreground">
                    {t("dashboard.loader.endDate")}
                  </Typography>
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
              <Typography as="legend" variant="overline" className="text-muted-foreground">
                {t("dashboard.loader.itemsLegend")}
              </Typography>
              <div className="grid grid-cols-1 gap-1">
                {resolvedItemOptions.map((item) => (
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
                {status === "loading" ? t("dashboard.loader.loading") : t("dashboard.loader.loadData")}
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
                {t("dashboard.loader.reset")}
              </Button>
            </div>
          </div>
        </PanelCard>

        <PanelCard title={t("dashboard.loader.status.title")} span={8} note={t("dashboard.loader.status.note")}>
          <div className="mt-[var(--panel-gap)] space-y-3 text-sm" data-testid="history-load-status">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{t("dashboard.loader.status.mode")}: {mode === "single" ? t("dashboard.loader.mode.single") : t("dashboard.loader.mode.range")}</Badge>
              <Badge variant="outline">{t("dashboard.loader.status.date")}: {dateDisplay}</Badge>
              <Badge variant="outline">{t("dashboard.loader.status.items")}: {selectedItems.length}</Badge>
            </div>

            {status === "loading" ? (
              <div className="space-y-2" data-testid="history-loading">
                <p className="text-muted-foreground">
                  {t("dashboard.loader.status.loadingHint")}
                </p>
                <div className="h-2 w-full rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary transition-all"
                    data-testid="history-progress"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <Typography as="p" variant="caption" className="text-muted-foreground">
                  {progress}%
                </Typography>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[#ef4444]">
                {errorMessage}
              </div>
            ) : null}

            {status === "success" ? (
              <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
                {t("dashboard.loader.status.loaded", {
                  groups: loadedItems.length,
                  records: totalRecords,
                })}
              </div>
            ) : null}

            {status === "idle" ? (
              <p className="text-muted-foreground">
                {t("dashboard.loader.status.idleHint")}
              </p>
            ) : null}

            {loadedItems.length > 0 ? (
              <div className="overflow-x-auto rounded-sm border border-border" data-testid="history-result-table">
                <table className="w-full text-left text-xs">
                  <thead className="bg-shell text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("dashboard.loader.table.item")}</th>
                      <th className="px-3 py-2 font-medium">{t("dashboard.loader.table.records")}</th>
                      <th className="px-3 py-2 font-medium">{t("dashboard.loader.table.sessionStart")}</th>
                      <th className="px-3 py-2 font-medium">{t("dashboard.loader.table.sessionEnd")}</th>
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
