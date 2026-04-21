import type { JSX } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FilterLayer, type FilterField } from "@/components/filter-layer";
import { MultiSelect } from "@/components/multi-select";
import { ApiStatusAlert } from "@/components/ui/api-status-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  triggerHistoricalBackfillJob,
  type HistoricalBackfillTriggerResponse,
  type HistoricalOverwriteMode,
} from "@/features/dashboard/api/historical-backfill";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

type DateMode = "single" | "range";
type LoadStatus = "idle" | "loading" | "success" | "error";

interface TriggerBatchInput {
  codes: string[];
  endDate: string;
  overwriteMode: HistoricalOverwriteMode;
  startDate: string;
  token: string;
}

interface BackfillPanelProps {
  token: string | null;
  onJobsCreated: (jobs: UnifiedLoaderJobRecord[]) => void;
}

const backfillCodeOptions = [
  { value: "TXFR1", label: "TXFR1" },
  { value: "TXFD1", label: "TXFD1" },
  { value: "TXF", label: "TXF" },
];

function toUnifiedJob(
  response: HistoricalBackfillTriggerResponse,
  code: string,
  startDate: string,
  endDate: string,
): UnifiedLoaderJobRecord {
  return {
    source: "backfill",
    jobId: response.job_id,
    workerType: response.worker_type,
    jobType: response.job_type,
    status: response.status,
    target: code,
    window: `${startDate} ~ ${endDate}`,
    createdAt: new Date().toISOString(),
  };
}

function mapApiError(error: unknown, t: ReturnType<typeof useT>): string {
  if (!(error instanceof ApiError)) {
    return t("dashboard.loader.error.retry");
  }
  if (error.status === 401) {
    return t("dashboard.loader.error.sessionExpired");
  }
  if (error.status === 403) {
    return t("dashboard.loader.error.backfillAdminRequired");
  }
  if (error.code === "invalid_date_range") {
    return t("dashboard.loader.error.invalidDateRange");
  }
  if (error.code === "invalid_overwrite_mode") {
    return t("dashboard.loader.error.invalidOverwriteMode");
  }
  return t("dashboard.loader.error.withCode", { code: error.code });
}

export function BackfillPanel({
  token,
  onJobsCreated,
}: BackfillPanelProps): JSX.Element {
  const t = useT();
  const [mode, setMode] = useState<DateMode>("single");
  const [singleDate, setSingleDate] = useState("2026-03-17");
  const [rangeStart, setRangeStart] = useState("2026-03-10");
  const [rangeEnd, setRangeEnd] = useState("2026-03-17");
  const [selectedCodes, setSelectedCodes] = useState<string[]>(["TXFR1"]);
  const [overwriteMode, setOverwriteMode] =
    useState<HistoricalOverwriteMode>("closed_only");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);

  const triggerMutation = useMutation({
    mutationFn: async ({
      codes,
      startDate,
      endDate,
      overwriteMode: modeValue,
      token: authToken,
    }: TriggerBatchInput): Promise<{
      unifiedRows: UnifiedLoaderJobRecord[];
    }> => {
      const unifiedRows: UnifiedLoaderJobRecord[] = [];

      for (const [index, code] of codes.entries()) {
        const response = await triggerHistoricalBackfillJob(authToken, {
          code,
          end_date: endDate,
          overwrite_mode: modeValue,
          start_date: startDate,
        });
        unifiedRows.push(toUnifiedJob(response, code, startDate, endDate));
        setProgress(Math.round(((index + 1) / codes.length) * 100));
      }

      return { unifiedRows };
    },
  });

  function validateInputs(): string | null {
    if (selectedCodes.length === 0) {
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
      setCreatedCount(0);
      setProgress(0);
      return;
    }
    if (!token) {
      setStatus("error");
      setErrorMessage(t("dashboard.loader.error.loginRequiredBackfill"));
      setCreatedCount(0);
      setProgress(0);
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setProgress(0);

    const startDate = mode === "single" ? singleDate : rangeStart;
    const endDate = mode === "single" ? singleDate : rangeEnd;

    try {
      const result = await triggerMutation.mutateAsync({
        codes: selectedCodes,
        endDate,
        overwriteMode,
        startDate,
        token,
      });
      setCreatedCount(result.unifiedRows.length);
      onJobsCreated(result.unifiedRows);
      setStatus("success");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(mapApiError(error, t));
      setCreatedCount(0);
      setProgress(0);
    }
  }

  const dateDisplay =
    mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;
  const filterFields: FilterField[] = [
    {
      id: "backfill-date-mode",
      label: t("dashboard.loader.modeLegend"),
      type: "select",
      value: mode,
      triggerTestId: "backfill-date-mode",
      options: [
        { value: "single", label: t("dashboard.loader.mode.single") },
        { value: "range", label: t("dashboard.loader.mode.range") },
      ],
      onValueChange: (value) => setMode(value as DateMode),
    },
    ...(mode === "single"
      ? [
          {
            id: "backfill-single-date",
            label: t("dashboard.loader.tradingDate"),
            type: "date" as const,
            value: singleDate,
            onValueChange: setSingleDate,
          },
        ]
      : [
          {
            id: "backfill-range-start",
            label: t("dashboard.loader.startDate"),
            type: "date" as const,
            value: rangeStart,
            onValueChange: setRangeStart,
          },
          {
            id: "backfill-range-end",
            label: t("dashboard.loader.endDate"),
            type: "date" as const,
            value: rangeEnd,
            onValueChange: setRangeEnd,
          },
        ]),
    {
      type: "custom",
      key: "backfill-load-items",
      className: "flex flex-col gap-1 md:col-span-2",
      render: () => (
        <>
          <span className="typo-overline text-muted-foreground">
            {t("dashboard.loader.itemsLegend")}
          </span>
          <MultiSelect
            className="w-full"
            dataTestId="backfill-items-select"
            maxCount={2}
            onValueChange={setSelectedCodes}
            options={backfillCodeOptions}
            placeholder={t("dashboard.loader.selectCodes")}
            value={selectedCodes}
          />
        </>
      ),
    },
    {
      id: "backfill-overwrite-mode",
      label: t("dashboard.loader.overwriteMode"),
      type: "select",
      value: overwriteMode,
      options: [
        {
          value: "closed_only",
          label: t("dashboard.loader.overwriteMode.closedOnly"),
        },
        { value: "force", label: t("dashboard.loader.overwriteMode.force") },
      ],
      onValueChange: (value) =>
        setOverwriteMode(value as HistoricalOverwriteMode),
    },
  ];

  return (
    <div className="space-y-3">
      <FilterLayer
        fields={filterFields}
        className="md:grid-cols-6"
        actionsClassName="md:col-span-6"
        actions={
          <>
            <Button
              data-testid="backfill-load-button"
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => void handleLoad()}
            >
              {status === "loading" || triggerMutation.isPending
                ? t("dashboard.loader.loading")
                : t("dashboard.loader.backfill.load")}
            </Button>
            <Button
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
                setCreatedCount(0);
                setProgress(0);
              }}
              variant="outline"
            >
              {t("dashboard.loader.reset")}
            </Button>
          </>
        }
      />

      <div className="space-y-3 text-sm" data-testid="backfill-load-status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {t("dashboard.loader.status.mode")}:{" "}
            {mode === "single"
              ? t("dashboard.loader.mode.single")
              : t("dashboard.loader.mode.range")}
          </Badge>
          <Badge variant="info">
            {t("dashboard.loader.status.date")}: {dateDisplay}
          </Badge>
          <Badge variant="info">
            {t("dashboard.loader.status.items")}: {selectedCodes.length}
          </Badge>
          <Badge variant="info">
            {t("dashboard.loader.status.overwrite")}: {overwriteMode}
          </Badge>
        </div>

        {status === "loading" ? (
          <div className="space-y-2" data-testid="backfill-loading">
            <p className="text-muted-foreground">
              {t("dashboard.loader.status.loadingHint")}
            </p>
            <div className="h-2 w-full rounded bg-muted">
              <div
                className="h-2 rounded bg-primary transition-all"
                data-testid="backfill-progress"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        ) : null}

        {status === "error" ? <ApiStatusAlert message={errorMessage} /> : null}

        {status === "success" ? (
          <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
            {t("dashboard.loader.backfill.success", {
              count: String(createdCount),
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
