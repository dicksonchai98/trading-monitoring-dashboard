import {
  HeartbeatSchema,
  KbarCurrentSchema,
  MarketSummaryLatestSchema,
  MetricLatestSchema,
  OtcSummaryLatestSchema,
  QuoteLatestSchema,
  SpotLatestListSchema,
} from "@/features/realtime/schemas/serving-event.schema";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type {
  ServingSseEventName,
  SpotLatestListPayload,
} from "@/features/realtime/types/realtime.types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const STREAM_PATH = "/v1/stream/sse";
const DEFAULT_STREAM_CODE = "TXFD6";
const SESSION_START_HHMM = "09:00:00";
const SESSION_END_HHMM = "13:45:00";

interface StreamHttpError extends Error {
  status: number;
}

interface ParsedFrame {
  event: string | null;
  data: string | null;
}

interface ServingSseBatch {
  kbarCurrent?: ReturnType<typeof useRealtimeStore.getState>["kbarCurrentByCode"][string];
  metricLatest?: {
    code: string;
    payload: ReturnType<typeof useRealtimeStore.getState>["metricLatestByCode"][string];
  };
  marketSummaryLatest?: {
    code: string;
    payload: ReturnType<typeof useRealtimeStore.getState>["marketSummaryLatestByCode"][string];
  };
  otcSummaryLatest?: {
    code: string;
    payload: ReturnType<typeof useRealtimeStore.getState>["otcSummaryLatestByCode"][string];
  };
  quoteLatest?: {
    code: string;
    payload: ReturnType<typeof useRealtimeStore.getState>["quoteLatestByCode"][string];
  };
  spotLatestList?: SpotLatestListPayload;
  heartbeatTs?: number;
}

function resolveTaipeiDatePart(tsMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(tsMs));
}

function resolveSessionBoundsForTs(tsMs: number): { startMs: number; endMs: number } {
  const datePart = resolveTaipeiDatePart(tsMs);
  return {
    startMs: Date.parse(`${datePart}T${SESSION_START_HHMM}+08:00`),
    endMs: Date.parse(`${datePart}T${SESSION_END_HHMM}+08:00`),
  };
}

function toEpochMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function shouldApplyDashboardSseEvent(eventName: string, data: unknown): boolean {
  if (eventName === "heartbeat") {
    return true;
  }
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const payload = data as Record<string, unknown>;
  let tsMs: number | null = null;
  if (eventName === "kbar_current") {
    tsMs = toEpochMs(payload.minute_ts);
  } else if (eventName === "metric_latest") {
    tsMs = toEpochMs(payload.ts) ?? toEpochMs(payload.event_ts);
  } else if (eventName === "market_summary_latest") {
    tsMs = toEpochMs(payload.minute_ts) ?? toEpochMs(payload.event_ts);
  } else if (eventName === "otc_summary_latest") {
    tsMs = toEpochMs(payload.minute_ts) ?? toEpochMs(payload.event_ts);
  } else if (eventName === "spot_latest_list") {
    tsMs = toEpochMs(payload.ts);
  } else if (eventName === "quote_latest") {
    tsMs = toEpochMs(payload.event_ts) ?? toEpochMs(payload.ts);
  }
  if (tsMs === null) {
    return false;
  }
  const { startMs, endMs } = resolveSessionBoundsForTs(tsMs);
  return tsMs >= startMs && tsMs <= endMs;
}

export function splitSseBuffer(buffer: string): { frames: string[]; rest: string } {
  // Normalize newlines so frame boundary parsing works for both LF and CRLF streams.
  const normalizedBuffer = buffer.replace(/\r\n/g, "\n");
  const frames: string[] = [];
  let cursor = 0;

  while (true) {
    const boundary = normalizedBuffer.indexOf("\n\n", cursor);
    if (boundary === -1) {
      break;
    }
    const frame = normalizedBuffer.slice(cursor, boundary).trim();
    if (frame) {
      frames.push(frame);
    }
    cursor = boundary + 2;
  }

  return {
    frames,
    rest: normalizedBuffer.slice(cursor),
  };
}

export function parseSseFrame(frame: string): ParsedFrame {
  const lines = frame.split("\n");
  let event: string | null = null;
  const dataParts: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trim());
    }
  }

  return {
    event,
    data: dataParts.length > 0 ? dataParts.join("\n") : null,
  };
}

export function applyServingSseEvent(eventName: string, data: unknown): void {
  if (!shouldApplyDashboardSseEvent(eventName, data)) {
    return;
  }
  const batch: ServingSseBatch = {};
  collectServingSseEvent(eventName, data, batch);
  applyServingSseBatch(batch);
}

function applyServingSseBatch(batch: ServingSseBatch): void {
  useRealtimeStore.getState().applySseBatch(batch);
}

function collectServingSseEvent(eventName: string, data: unknown, batch: ServingSseBatch): void {
  if (eventName === "kbar_current") {
    const parsed = KbarCurrentSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.kbarCurrent = parsed.data;
    return;
  }

  if (eventName === "metric_latest") {
    const parsed = MetricLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    const fallbackCode = DEFAULT_STREAM_CODE;
    const payloadCode =
      typeof (data as { code?: unknown })?.code === "string"
        ? ((data as { code: string }).code || fallbackCode)
        : fallbackCode;
    batch.metricLatest = {
      code: payloadCode,
      payload: parsed.data,
    };
    return;
  }

  if (eventName === "market_summary_latest") {
    const parsed = MarketSummaryLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    const fallbackCode = DEFAULT_STREAM_CODE;
    const payloadCode = parsed.data.market_code || parsed.data.code || fallbackCode;
    batch.marketSummaryLatest = {
      code: payloadCode,
      payload: parsed.data,
    };
    return;
  }

  if (eventName === "heartbeat") {
    const parsed = HeartbeatSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.heartbeatTs = parsed.data.ts;
    return;
  }

  if (eventName === "spot_latest_list") {
    const parsed = SpotLatestListSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.spotLatestList = parsed.data;
    return;
  }

  if (eventName === "otc_summary_latest") {
    const parsed = OtcSummaryLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    const payloadCode =
      typeof parsed.data.code === "string" && parsed.data.code.trim()
        ? parsed.data.code
        : "OTC001";
    batch.otcSummaryLatest = {
      code: payloadCode,
      payload: parsed.data,
    };
    return;
  }

  if (eventName === "quote_latest") {
    const parsed = QuoteLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    const fallbackCode = DEFAULT_STREAM_CODE;
    const payloadCode = parsed.data.code || fallbackCode;
    batch.quoteLatest = {
      code: payloadCode,
      payload: parsed.data,
    };
  }
}

class RealtimeManager {
  private token: string | null = null;
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private stoppedByClient = false;

  connect(token: string): void {
    if (!token) {
      this.disconnect();
      return;
    }
    if (this.token === token && this.abortController) {
      return;
    }
    this.token = token;
    this.stoppedByClient = false;
    this.clearReconnectTimer();
    this.start();
  }

  disconnect(): void {
    this.stoppedByClient = true;
    this.token = null;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    useRealtimeStore.getState().setConnectionStatus("idle", null);
  }

  private start(): void {
    if (!this.token) {
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    const controller = new AbortController();
    this.abortController = controller;
    useRealtimeStore.getState().setConnectionStatus(
      this.reconnectAttempts > 0 ? "retrying" : "connecting",
      null,
    );

    void this.stream(controller.signal, this.token).catch((error: unknown) => {
      if (this.stoppedByClient || controller.signal.aborted) {
        return;
      }

      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as StreamHttpError).status)
        : null;

      if (status === 401 || status === 403) {
        useRealtimeStore.getState().setConnectionStatus("error", "auth_failed");
        return;
      }

      if (status === 429) {
        useRealtimeStore.getState().setConnectionStatus("retrying", "rate_limited");
        this.scheduleReconnect(5000);
        return;
      }

      useRealtimeStore.getState().setConnectionStatus("retrying", "stream_disconnected");
      const delayMs = Math.min(30_000, 1_000 * Math.max(1, 2 ** this.reconnectAttempts));
      this.scheduleReconnect(delayMs);
    });
  }

  private scheduleReconnect(delayMs: number): void {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.start();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async stream(signal: AbortSignal, token: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}${STREAM_PATH}?code=${encodeURIComponent(DEFAULT_STREAM_CODE)}`,
      {
        method: "GET",
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
      },
    );

    if (!response.ok) {
      const err = new Error(`sse_http_${response.status}`) as StreamHttpError;
      err.status = response.status;
      throw err;
    }

    if (!response.body) {
      throw new Error("sse_no_body");
    }

    this.reconnectAttempts = 0;
    useRealtimeStore.getState().setConnectionStatus("connected", null);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = splitSseBuffer(buffer);
      buffer = rest;
      const batch: ServingSseBatch = {};

      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (!parsed.event || !parsed.data) {
          continue;
        }
        let payload: unknown;
        try {
          payload = JSON.parse(parsed.data);
        } catch {
          continue;
        }
        if (!shouldApplyDashboardSseEvent(parsed.event, payload)) {
          continue;
        }
        collectServingSseEvent(parsed.event as ServingSseEventName, payload, batch);
      }

      if (
        batch.kbarCurrent ||
        batch.metricLatest ||
        batch.marketSummaryLatest ||
        batch.otcSummaryLatest ||
        batch.quoteLatest ||
        batch.spotLatestList ||
        typeof batch.heartbeatTs === "number"
      ) {
        applyServingSseBatch(batch);
      }
    }

    if (!signal.aborted) {
      throw new Error("sse_stream_closed");
    }
  }
}

export const realtimeManager = new RealtimeManager();
