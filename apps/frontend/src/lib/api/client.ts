import type { ApiErrorPayload, ApiRequestOptions } from "@/lib/api/types";
import { shouldBlockInsecureTransport } from "@/lib/api/transport";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function parseError(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.detail;
  if (typeof detail === "string") {
    return new ApiError(detail, response.status);
  }

  if (detail && typeof detail === "object" && typeof detail.reason === "string") {
    return new ApiError(detail.reason, response.status);
  }

  return new ApiError("api_request_failed", response.status);
}

async function request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  if (
    typeof window !== "undefined" &&
    shouldBlockInsecureTransport(API_BASE_URL, window.location.protocol, import.meta.env.PROD)
  ) {
    throw new ApiError("insecure_transport", 0, "API base URL must use HTTPS (except localhost for local development).");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function getJson<TResponse>(
  path: string,
  options?: ApiRequestOptions,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "GET",
    signal: options?.signal,
    headers: {
      ...options?.headers,
    },
    signal: options?.signal,
  });
}

export async function postJson<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  options?: ApiRequestOptions,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
}
