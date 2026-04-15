import type { JSX } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FilterLayer, type FilterField } from "@/components/filter-layer";
import { ApiStatusAlert } from "@/components/ui/api-status-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  triggerCrawlerJob,
  type CrawlerJobResponse,
} from "@/features/dashboard/api/crawler-jobs";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

type DateMode = "single" | "range";
type LoadStatus = "idle" | "loading" | "success" | "error";

interface CrawlerPanelProps {
  token: string | null;
  onJobsCreated: (jobs: UnifiedLoaderJobRecord[]) => void;
}

function mapApiError(error: unknown, t: ReturnType<typeof useT>): string {
  if (!(error instanceof ApiError)) {
    return t("dashboard.loader.error.retry");
  }
  if (error.status === 401) {
    return t("dashboard.loader.error.sessionExpired");
  }
  if (error.status === 403) {
    return t("dashboard.loader.error.crawlerAdminRequired");
  }
  if (error.code === "invalid_date_range") {
    return t("dashboard.loader.error.invalidDateRange");
  }
  return t("dashboard.loader.error.withCode", { code: error.code });
}

function toUnifiedRecord(
  response: CrawlerJobResponse,
  datasetCode: string,
  window: string,
): UnifiedLoaderJobRecord {
  return {
    source: "crawler",
    jobId: response.job_id,
    workerType: response.worker_type,
    jobType: response.job_type,
    status: response.status,
    target: datasetCode,
    window,
    createdAt: new Date().toISOString(),
  };
}

export function CrawlerPanel({ token, onJobsCreated }: CrawlerPanelProps): JSX.Element {
  const t = useT();
  const [mode, setMode] = useState<DateMode>("single");
  const [singleDate, setSingleDate] = useState("2026-03-17");
  const [rangeStart, setRangeStart] = useState("2026-03-10");
  const [rangeEnd, setRangeEnd] = useState("2026-03-17");
  const [datasetCode, setDatasetCode] = useState("taifex_institution_open_interest_daily");
  const [triggerType, setTriggerType] = useState("manual");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const triggerMutation = useMutation({
    mutationFn: async (): Promise<UnifiedLoaderJobRecord> => {
      if (!token) {
        throw new ApiError("unauthorized", 401);
      }

      if (mode === "single") {
        const response = await triggerCrawlerJob(token, {
          dataset_code: datasetCode,
          target_date: singleDate,
          trigger_type: triggerType,
        });
        return toUnifiedRecord(response, datasetCode, `${singleDate} ~ ${singleDate}`);
      }

      const response = await triggerCrawlerJob(token, {
        dataset_code: datasetCode,
        start_date: rangeStart,
        end_date: rangeEnd,
        trigger_type: triggerType,
      });
      return toUnifiedRecord(response, datasetCode, `${rangeStart} ~ ${rangeEnd}`);
    },
  });

  function validateInputs(): string | null {
    if (!datasetCode.trim()) {
      return t("dashboard.loader.error.datasetRequired");
    }
    if (!triggerType.trim()) {
      return t("dashboard.loader.error.triggerTypeRequired");
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
      return;
    }
    if (!token) {
      setStatus("error");
      setErrorMessage(t("dashboard.loader.error.loginRequiredCrawler"));
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const unifiedJob = await triggerMutation.mutateAsync();
      onJobsCreated([unifiedJob]);
      setStatus("success");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(mapApiError(error, t));
    }
  }

  const dateDisplay = mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;
  const filterFields: FilterField[] = [
    {
      id: "crawler-date-mode",
      label: t("dashboard.loader.modeLegend"),
      type: "select",
      value: mode,
      triggerTestId: "crawler-date-mode",
      options: [
        { value: "single", label: t("dashboard.loader.mode.single") },
        { value: "range", label: t("dashboard.loader.mode.range") },
      ],
      onValueChange: (value) => setMode(value as DateMode),
    },
    ...(mode === "single"
      ? [
          {
            id: "crawler-single-date",
            label: t("dashboard.loader.crawler.targetDate"),
            type: "date" as const,
            value: singleDate,
            onValueChange: setSingleDate,
          },
        ]
      : [
          {
            id: "crawler-range-start",
            label: t("dashboard.loader.startDate"),
            type: "date" as const,
            value: rangeStart,
            onValueChange: setRangeStart,
          },
          {
            id: "crawler-range-end",
            label: t("dashboard.loader.endDate"),
            type: "date" as const,
            value: rangeEnd,
            onValueChange: setRangeEnd,
          },
        ]),
    {
      id: "crawler-dataset-code",
      label: t("dashboard.loader.crawler.datasetCode"),
      className: "md:col-span-2",
      type: "input",
      value: datasetCode,
      inputTestId: "crawler-dataset-code",
      onValueChange: setDatasetCode,
    },
    {
      id: "crawler-trigger-type",
      label: t("dashboard.loader.crawler.triggerType"),
      type: "input",
      value: triggerType,
      onValueChange: setTriggerType,
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
              data-testid="crawler-load-button"
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => void handleLoad()}
            >
              {status === "loading" || triggerMutation.isPending ? t("dashboard.loader.loading") : t("dashboard.loader.crawler.load")}
            </Button>
            <Button
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
              }}
              variant="outline"
            >
              {t("dashboard.loader.reset")}
            </Button>
          </>
        }
      />

      <div className="space-y-3 text-sm" data-testid="crawler-load-status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{t("dashboard.loader.status.mode")}: {mode === "single" ? t("dashboard.loader.mode.single") : t("dashboard.loader.mode.range")}</Badge>
          <Badge variant="info">{t("dashboard.loader.status.date")}: {dateDisplay}</Badge>
          <Badge variant="info">{t("dashboard.loader.crawler.datasetLabel")}: {datasetCode}</Badge>
          <Badge variant="info">{t("dashboard.loader.crawler.triggerLabel")}: {triggerType}</Badge>
        </div>

        {status === "error" ? <ApiStatusAlert message={errorMessage} /> : null}

        {status === "success" ? (
          <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
            {t("dashboard.loader.crawler.success")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
