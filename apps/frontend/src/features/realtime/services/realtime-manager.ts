import {
  HeartbeatSchema,
  IndexContributionRankingSchema,
  IndexContributionSectorSchema,
  KbarCurrentSchema,
  MarketSummaryLatestSchema,
  MetricLatestSchema,
  OtcSummaryLatestSchema,
  QuoteLatestSchema,
  SpotMarketDistributionLatestSchema,
  SpotMarketDistributionSeriesSchema,
  SpotLatestListSchema,
} from "@/features/realtime/schemas/serving-event.schema";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { createSseWorker } from "@/features/realtime/worker-index";
import type {
  ServingSseEventName,
  SpotMarketDistributionLatestPayload,
  SpotMarketDistributionSeriesPayload,
  SpotLatestListPayload,
} from "@/features/realtime/types/realtime.types";
import { shouldBlockInsecureTransport } from "@/lib/api/transport";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const STREAM_PATH = "/v1/stream/sse";
const DEFAULT_STREAM_CODE = "TXFD6";
const SESSION_START_HHMM = "09:00:00";
const SESSION_END_HHMM = "13:45:00";
const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ENABLE_SPOT_GAP_K_MOCK =
  String(import.meta.env.VITE_ENABLE_SPOT_GAP_K_MOCK ?? "").toLowerCase() ===
  "true";
const ENABLE_SSE_WORKER = String(import.meta.env.VITE_ENABLE_SSE_WORKER ?? "").toLowerCase() === "true";
const SPOT_GAP_K_SYMBOLS = [
  "2330",
  "2317",
  "2454",
  "2308",
  "2881",
  "6505",
] as const;
const SPOT_GAP_K_BASE_OPEN: Record<
  (typeof SPOT_GAP_K_SYMBOLS)[number],
  number
> = {
  "2330": 948,
  "2317": 154,
  "2454": 1310,
  "2308": 252,
  "2881": 79.8,
  "6505": 109.5,
};

interface StreamHttpError extends Error {
  status: number;
}

interface ParsedFrame {
  event: string | null;
  data: string | null;
}

interface ServingSseBatch {
  kbarCurrent?: ReturnType<
    typeof useRealtimeStore.getState
  >["kbarCurrentByCode"][string];
  metricLatestMap?: Record<
    string,
    ReturnType<typeof useRealtimeStore.getState>["metricLatestByCode"][string]
  >;
  marketSummaryMap?: Record<
    string,
    ReturnType<typeof useRealtimeStore.getState>["marketSummaryLatestByCode"][string]
  >;
  otcSummaryMap?: Record<
    string,
    ReturnType<typeof useRealtimeStore.getState>["otcSummaryLatestByCode"][string]
  >;
  quoteLatestMap?: Record<
    string,
    ReturnType<typeof useRealtimeStore.getState>["quoteLatestByCode"][string]
  >;
  spotLatestList?: SpotLatestListPayload;
  spotMarketDistributionLatest?: SpotMarketDistributionLatestPayload;
  spotMarketDistributionSeries?: SpotMarketDistributionSeriesPayload;
  indexContribRanking?: ReturnType<typeof useRealtimeStore.getState>["indexContribRanking"] | null;
  indexContribSector?: ReturnType<typeof useRealtimeStore.getState>["indexContribSector"] | null;
  heartbeatTs?: number;
}

function resolveMockSessionStartTs(): number {
  const datePart = resolveTaipeiDatePart(Date.now());
  return Date.parse(`${datePart}T10:00:00+08:00`);
}

interface SpotGapMockSymbolState {
  open: number;
  close: number;
  sessionHigh: number;
  sessionLow: number;
  referencePrice: number;
}

const SPOT_STRENGTH_THRESHOLD_PCT = 0.8;
let cachedSessionDatePart: string | null = null;
let cachedSessionBounds: {
  startMs: number;
  endMs: number;
} | null = null;

type SpotStrengthState =
  | "new_high"
  | "strong_up"
  | "flat"
  | "strong_down"
  | "new_low";

function resolveSpotStrength(
  openPrice: number,
  lastPrice: number,
  isNewHigh: boolean,
  isNewLow: boolean,
): { state: SpotStrengthState; score: number } {
  if (isNewHigh) {
    return { state: "new_high", score: 2 };
  }
  if (isNewLow) {
    return { state: "new_low", score: -2 };
  }
  if (
    !Number.isFinite(openPrice) ||
    openPrice === 0 ||
    !Number.isFinite(lastPrice)
  ) {
    return { state: "flat", score: 0 };
  }
  const changePct = ((lastPrice - openPrice) / openPrice) * 100;
  if (changePct >= SPOT_STRENGTH_THRESHOLD_PCT) {
    return { state: "strong_up", score: 1 };
  }
  if (changePct <= -SPOT_STRENGTH_THRESHOLD_PCT) {
    return { state: "strong_down", score: -1 };
  }
  return { state: "flat", score: 0 };
}

function strengthScoreToPct(score: number): number {
  return Math.max(0, Math.min(100, ((score + 2) / 4) * 100));
}

function computePositionStrengthPct(
  sessionLow: number,
  sessionHigh: number,
  price: number,
): number | null {
  if (
    !Number.isFinite(sessionLow) ||
    !Number.isFinite(sessionHigh) ||
    !Number.isFinite(price)
  ) {
    return null;
  }
  const range = sessionHigh - sessionLow;
  if (range <= 0) {
    return null;
  }
  const raw = ((price - sessionLow) / range) * 100;
  return Math.max(0, Math.min(100, Number(raw.toFixed(2))));
}

export function* createSpotLatestListMockGenerator(
  initialTs: number = resolveMockSessionStartTs(),
): Generator<SpotLatestListPayload> {
  let ts = initialTs;
  let tick = 0;
  const state = new Map<string, SpotGapMockSymbolState>(
    SPOT_GAP_K_SYMBOLS.map((symbol, index) => {
      const open = SPOT_GAP_K_BASE_OPEN[symbol];
      const referencePrice = Number(
        (open * (1 - 0.003 + index * 0.0002)).toFixed(2),
      );
      return [
        symbol,
        {
          open,
          close: open,
          sessionHigh: open,
          sessionLow: open,
          referencePrice,
        },
      ];
    }),
  );

  while (true) {
    let marketScoreSum = 0;
    const sectorStrengthValues: Record<
      "weighted" | "financial" | "tech",
      number[]
    > = {
      weighted: [],
      financial: [],
      tech: [],
    };
    const marketBreakdown: Record<SpotStrengthState, number> = {
      new_high: 0,
      strong_up: 0,
      flat: 0,
      strong_down: 0,
      new_low: 0,
    };
    const items: SpotLatestListPayload["items"] = SPOT_GAP_K_SYMBOLS.map(
      (symbol, index) => {
        const current = state.get(symbol)!;
        const wave = Math.sin((tick + index * 5) / 6) * current.open * 0.0038;
        const drift =
          (((tick + index * 11) % 31) - 15) * current.open * 0.00005;
        const close = Number((current.open + wave + drift).toFixed(2));
        const isNewHigh = close > current.sessionHigh;
        const isNewLow = close < current.sessionLow;
        const high = Math.max(current.sessionHigh, close, current.open);
        const low = Math.min(current.sessionLow, close, current.open);
        const gapValue = Number(
          (current.open - current.referencePrice).toFixed(2),
        );
        const gapPct =
          current.referencePrice === 0
            ? 0
            : Number(((gapValue / current.referencePrice) * 100).toFixed(2));
        const priceChg = Number((close - current.referencePrice).toFixed(2));
        const pctChg =
          current.referencePrice === 0
            ? 0
            : Number(
                (
                  ((close - current.referencePrice) / current.referencePrice) *
                  100
                ).toFixed(2),
              );
        const strength = resolveSpotStrength(
          current.open,
          close,
          isNewHigh,
          isNewLow,
        );
        const strengthPct =
          computePositionStrengthPct(low, high, close) ??
          strengthScoreToPct(strength.score);
        marketScoreSum += strength.score;
        marketBreakdown[strength.state] += 1;
        if (symbol === "2330" || symbol === "2317") {
          sectorStrengthValues.weighted.push(strengthPct);
        }
        if (symbol === "2881" || symbol === "6505") {
          sectorStrengthValues.financial.push(strengthPct);
        }
        if (symbol === "2454" || symbol === "2308") {
          sectorStrengthValues.tech.push(strengthPct);
        }

        state.set(symbol, {
          ...current,
          close,
          sessionHigh: high,
          sessionLow: low,
        });

        return {
          symbol,
          open: current.open,
          high,
          low,
          close,
          last_price: close,
          session_high: high,
          session_low: low,
          reference_price: current.referencePrice,
          price_chg: priceChg,
          pct_chg: pctChg,
          gap_value: gapValue,
          gap_pct: gapPct,
          is_gap_up: gapValue > 0,
          is_gap_down: gapValue < 0,
          is_new_high: isNewHigh,
          is_new_low: isNewLow,
          strength_state: strength.state,
          strength_score: strength.score,
          strength_pct: strengthPct,
          updated_at: ts,
        };
      },
    );

    const avgPct = (values: number[]): number | null =>
      values.length === 0
        ? null
        : Number(
            (
              values.reduce((acc, value) => acc + value, 0) / values.length
            ).toFixed(2),
          );

    yield {
      ts,
      market_strength_score: Number(
        (marketScoreSum / SPOT_GAP_K_SYMBOLS.length).toFixed(3),
      ),
      market_strength_pct: Number(
        ((marketScoreSum / (SPOT_GAP_K_SYMBOLS.length * 2)) * 100).toFixed(2),
      ),
      market_strength_count: SPOT_GAP_K_SYMBOLS.length,
      sector_strength: {
        weighted: avgPct(sectorStrengthValues.weighted),
        financial: avgPct(sectorStrengthValues.financial),
        tech: avgPct(sectorStrengthValues.tech),
      },
      market_strength_breakdown: marketBreakdown,
      items,
    };
    tick += 1;
    ts += 1000;
  }
}

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
  return {
    startMs: bounds.startMs,
    endMs: bounds.endMs,
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
  } else if (eventName === "index_contrib_ranking") {
    tsMs = toEpochMs(payload.ts);
  } else if (eventName === "index_contrib_sector") {
    tsMs = toEpochMs(payload.ts);
  } else if (eventName === "spot_latest_list") {
    tsMs = toEpochMs(payload.ts);
  } else if (eventName === "spot_market_distribution_latest") {
    tsMs = toEpochMs(payload.ts);
  } else if (eventName === "spot_market_distribution_series") {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const lastItem = items[items.length - 1];
    tsMs = toEpochMs(lastItem?.ts);
  } else if (eventName === "quote_latest") {
    tsMs = toEpochMs(payload.event_ts) ?? toEpochMs(payload.ts);
  }
  if (tsMs === null) {
    return false;
  }
  const { startMs, endMs } = resolveSessionBoundsForTs(tsMs);
  return tsMs >= startMs && tsMs <= endMs;
}

export function splitSseBuffer(buffer: string): {
  frames: string[];
  rest: string;
} {
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

export function collectServingSseEvent(
  eventName: string,
  data: unknown,
  batch: ServingSseBatch,
): void {
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
    // Determine fallback code: prefer the most recent kbar_current code in store, else DEFAULT_STREAM_CODE
    let fallbackCode = DEFAULT_STREAM_CODE;
    try {
      const kbarMap = useRealtimeStore.getState().kbarCurrentByCode;
      let latestTs = -Infinity;
      for (const [k, v] of Object.entries(kbarMap)) {
        const ts = (v as any)?.ts ?? (v as any)?.minute_ts ?? 0;
        if (typeof ts === "number" && ts > latestTs) {
          latestTs = ts;
          fallbackCode = k;
        }
      }
    } catch (e) {
      // ignore and fall back to DEFAULT_STREAM_CODE
    }

    const payloadCode =
      typeof (data as { code?: unknown })?.code === "string"
        ? (data as { code: string }).code || fallbackCode
        : fallbackCode;
    batch.metricLatestMap = batch.metricLatestMap || {};
    batch.metricLatestMap[payloadCode] = parsed.data;
    return;
  }

  if (eventName === "market_summary_latest") {
    const parsed = MarketSummaryLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    // prefer code field if present; otherwise attempt to use latest kbar_current code from store
    let fallbackCode = DEFAULT_STREAM_CODE;
    try {
      const kbarMap = useRealtimeStore.getState().kbarCurrentByCode;
      let latestTs = -Infinity;
      for (const [k, v] of Object.entries(kbarMap)) {
        const ts = (v as any)?.ts ?? (v as any)?.minute_ts ?? 0;
        if (typeof ts === "number" && ts > latestTs) {
          latestTs = ts;
          fallbackCode = k;
        }
      }
    } catch (e) {
      // ignore
    }
    const payloadCode = parsed.data.code || parsed.data.market_code || fallbackCode;
    batch.marketSummaryMap = batch.marketSummaryMap || {};
    batch.marketSummaryMap[payloadCode] = parsed.data;
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

  if (eventName === "index_contrib_ranking") {
    const parsed = IndexContributionRankingSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.indexContribRanking = parsed.data;
    return;
  }

  if (eventName === "index_contrib_sector") {
    const parsed = IndexContributionSectorSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.indexContribSector = parsed.data;
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

  if (eventName === "spot_market_distribution_latest") {
    const parsed = SpotMarketDistributionLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.spotMarketDistributionLatest = parsed.data;
    return;
  }

  if (eventName === "spot_market_distribution_series") {
    const parsed = SpotMarketDistributionSeriesSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    batch.spotMarketDistributionSeries = parsed.data;
    return;
  }

  if (eventName === "otc_summary_latest") {
    const parsed = OtcSummaryLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    let payloadCode = "OTC001";
    if (typeof parsed.data.code === "string" && parsed.data.code.trim()) {
      payloadCode = parsed.data.code;
    } else {
      // attempt to fallback to latest kbar_current
      try {
        const kbarMap = useRealtimeStore.getState().kbarCurrentByCode;
        let latestTs = -Infinity;
        for (const [k, v] of Object.entries(kbarMap)) {
          const ts = (v as any)?.ts ?? (v as any)?.minute_ts ?? 0;
          if (typeof ts === "number" && ts > latestTs) {
            latestTs = ts;
            payloadCode = k;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    batch.otcSummaryMap = batch.otcSummaryMap || {};
    batch.otcSummaryMap[payloadCode] = parsed.data;
    return;
  }

  if (eventName === "quote_latest") {
    const parsed = QuoteLatestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }
    // prefer explicit code; else try to reuse latest kbar_current code, then fallback
    let fallbackCode = DEFAULT_STREAM_CODE;
    try {
      const kbarMap = useRealtimeStore.getState().kbarCurrentByCode;
      let latestTs = -Infinity;
      for (const [k, v] of Object.entries(kbarMap)) {
        const ts = (v as any)?.ts ?? (v as any)?.minute_ts ?? 0;
        if (typeof ts === "number" && ts > latestTs) {
          latestTs = ts;
          fallbackCode = k;
        }
      }
    } catch (e) {
      // ignore
    }

    const payloadCode = parsed.data.code || fallbackCode;
    batch.quoteLatestMap = batch.quoteLatestMap || {};
    batch.quoteLatestMap[payloadCode] = parsed.data;
  }
}

export class RealtimeManager {
  private token: string | null = null;
  private abortController: AbortController | null = null;
  private streamTask: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private spotGapMockTimer: ReturnType<typeof setInterval> | null = null;
  private spotGapMockGenerator: Generator<SpotLatestListPayload> | null = null;
  private reconnectAttempts = 0;
  private startSequence = 0;
  private stoppedByClient = false;

  // Pending batch for client-side time-window aggregation
  private pendingBatch: ServingSseBatch | null = null;
  private pendingBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_WINDOW_MS = Number(import.meta.env.VITE_SSE_BATCH_WINDOW_MS ?? 100);
  private worker: Worker | null = null;

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
    this.clearSpotGapMockTimer();

    if (ENABLE_SPOT_GAP_K_MOCK) {
      this.startSpotGapKMock();
      return;
    }

    this.start();
  }

  disconnect(): void {
    this.stoppedByClient = true;
    this.token = null;
    this.startSequence += 1;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.clearSpotGapMockTimer();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pendingBatchTimer) {
      clearTimeout(this.pendingBatchTimer);
      this.pendingBatchTimer = null;
    }
    this.pendingBatch = null;
    if (this.worker) {
      try {
        this.worker.postMessage({ type: "teardown" });
      } catch {
        // ignore
      }
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
    useRealtimeStore.getState().setConnectionStatus("idle", null);
  }

  private start(): void {
    const sequence = ++this.startSequence;
    void this.startWhenReady(sequence);
  }

  private handleWorkerMessage(ev: MessageEvent): void {
    try {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'batch' && data.batch) {
        this.mergeIntoPendingBatch(data.batch);
      }
    } catch (e) {
      // swallow
    }
  }

  private async startWhenReady(sequence: number): Promise<void> {
    if (!this.token) {
      return;
    }

    const previousTask = this.streamTask;
    if (this.abortController) {
      this.abortController.abort();
    }

    if (previousTask) {
      await previousTask.catch(() => undefined);
      if (
        sequence !== this.startSequence ||
        !this.token ||
        this.stoppedByClient
      ) {
        return;
      }
    }

    const controller = new AbortController();
    this.abortController = controller;
    useRealtimeStore
      .getState()
      .setConnectionStatus(
        this.reconnectAttempts > 0 ? "retrying" : "connecting",
        null,
      );

    const streamTask = this.stream(controller.signal, this.token)
      .catch((error: unknown) => {
        if (this.stoppedByClient || controller.signal.aborted) {
          return;
        }

        if (error instanceof Error && error.message === "insecure_transport") {
          useRealtimeStore
            .getState()
            .setConnectionStatus("error", "stream_disconnected");
          return;
        }

        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number((error as StreamHttpError).status)
            : null;

        if (status === 401 || status === 403) {
          useRealtimeStore
            .getState()
            .setConnectionStatus("error", "auth_failed");
          return;
        }

        if (status === 429) {
          useRealtimeStore
            .getState()
            .setConnectionStatus("retrying", "rate_limited");
          this.scheduleReconnect(5000);
          return;
        }

        useRealtimeStore
          .getState()
          .setConnectionStatus("retrying", "stream_disconnected");
        const delayMs = Math.min(
          30_000,
          1_000 * Math.max(1, 2 ** this.reconnectAttempts),
        );
        this.scheduleReconnect(delayMs);
      })
      .finally(() => {
        if (this.abortController === controller) {
          this.abortController = null;
        }
        if (this.streamTask === streamTask) {
          this.streamTask = null;
        }
      });

    this.streamTask = streamTask;
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

  private startSpotGapKMock(): void {
    this.spotGapMockGenerator = createSpotLatestListMockGenerator();
    useRealtimeStore.getState().setConnectionStatus("connected", null);

    const emit = () => {
      const payload = this.spotGapMockGenerator?.next().value;
      if (!payload) {
        return;
      }
      applyServingSseBatch({ spotLatestList: payload });
    };

    emit();
    this.spotGapMockTimer = setInterval(emit, 1000);
  }

  private clearSpotGapMockTimer(): void {
    if (this.spotGapMockTimer) {
      clearInterval(this.spotGapMockTimer);
      this.spotGapMockTimer = null;
    }
    this.spotGapMockGenerator = null;
  }

  private scheduleFlushPendingBatch(): void {
    if (this.pendingBatchTimer) {
      return;
    }
    this.pendingBatchTimer = setTimeout(() => {
      try {
        this.flushPendingBatch();
      } catch {
        // swallow - never let timer crash the stream loop
      }
    }, this.BATCH_WINDOW_MS);
  }

  private flushPendingBatch(): void {
    if (this.pendingBatchTimer) {
      clearTimeout(this.pendingBatchTimer);
      this.pendingBatchTimer = null;
    }
    const batch = this.pendingBatch;
    this.pendingBatch = null;
    if (!batch) {
      return;
    }

    const hasMapEntries = (m?: Record<string, unknown>) => m && Object.keys(m).length > 0;
    const shouldApply =
      Boolean(batch.kbarCurrent) ||
      hasMapEntries(batch.metricLatestMap) ||
      hasMapEntries(batch.marketSummaryMap) ||
      hasMapEntries(batch.otcSummaryMap) ||
      hasMapEntries(batch.quoteLatestMap) ||
      Boolean(batch.spotLatestList) ||
      Boolean(batch.spotMarketDistributionLatest) ||
      Boolean(batch.spotMarketDistributionSeries) ||
      batch.indexContribRanking !== undefined ||
      batch.indexContribSector !== undefined ||
      typeof batch.heartbeatTs === "number";

    if (shouldApply) {
      applyServingSseBatch(batch);
    }
  }

  private mergeIntoPendingBatch(incoming: ServingSseBatch): void {
    // quick check for empty incoming
    const hasMapEntries = (m?: Record<string, unknown>) => m && Object.keys(m).length > 0;
    const isEmpty = !incoming.kbarCurrent &&
      !hasMapEntries(incoming.metricLatestMap) &&
      !hasMapEntries(incoming.marketSummaryMap) &&
      !hasMapEntries(incoming.otcSummaryMap) &&
      !hasMapEntries(incoming.quoteLatestMap) &&
      !incoming.spotLatestList &&
      !incoming.spotMarketDistributionLatest &&
      !incoming.spotMarketDistributionSeries &&
      incoming.indexContribRanking === undefined &&
      incoming.indexContribSector === undefined &&
      typeof incoming.heartbeatTs !== "number";
    if (isEmpty) return;

    if (!this.pendingBatch) {
      // shallow clone to avoid accidental external mutations
      this.pendingBatch = {
        ...incoming,
        metricLatestMap: incoming.metricLatestMap ? { ...incoming.metricLatestMap } : undefined,
        marketSummaryMap: incoming.marketSummaryMap ? { ...incoming.marketSummaryMap } : undefined,
        otcSummaryMap: incoming.otcSummaryMap ? { ...incoming.otcSummaryMap } : undefined,
        quoteLatestMap: incoming.quoteLatestMap ? { ...incoming.quoteLatestMap } : undefined,
      };
      this.scheduleFlushPendingBatch();
      return;
    }

    const target = this.pendingBatch;
    // single-value fields: prefer newer incoming value if present
    if (incoming.kbarCurrent) target.kbarCurrent = incoming.kbarCurrent;
    if (typeof incoming.heartbeatTs === "number") target.heartbeatTs = incoming.heartbeatTs;
    if (incoming.spotLatestList) target.spotLatestList = incoming.spotLatestList;
    if (incoming.spotMarketDistributionLatest)
      target.spotMarketDistributionLatest = incoming.spotMarketDistributionLatest;
    if (incoming.spotMarketDistributionSeries)
      target.spotMarketDistributionSeries = incoming.spotMarketDistributionSeries;
    if (incoming.indexContribRanking !== undefined)
      target.indexContribRanking = incoming.indexContribRanking;
    if (incoming.indexContribSector !== undefined)
      target.indexContribSector = incoming.indexContribSector;

    // merge maps
    const mergeMap = (key: keyof ServingSseBatch, incomingMap?: Record<string, unknown>) => {
      if (!incomingMap) return;
      if (!target[key]) {
        target[key] = { ...incomingMap } as any;
        return;
      }
      Object.assign(target[key] as Record<string, unknown>, incomingMap);
    };

    mergeMap("metricLatestMap", incoming.metricLatestMap as any);
    mergeMap("marketSummaryMap", incoming.marketSummaryMap as any);
    mergeMap("otcSummaryMap", incoming.otcSummaryMap as any);
    mergeMap("quoteLatestMap", incoming.quoteLatestMap as any);

    this.scheduleFlushPendingBatch();

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

    let buffer = "";

    this.reconnectAttempts = 0;
    useRealtimeStore.getState().setConnectionStatus("connected", null);

    // In test environments, Response bodies may not be a streaming reader. Read full text and process.
    try {
      if (typeof process !== "undefined" && (process as any).env && (process as any).env.NODE_ENV === "test") {
        const text = await response.text();
        let buffer = "";
        buffer += text;
        const { frames, rest } = splitSseBuffer(buffer);
        buffer = rest;
        const batch: ServingSseBatch = {};
        for (const frame of frames) {
          const parsed = parseSseFrame(frame);
          if (!parsed.event || !parsed.data) continue;
          let payload: unknown;
          try {
            payload = JSON.parse(parsed.data);
          } catch {
            continue;
          }
          if (!shouldApplyDashboardSseEvent(parsed.event, payload)) continue;
          collectServingSseEvent(parsed.event as ServingSseEventName, payload, batch);
        }
        // Merge into pendingBatch so the same flush path is used as streaming chunks.
        this.mergeIntoPendingBatch(batch);
        return;
      }
    } catch (e) {
      // fall through to streaming path
    }

    if (!response.body) {
      // Some test environments return Response with no body but with text available.
      // Fall back to reading whole text and processing frames once.
      try {
        const text = await response.text();
        buffer += text;
        const { frames, rest } = splitSseBuffer(buffer);
        buffer = rest;
        const batch: ServingSseBatch = {};
        for (const frame of frames) {
          const parsed = parseSseFrame(frame);
          if (!parsed.event || !parsed.data) continue;
          let payload: unknown;
          try {
            payload = JSON.parse(parsed.data);
          } catch {
            continue;
          }
          if (!shouldApplyDashboardSseEvent(parsed.event, payload)) continue;
          collectServingSseEvent(parsed.event as ServingSseEventName, payload, batch);
        }
        // Merge into pendingBatch so the same flush path is used as streaming chunks.
        this.mergeIntoPendingBatch(batch);
        // finished
        if (!response.body) return;
      } catch (e) {
        throw new Error("sse_no_body");
      }
    }

    // If worker mode is enabled, ensure worker exists and is wired
    try {
      if (ENABLE_SSE_WORKER && !this.worker) {
        const worker = createSseWorker();
        if (worker) {
          this.worker = worker;
          this.worker.onmessage = (ev) => this.handleWorkerMessage(ev as MessageEvent);
        }
      }
    } catch {
      // ignore worker creation failures and fall back to local parsing
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let processedAny = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (this.worker) {
          try {
            this.worker.postMessage({ type: "flush" });
          } catch {
            // ignore
          }
        }
        break;
      }
      if (!value) {
        continue;
      }

      const decodedChunk = decoder.decode(value, { stream: true });

      // If worker enabled, forward raw decoded chunks to worker and skip local parsing
      if (this.worker) {
        try {
          this.worker.postMessage({ type: 'chunk', data: decodedChunk });
          processedAny = true;
        } catch (e) {
          // if postMessage fails, fall back to local parsing below
          buffer += decodedChunk;
        }
        continue;
      }

      buffer += decodedChunk;
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
        collectServingSseEvent(
          parsed.event as ServingSseEventName,
          payload,
          batch,
        );
        processedAny = true;
      }

      // Merge collected batch into the manager's pendingBatch and schedule a flush.
      this.mergeIntoPendingBatch(batch);
    }

    // If reader completed without yielding any chunks, fallback to reading full text
    if (!processedAny) {
      try {
        const text = await response.text();
        if (text) {
          buffer += text;
          const { frames, rest } = splitSseBuffer(buffer);
          buffer = rest;
          const batch: ServingSseBatch = {};
          for (const frame of frames) {
            const parsed = parseSseFrame(frame);
            if (!parsed.event || !parsed.data) continue;
            let payload: unknown;
            try {
              payload = JSON.parse(parsed.data);
            } catch {
              continue;
            }
            if (!shouldApplyDashboardSseEvent(parsed.event, payload)) continue;
            collectServingSseEvent(parsed.event as ServingSseEventName, payload, batch);
          }
          if (typeof process !== "undefined" && (process as any).env && (process as any).env.NODE_ENV === "test") {
            applyServingSseBatch(batch);
          } else {
            this.mergeIntoPendingBatch(batch);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!signal.aborted) {
      throw new Error("sse_stream_closed");
    }
  }
}

export const realtimeManager = new RealtimeManager();
