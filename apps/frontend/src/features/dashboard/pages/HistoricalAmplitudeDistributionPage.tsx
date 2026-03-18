import type { JSX } from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";

type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type DateSelectMode = "all" | "custom";

interface DailyAmplitudeDatum {
  date: string;
  month: number;
  weekday: WeekdayKey;
  amplitudePoints: number;
}

interface HistogramBin {
  start: number;
  end: number;
  count: number;
  label: string;
}

const weekdayOptions: Array<{ key: WeekdayKey; label: string }> = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
];

const monthOptions = [
  { value: "all", label: "All Months" },
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const BIN_SIZE = 40;
const BIN_MIN = -520;
const BIN_MAX = 520;

function weekdayFromDate(date: Date): WeekdayKey | null {
  const day = date.getDay();
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function generateMockHistory(): DailyAmplitudeDatum[] {
  const rows: DailyAmplitudeDatum[] = [];
  let tradingIndex = 0;

  for (let month = 0; month < 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const current = new Date(2025, month, day);
      if (current.getMonth() !== month) {
        break;
      }

      const weekday = weekdayFromDate(current);
      if (!weekday) {
        continue;
      }

      const waveA = Math.sin((tradingIndex + 4) * 0.35) * 150;
      const waveB = Math.cos((tradingIndex + 2) * 0.15) * 120;
      const drift = ((tradingIndex % 11) - 5) * 22;
      const shock =
        tradingIndex % 17 === 0
          ? 180
          : tradingIndex % 19 === 0
            ? -200
            : 0;

      const signedAmplitude = clamp(
        Math.round(waveA + waveB + drift + shock),
        BIN_MIN + 6,
        BIN_MAX - 6,
      );

      rows.push({
        date: current.toISOString().slice(0, 10),
        month: month + 1,
        weekday,
        amplitudePoints: signedAmplitude,
      });

      tradingIndex += 1;
    }
  }

  return rows;
}

const historicalData = generateMockHistory();

function buildHistogram(rows: DailyAmplitudeDatum[]): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let start = BIN_MIN; start < BIN_MAX; start += BIN_SIZE) {
    const end = start + BIN_SIZE;
    bins.push({
      start,
      end,
      count: 0,
      label: `${start}~${end}`,
    });
  }

  rows.forEach((row) => {
    const rawIndex = Math.floor((row.amplitudePoints - BIN_MIN) / BIN_SIZE);
    const index = clamp(rawIndex, 0, bins.length - 1);
    const targetBin = bins[index];
    if (targetBin) {
      targetBin.count += 1;
    }
  });

  return bins;
}

export function HistoricalAmplitudeDistributionPage(): JSX.Element {
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayKey | "all">("all");
  const [dateSelectMode, setDateSelectMode] = useState<DateSelectMode>("all");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const candidateRows = useMemo(() => {
    return historicalData.filter((row) => {
      const monthPass = monthFilter === "all" || row.month === Number(monthFilter);
      const weekdayPass = weekdayFilter === "all" || row.weekday === weekdayFilter;
      return monthPass && weekdayPass;
    });
  }, [monthFilter, weekdayFilter]);

  const visibleRows = useMemo(() => {
    if (dateSelectMode === "all") {
      return candidateRows;
    }

    const picked = new Set(selectedDates);
    return candidateRows.filter((row) => picked.has(row.date));
  }, [candidateRows, dateSelectMode, selectedDates]);

  const histogramData = useMemo(() => buildHistogram(visibleRows), [visibleRows]);

  const availableDates = useMemo(
    () => candidateRows.map((row) => row.date),
    [candidateRows],
  );

  const upDays = visibleRows.filter((row) => row.amplitudePoints > 0).length;
  const downDays = visibleRows.filter((row) => row.amplitudePoints < 0).length;

  return (
    <PageLayout
      title="歷史振幅分佈圖"
      actions={<Badge variant="info">Histogram</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title="HISTORICAL AMPLITUDE DISTRIBUTION">
        <PanelCard
          title="Filter Controls"
          span={3}
          note="Default: all months and all trading days. You can filter by month, weekday, and custom dates."
        >
          <div className="mt-[var(--panel-gap)] space-y-4 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Month
              </span>
              <select
                className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
                onChange={(event) => setMonthFilter(event.target.value)}
                value={monthFilter}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Weekday
              </span>
              <select
                className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
                onChange={(event) =>
                  setWeekdayFilter(event.target.value as WeekdayKey | "all")
                }
                value={weekdayFilter}
              >
                <option value="all">All Weekdays</option>
                {weekdayOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Date Selection
              </legend>
              <label className="flex items-center gap-2">
                <input
                  checked={dateSelectMode === "all"}
                  name="date-selection-mode"
                  onChange={() => setDateSelectMode("all")}
                  type="radio"
                />
                All Trading Dates
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={dateSelectMode === "custom"}
                  name="date-selection-mode"
                  onChange={() => setDateSelectMode("custom")}
                  type="radio"
                />
                Custom Dates
              </label>
            </fieldset>

            {dateSelectMode === "custom" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setSelectedDates(availableDates)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    全選日期
                  </Button>
                  <Button
                    onClick={() => setSelectedDates([])}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    清空
                  </Button>
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-sm border border-border p-2">
                  {availableDates.map((date) => (
                    <label className="flex items-center gap-2 text-xs" key={date}>
                      <input
                        checked={selectedDates.includes(date)}
                        onChange={() => {
                          setSelectedDates((current) =>
                            current.includes(date)
                              ? current.filter((value) => value !== date)
                              : [...current, date],
                          );
                        }}
                        type="checkbox"
                      />
                      {date}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </PanelCard>

        <PanelCard
          title="Distribution Histogram"
          span={9}
          note="Center(0): neutral. Left side: down days. Right side: up days."
          meta={`${visibleRows.length} trading days`}
          units={2}
        >
          <div className="mt-[var(--panel-gap)] space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="danger">Up Days: {upDays}</Badge>
              <Badge variant="success">Down Days: {downDays}</Badge>
              <Badge variant="neutral">Net: {upDays - downDays}</Badge>
            </div>
            <div className="h-[300px] w-full" data-testid="amplitude-histogram-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  barCategoryGap="0%"
                  data={histogramData}
                  margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                >
                  <CartesianGrid stroke="hsl(var(--border-strong))" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    interval={1}
                    tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                    tickLine={false}
                    width={44}
                  />
                  <ReferenceLine stroke="#94a3b8" strokeDasharray="2 2" x="0~40" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "4px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`${value} days`, "Count"]}
                    labelFormatter={(label) => `Amplitude bucket: ${label} pts`}
                  />
                  <Bar dataKey="count">
                    {histogramData.map((bin) => {
                      const color =
                        bin.end <= 0
                          ? "#22c55e"
                          : bin.start >= 0
                            ? "#ef4444"
                            : "#94a3b8";
                      return <Cell fill={color} key={bin.label} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PanelCard>
      </BentoGridSection>
    </PageLayout>
  );
}
