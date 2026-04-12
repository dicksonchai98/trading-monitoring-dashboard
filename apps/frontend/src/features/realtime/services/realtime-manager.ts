import {
  HeartbeatSchema,
  KbarCurrentSchema,
  MetricLatestSchema,
} from "@/features/realtime/schemas/serving-event.schema";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { ServingSseEventName } from "@/features/realtime/types/realtime.types";
import { shouldBlockInsecureTransport } from "@/lib/api/transport";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const STREAM_PATH = "/v1/stream/sse";

interface StreamHttpError extends Error {
  status: number;
}

interface ParsedFrame {
  event: string | null;
  data: string | null;
}

export function splitSseBuffer(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let cursor = 0;

  while (true) {
    const boundary = buffer.indexOf("\n\n", cursor);
    if (boundary === -1) {
      break;
    }
    const frame = buffer.slice(cursor, boundary).trim();
    if (frame) {
      frames.push(frame);
    }
    cursor = boundary + 2;
  }

  return {
    frames,
    rest: buffer.slice(cursor),
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
  const store = useRealtimeStore.getState();

  if (eventName === "kbar_current") {
    const parsed = KbarCurrentSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    store.upsertKbarCurrent(parsed.data);
    return;
  }

  if (eventName === "metric_latest") {
    const parsed = MetricLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    const candidateCode = useRealtimeStore.getState().kbarCurrentByCode;
    const codes = Object.keys(candidateCode);
    const fallbackCode = codes.length > 0 ? codes[0] : "MTX";
    const payloadCode =
      typeof (data as { code?: unknown })?.code === "string"
        ? ((data as { code: string }).code || fallbackCode)
        : fallbackCode;
    store.upsertMetricLatest(payloadCode, parsed.data);
    return;
  }

  if (eventName === "heartbeat") {
    const parsed = HeartbeatSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    store.setHeartbeat(parsed.data.ts);
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

      if (error instanceof Error && error.message === "insecure_transport") {
        useRealtimeStore.getState().setConnectionStatus("error", "stream_disconnected");
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
    if (
      typeof window !== "undefined" &&
      shouldBlockInsecureTransport(API_BASE_URL, window.location.protocol, import.meta.env.PROD)
    ) {
      throw new Error("insecure_transport");
    }

    const response = await fetch(`${API_BASE_URL}${STREAM_PATH}`, {
      method: "GET",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
    });

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
        applyServingSseEvent(parsed.event as ServingSseEventName, payload);
      }
    }

    if (!signal.aborted) {
      throw new Error("sse_stream_closed");
    }
  }
}

export const realtimeManager = new RealtimeManager();
