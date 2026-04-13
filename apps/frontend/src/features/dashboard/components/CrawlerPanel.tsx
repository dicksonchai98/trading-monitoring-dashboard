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

type DateMode = "single" | "range";
type LoadStatus = "idle" | "loading" | "success" | "error";

interface CrawlerPanelProps {
  token: string | null;
  onJobsCreated: (jobs: UnifiedLoaderJobRecord[]) => void;
}

function mapApiError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Load failed. Please retry.";
  }
  if (error.status === 401) {
    return "Session expired. Please login again.";
  }
  if (error.status === 403) {
    return "Admin role is required to trigger crawler jobs.";
  }
  if (error.code === "invalid_date_range") {
    return "Date range is invalid. Please check start and end date.";
  }
  return `Load failed: ${error.code}`;
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
      return "Please provide a dataset code.";
    }
    if (!triggerType.trim()) {
      return "Please provide a trigger type.";
    }
    if (mode === "single" && !singleDate) {
      return "Please pick a date for single-day run.";
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
      return;
    }
    if (!token) {
      setStatus("error");
      setErrorMessage("Please login before triggering crawler jobs.");
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
      setErrorMessage(mapApiError(error));
    }
  }

  const dateDisplay = mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;
  const filterFields: FilterField[] = [
    {
      id: "crawler-date-mode",
      label: "Date Mode",
      type: "select",
      value: mode,
      triggerTestId: "crawler-date-mode",
      options: [
        { value: "single", label: "Single Date" },
        { value: "range", label: "Date Range" },
      ],
      onValueChange: (value) => setMode(value as DateMode),
    },
    ...(mode === "single"
      ? [
          {
            id: "crawler-single-date",
            label: "Target Date",
            type: "date" as const,
            value: singleDate,
            onValueChange: setSingleDate,
          },
        ]
      : [
          {
            id: "crawler-range-start",
            label: "From",
            type: "date" as const,
            value: rangeStart,
            onValueChange: setRangeStart,
          },
          {
            id: "crawler-range-end",
            label: "To",
            type: "date" as const,
            value: rangeEnd,
            onValueChange: setRangeEnd,
          },
        ]),
    {
      id: "crawler-dataset-code",
      label: "Dataset Code",
      className: "md:col-span-2",
      type: "input",
      value: datasetCode,
      inputTestId: "crawler-dataset-code",
      onValueChange: setDatasetCode,
    },
    {
      id: "crawler-trigger-type",
      label: "Trigger Type",
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
              {status === "loading" || triggerMutation.isPending ? "Loading..." : "Load Crawler"}
            </Button>
            <Button
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
              }}
              variant="outline"
            >
              Reset
            </Button>
          </>
        }
      />

      <div className="space-y-3 text-sm" data-testid="crawler-load-status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Mode: {mode === "single" ? "Single Date" : "Date Range"}</Badge>
          <Badge variant="info">Date: {dateDisplay}</Badge>
          <Badge variant="info">Dataset: {datasetCode}</Badge>
          <Badge variant="info">Trigger: {triggerType}</Badge>
        </div>

        {status === "error" ? <ApiStatusAlert message={errorMessage} /> : null}

        {status === "success" ? (
          <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
            Triggered crawler job successfully.
          </div>
        ) : null}
      </div>
    </div>
  );
}
