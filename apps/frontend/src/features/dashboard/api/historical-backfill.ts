import { postJson } from "@/lib/api/client";

export type HistoricalOverwriteMode = "closed_only" | "force";

export interface HistoricalBackfillTriggerRequest {
  code: string;
  start_date: string;
  end_date: string;
  overwrite_mode: HistoricalOverwriteMode;
}

export interface HistoricalBackfillTriggerResponse {
  job_id: number;
  worker_type: string;
  job_type: string;
  status: string;
}

export function triggerHistoricalBackfillJob(
  token: string,
  payload: HistoricalBackfillTriggerRequest,
): Promise<HistoricalBackfillTriggerResponse> {
  return postJson<
    HistoricalBackfillTriggerResponse,
    HistoricalBackfillTriggerRequest
  >("api/admin/batch/backfill/jobs", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
