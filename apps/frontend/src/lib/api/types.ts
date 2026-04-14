export interface ApiErrorPayload {
  detail?: string | { reason?: string; retry_after_seconds?: number };
}

export interface ApiRequestOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
}
