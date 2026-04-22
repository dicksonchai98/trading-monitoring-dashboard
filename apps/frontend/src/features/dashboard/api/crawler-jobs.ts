import { postJson } from "@/lib/api/client";

export interface CrawlerSingleDateJobRequest {
  dataset_code: string;
  target_date: string;
  trigger_type: string;
}

export interface CrawlerRangeJobRequest {
  dataset_code: string;
  start_date: string;
  end_date: string;
  trigger_type: string;
}

export interface CrawlerJobResponse {
  job_id: number;
  worker_type: string;
  job_type: string;
  status: string;
}

export function triggerCrawlerJob(
  token: string,
  payload: CrawlerSingleDateJobRequest | CrawlerRangeJobRequest,
): Promise<CrawlerJobResponse> {
  return postJson<CrawlerJobResponse, typeof payload>(
    "/admin/batch/crawler/jobs",
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}
