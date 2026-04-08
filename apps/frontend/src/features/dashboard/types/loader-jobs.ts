export type LoaderJobSource = "backfill" | "crawler";

export interface UnifiedLoaderJobRecord {
  source: LoaderJobSource;
  jobId: number;
  workerType: string;
  jobType: string;
  status: string;
  target: string;
  window: string;
  createdAt: string;
}
