import type { JSX } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/ui/panel-card";
import {
  triggerCrawlerJob,
  type CrawlerJobResponse,
} from "@/features/dashboard/api/crawler-jobs";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { ApiError } from "@/lib/api/client";

type DateMode = "single" | "range";
type LoadStatus = "idle" | "loading" | "success" | "error";

interface CreatedCrawlerJob {
  datasetCode: string;
  endDate: string;
  jobId: number;
  startDate: string;
  status: string;
}

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
  const [createdJobs, setCreatedJobs] = useState<CreatedCrawlerJob[]>([]);

  const triggerMutation = useMutation({
    mutationFn: async (): Promise<{
      localRow: CreatedCrawlerJob;
      unifiedRow: UnifiedLoaderJobRecord;
    }> => {
      if (!token) {
        throw new ApiError("unauthorized", 401);
      }

      if (mode === "single") {
        const response = await triggerCrawlerJob(token, {
          dataset_code: datasetCode,
          target_date: singleDate,
          trigger_type: triggerType,
        });
        const localRow: CreatedCrawlerJob = {
          datasetCode,
          endDate: singleDate,
          jobId: response.job_id,
          startDate: singleDate,
          status: response.status,
        };
        return {
          localRow,
          unifiedRow: toUnifiedRecord(response, datasetCode, `${singleDate} ~ ${singleDate}`),
        };
      }

      const response = await triggerCrawlerJob(token, {
        dataset_code: datasetCode,
        start_date: rangeStart,
        end_date: rangeEnd,
        trigger_type: triggerType,
      });
      const localRow: CreatedCrawlerJob = {
        datasetCode,
        endDate: rangeEnd,
        jobId: response.job_id,
        startDate: rangeStart,
        status: response.status,
      };
      return {
        localRow,
        unifiedRow: toUnifiedRecord(response, datasetCode, `${rangeStart} ~ ${rangeEnd}`),
      };
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
      setCreatedJobs([]);
      return;
    }
    if (!token) {
      setStatus("error");
      setErrorMessage("Please login before triggering crawler jobs.");
      setCreatedJobs([]);
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const result = await triggerMutation.mutateAsync();
      setCreatedJobs((current) => [result.localRow, ...current]);
      onJobsCreated([result.unifiedRow]);
      setStatus("success");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(mapApiError(error));
    }
  }

  const dateDisplay = mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;

  return (
    <PanelCard title="Crawler Jobs" span={12} note="Trigger crawler jobs using dataset code and date window.">
      <div className="mt-[var(--panel-gap)] space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Date Mode
            </span>
            <select
              className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
              data-testid="crawler-date-mode"
              onChange={(event) => setMode(event.target.value as DateMode)}
              value={mode}
            >
              <option value="single">Single Date</option>
              <option value="range">Date Range</option>
            </select>
          </label>

          {mode === "single" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Target Date
              </span>
              <input
                className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
                onChange={(event) => setSingleDate(event.target.value)}
                type="date"
                value={singleDate}
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  From
                </span>
                <input
                  className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
                  onChange={(event) => setRangeStart(event.target.value)}
                  type="date"
                  value={rangeStart}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  To
                </span>
                <input
                  className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
                  onChange={(event) => setRangeEnd(event.target.value)}
                  type="date"
                  value={rangeEnd}
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Dataset Code
            </span>
            <input
              className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
              data-testid="crawler-dataset-code"
              onChange={(event) => setDatasetCode(event.target.value)}
              value={datasetCode}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Trigger Type
            </span>
            <input
              className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
              onChange={(event) => setTriggerType(event.target.value)}
              value={triggerType}
            />
          </label>

          <div className="md:col-span-6 flex items-center justify-end gap-2">
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
                setCreatedJobs([]);
              }}
              variant="outline"
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-3 text-sm" data-testid="crawler-load-status">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">Mode: {mode === "single" ? "Single Date" : "Date Range"}</Badge>
            <Badge variant="info">Date: {dateDisplay}</Badge>
            <Badge variant="info">Dataset: {datasetCode}</Badge>
            <Badge variant="info">Trigger: {triggerType}</Badge>
          </div>

          {status === "error" ? (
            <div className="rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[#ef4444]">
              {errorMessage}
            </div>
          ) : null}

          {status === "success" ? (
            <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
              Triggered crawler job successfully.
            </div>
          ) : null}

          {createdJobs.length > 0 ? (
            <div className="overflow-x-auto rounded-sm border border-border" data-testid="crawler-result-table">
              <table className="w-full text-left text-xs">
                <thead className="bg-shell text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Dataset</th>
                    <th className="px-3 py-2 font-medium">Job ID</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">To</th>
                  </tr>
                </thead>
                <tbody>
                  {createdJobs.map((job) => (
                    <tr className="border-t border-border" key={`${job.datasetCode}-${job.jobId}`}>
                      <td className="px-3 py-2 text-foreground">{job.datasetCode}</td>
                      <td className="px-3 py-2 text-foreground">{job.jobId}</td>
                      <td className="px-3 py-2 text-foreground">{job.status}</td>
                      <td className="px-3 py-2 text-foreground">{job.startDate}</td>
                      <td className="px-3 py-2 text-foreground">{job.endDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </PanelCard>
  );
}
