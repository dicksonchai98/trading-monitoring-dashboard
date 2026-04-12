import type { JSX } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MultiSelect } from "@/components/multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/ui/panel-card";
import {
  triggerHistoricalBackfillJob,
  type HistoricalBackfillTriggerResponse,
  type HistoricalOverwriteMode,
} from "@/features/dashboard/api/historical-backfill";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { ApiError } from "@/lib/api/client";

type DateMode = "single" | "range";
type LoadStatus = "idle" | "loading" | "success" | "error";

interface CreatedBackfillJob {
  code: string;
  endDate: string;
  jobId: number;
  startDate: string;
  status: string;
}

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

function toCreatedJob(
  response: HistoricalBackfillTriggerResponse,
  code: string,
  startDate: string,
  endDate: string,
): CreatedBackfillJob {
  return {
    code,
    endDate,
    jobId: response.job_id,
    startDate,
    status: response.status,
  };
}

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

function mapApiError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Load failed. Please retry.";
  }
  if (error.status === 401) {
    return "Session expired. Please login again.";
  }
  if (error.status === 403) {
    return "Admin role is required to trigger historical backfill jobs.";
  }
  if (error.code === "invalid_date_range") {
    return "Date range is invalid. Please check start and end date.";
  }
  if (error.code === "invalid_overwrite_mode") {
    return "Overwrite mode is invalid.";
  }
  return `Load failed: ${error.code}`;
}

export function BackfillPanel({ token, onJobsCreated }: BackfillPanelProps): JSX.Element {
  const [mode, setMode] = useState<DateMode>("single");
  const [singleDate, setSingleDate] = useState("2026-03-17");
  const [rangeStart, setRangeStart] = useState("2026-03-10");
  const [rangeEnd, setRangeEnd] = useState("2026-03-17");
  const [selectedCodes, setSelectedCodes] = useState<string[]>(["TXFR1"]);
  const [overwriteMode, setOverwriteMode] = useState<HistoricalOverwriteMode>("closed_only");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [createdJobs, setCreatedJobs] = useState<CreatedBackfillJob[]>([]);

  const triggerMutation = useMutation({
    mutationFn: async ({
      codes,
      startDate,
      endDate,
      overwriteMode: modeValue,
      token: authToken,
    }: TriggerBatchInput): Promise<{
      localRows: CreatedBackfillJob[];
      unifiedRows: UnifiedLoaderJobRecord[];
    }> => {
      const localRows: CreatedBackfillJob[] = [];
      const unifiedRows: UnifiedLoaderJobRecord[] = [];

      for (const [index, code] of codes.entries()) {
        const response = await triggerHistoricalBackfillJob(authToken, {
          code,
          end_date: endDate,
          overwrite_mode: modeValue,
          start_date: startDate,
        });
        localRows.push(toCreatedJob(response, code, startDate, endDate));
        unifiedRows.push(toUnifiedJob(response, code, startDate, endDate));
        setProgress(Math.round(((index + 1) / codes.length) * 100));
      }

      return { localRows, unifiedRows };
    },
  });

  function validateInputs(): string | null {
    if (selectedCodes.length === 0) {
      return "Please select at least one code.";
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
      setCreatedJobs([]);
      setProgress(0);
      return;
    }
    if (!token) {
      setStatus("error");
      setErrorMessage("Please login before triggering backfill jobs.");
      setCreatedJobs([]);
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
      setCreatedJobs(result.localRows);
      onJobsCreated(result.unifiedRows);
      setStatus("success");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(mapApiError(error));
      setCreatedJobs([]);
      setProgress(0);
    }
  }

  const dateDisplay = mode === "single" ? singleDate : `${rangeStart} ~ ${rangeEnd}`;

  return (
    <PanelCard title="Backfill Jobs" span={12} note="Trigger historical backfill jobs.">
      <div className="mt-[var(--panel-gap)] space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Date Mode
            </span>
            <select
              className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
              data-testid="backfill-date-mode"
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
              Load Items
            </span>
            <MultiSelect
              className="w-full"
              dataTestId="backfill-items-select"
              maxCount={2}
              onValueChange={setSelectedCodes}
              options={backfillCodeOptions}
              placeholder="Select codes..."
              value={selectedCodes}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Overwrite Mode
            </span>
            <select
              className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
              onChange={(event) => setOverwriteMode(event.target.value as HistoricalOverwriteMode)}
              value={overwriteMode}
            >
              <option value="closed_only">closed_only</option>
              <option value="force">force</option>
            </select>
          </label>

          <div className="md:col-span-6 flex items-center justify-end gap-2">
            <Button
              data-testid="backfill-load-button"
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => void handleLoad()}
            >
              {status === "loading" || triggerMutation.isPending ? "Loading..." : "Load Backfill"}
            </Button>
            <Button
              disabled={status === "loading" || triggerMutation.isPending}
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
                setCreatedJobs([]);
                setProgress(0);
              }}
              variant="outline"
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-3 text-sm" data-testid="backfill-load-status">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">Mode: {mode === "single" ? "Single Date" : "Date Range"}</Badge>
            <Badge variant="info">Date: {dateDisplay}</Badge>
            <Badge variant="info">Codes: {selectedCodes.length}</Badge>
            <Badge variant="info">Overwrite: {overwriteMode}</Badge>
          </div>

          {status === "loading" ? (
            <div className="space-y-2" data-testid="backfill-loading">
              <p className="text-muted-foreground">Triggering historical backfill jobs. Please wait...</p>
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

          {status === "error" ? (
            <div className="rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-[#ef4444]">
              {errorMessage}
            </div>
          ) : null}

          {status === "success" ? (
            <div className="rounded-sm border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-[#14532d]">
              Created {createdJobs.length} backfill job(s) successfully.
            </div>
          ) : null}

          {createdJobs.length > 0 ? (
            <div className="overflow-x-auto rounded-sm border border-border" data-testid="backfill-result-table">
              <table className="w-full text-left text-xs">
                <thead className="bg-shell text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Job ID</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">To</th>
                  </tr>
                </thead>
                <tbody>
                  {createdJobs.map((job) => (
                    <tr className="border-t border-border" key={`${job.code}-${job.jobId}`}>
                      <td className="px-3 py-2 text-foreground">{job.code}</td>
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
