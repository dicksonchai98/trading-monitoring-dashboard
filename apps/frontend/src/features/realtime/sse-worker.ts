type WorkerIncomingMessage =
  | { type: "chunk"; data: string }
  | { type: "flush" }
  | { type: "teardown" };

type WorkerBatch = {
  kbarCurrent?: Record<string, unknown>;
  metricLatestMap?: Record<string, Record<string, unknown>>;
  marketSummaryMap?: Record<string, Record<string, unknown>>;
  otcSummaryMap?: Record<string, Record<string, unknown>>;
  quoteLatestMap?: Record<string, Record<string, unknown>>;
  spotLatestList?: Record<string, unknown>;
  spotMarketDistributionLatest?: Record<string, unknown>;
  spotMarketDistributionSeries?: Record<string, unknown>;
  indexContribRanking?: Record<string, unknown> | null;
  indexContribSector?: Record<string, unknown> | null;
  heartbeatTs?: number;
};

const DEFAULT_STREAM_CODE = "TXFE6";
const DEFAULT_OTC_CODE = "OTC001";
const SESSION_START_HHMM = "09:00:00";
const SESSION_END_HHMM = "13:45:00";
const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const FLUSH_MS = 100;

let buffer = "";
let pendingBatch: WorkerBatch = {};
let flushTimer: number | null = null;

let cachedSessionDatePart: string | null = null;
let cachedSessionBounds: { startMs: number; endMs: number } | null = null;

function resolveTaipeiDatePart(tsMs: number): string {
  return TAIPEI_DATE_FORMATTER.format(new Date(tsMs));
}

function resolveSessionBoundsForTs(tsMs: number): {
  startMs: number;
  endMs: number;
} {
  const datePart = resolveTaipeiDatePart(tsMs);
  if (cachedSessionDatePart === datePart && cachedSessionBounds) {
    return cachedSessionBounds;
  }
  const bounds = {
    startMs: Date.parse(`${datePart}T${SESSION_START_HHMM}+08:00`),
    endMs: Date.parse(`${datePart}T${SESSION_END_HHMM}+08:00`),
  };
  cachedSessionDatePart = datePart;
  cachedSessionBounds = bounds;
  return bounds;
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

function shouldApplyDashboardSseEvent(
  eventName: string,
  data: unknown,
): boolean {
  if (eventName === "heartbeat") {
    return true;
  }
  if (
    eventName === "index_contrib_ranking" ||
    eventName === "index_contrib_sector"
  ) {
    return true;
  }
  if (!data || typeof data !== "object") {
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
  } else if (eventName === "spot_market_distribution_latest") {
    tsMs = toEpochMs(payload.ts);
  } else if (eventName === "spot_market_distribution_series") {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const last = items[items.length - 1] as Record<string, unknown> | undefined;
    tsMs = toEpochMs(last?.ts);
  } else if (eventName === "quote_latest") {
    tsMs = toEpochMs(payload.event_ts) ?? toEpochMs(payload.ts);
  }

  if (tsMs === null) {
    return false;
  }

  const { startMs, endMs } = resolveSessionBoundsForTs(tsMs);
  return tsMs >= startMs && tsMs <= endMs;
}

function splitSseBuffer(buf: string): { frames: string[]; rest: string } {
  const normalized = buf.replace(/\r\n/g, "\n");
  const frames: string[] = [];
  let cursor = 0;
  while (true) {
    const boundary = normalized.indexOf("\n\n", cursor);
    if (boundary === -1) break;
    const frame = normalized.slice(cursor, boundary).trim();
    if (frame) frames.push(frame);
    cursor = boundary + 2;
  }
  return {
    frames,
    rest: normalized.slice(cursor),
  };
}

function parseSseFrame(frame: string): {
  event: string | null;
  data: string | null;
} {
  const lines = frame.split("\n");
  let event: string | null = null;
  const dataParts: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
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

function emitBatchNow(): void {
  if (Object.keys(pendingBatch).length === 0) {
    return;
  }
  postMessage({ type: "batch", batch: pendingBatch });
  pendingBatch = {};
}

function flushAndResetTimer(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  emitBatchNow();
}

function scheduleFlush(): void {
  if (flushTimer !== null) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    emitBatchNow();
  }, FLUSH_MS) as unknown as number;
}

function collectEvent(
  eventName: string,
  payload: Record<string, unknown>,
): void {
  if (eventName === "kbar_current") {
    pendingBatch.kbarCurrent = payload;
    return;
  }

  if (eventName === "metric_latest") {
    const code =
      typeof payload.code === "string" && payload.code.trim()
        ? payload.code
        : DEFAULT_STREAM_CODE;
    pendingBatch.metricLatestMap = pendingBatch.metricLatestMap ?? {};
    pendingBatch.metricLatestMap[code] = payload;
    return;
  }

  if (eventName === "market_summary_latest") {
    const codeCandidate =
      (typeof payload.code === "string" && payload.code.trim()
        ? payload.code
        : null) ??
      (typeof payload.market_code === "string" && payload.market_code.trim()
        ? payload.market_code
        : null) ??
      DEFAULT_STREAM_CODE;
    pendingBatch.marketSummaryMap = pendingBatch.marketSummaryMap ?? {};
    pendingBatch.marketSummaryMap[codeCandidate] = payload;
    return;
  }

  if (eventName === "otc_summary_latest") {
    const code =
      typeof payload.code === "string" && payload.code.trim()
        ? payload.code
        : DEFAULT_OTC_CODE;
    pendingBatch.otcSummaryMap = pendingBatch.otcSummaryMap ?? {};
    pendingBatch.otcSummaryMap[code] = payload;
    return;
  }

  if (eventName === "quote_latest") {
    const code =
      typeof payload.code === "string" && payload.code.trim()
        ? payload.code
        : DEFAULT_STREAM_CODE;
    pendingBatch.quoteLatestMap = pendingBatch.quoteLatestMap ?? {};
    pendingBatch.quoteLatestMap[code] = payload;
    return;
  }

  if (eventName === "spot_latest_list") {
    pendingBatch.spotLatestList = payload;
    return;
  }

  if (eventName === "spot_market_distribution_latest") {
    pendingBatch.spotMarketDistributionLatest = payload;
    return;
  }

  if (eventName === "spot_market_distribution_series") {
    pendingBatch.spotMarketDistributionSeries = payload;
    return;
  }

  if (eventName === "index_contrib_ranking") {
    pendingBatch.indexContribRanking = payload;
    return;
  }

  if (eventName === "index_contrib_sector") {
    pendingBatch.indexContribSector = payload;
    if (typeof payload.ts === "number" && Number.isFinite(payload.ts)) {
      pendingBatch.heartbeatTs = payload.ts;
    }
    return;
  }

  if (eventName === "heartbeat") {
    if (typeof payload.ts === "number" && Number.isFinite(payload.ts)) {
      pendingBatch.heartbeatTs = payload.ts;
    }
  }
}

onmessage = (ev: MessageEvent<WorkerIncomingMessage>) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") {
    return;
  }

  if (msg.type === "teardown") {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    buffer = "";
    pendingBatch = {};
    return;
  }

  if (msg.type === "flush") {
    flushAndResetTimer();
    return;
  }

  if (msg.type !== "chunk" || typeof msg.data !== "string") {
    return;
  }

  buffer += msg.data;
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

    if (!shouldApplyDashboardSseEvent(parsed.event, payload)) {
      continue;
    }
    if (!payload || typeof payload !== "object") {
      continue;
    }

    collectEvent(parsed.event, payload as Record<string, unknown>);
  }

  scheduleFlush();
};
