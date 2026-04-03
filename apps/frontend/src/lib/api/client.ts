import type { ApiErrorPayload, ApiRequestOptions } from "@/lib/api/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const ABSOLUTE_HTTP_PATTERN = /^http:\/\//i;

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
    window.location.protocol === "https:" &&
    ABSOLUTE_HTTP_PATTERN.test(API_BASE_URL)
  ) {
    throw new ApiError("insecure_transport", 0, "API base URL must use HTTPS when app is served over HTTPS.");
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
    headers: {
      ...options?.headers,
    },
  });
}

export async function postJson<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  options?: ApiRequestOptions,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(body),
  });
}
