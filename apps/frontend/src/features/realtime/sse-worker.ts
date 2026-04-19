// sse-worker.ts - intended to run as a Worker module
// Minimal SSE chunk collector and batch flusher

type PendingBatch = Record<string, any> & {
  metricLatestMap?: Record<string, any>;
  marketSummaryMap?: Record<string, any>;
  otcSummaryMap?: Record<string, any>;
  quoteLatestMap?: Record<string, any>;
  spotLatestList?: any;
  spotMarketDistributionLatest?: any;
  spotMarketDistributionSeries?: any;
  heartbeatTs?: number;
};

let buffer = '';
let pendingBatch: PendingBatch = {};
let flushTimer: number | null = null;
const FLUSH_MS = 100;

function scheduleFlush(ms = FLUSH_MS) {
  if (flushTimer != null) return;
  flushTimer = (setInterval(() => {
    try {
      if (Object.keys(pendingBatch).length > 0) {
        // post batch and clear
        postMessage({ type: 'batch', batch: pendingBatch });
        pendingBatch = {};
      }
    } catch (e) {
      // ignore
    }
  }, ms) as unknown) as number;
}

function splitSseBuffer(buf: string) {
  const parts = buf.split(/\r?\n\r?\n/);
  const frames = parts.slice(0, -1);
  const rest = parts[parts.length - 1] || '';
  return { frames, rest };
}

function parseSseFrame(frame: string) {
  const lines = frame.split(/\r?\n/);
  let event: string | null = null;
  let dataParts: string[] = [];
  for (const ln of lines) {
    if (ln.startsWith('event:')) {
      event = ln.substring(6).trim();
    } else if (ln.startsWith('data:')) {
      dataParts.push(ln.substring(5));
    }
  }
  return { event, data: dataParts.join('\n') };
}

onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'chunk' && typeof msg.data === 'string') {
    buffer += msg.data;
    const { frames, rest } = splitSseBuffer(buffer);
    buffer = rest;
    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed.event || !parsed.data) continue;
      try {
        const payload = JSON.parse(parsed.data);
        if (parsed.event === 'metric_latest' && payload?.code) {
          pendingBatch.metricLatestMap = pendingBatch.metricLatestMap || {};
          pendingBatch.metricLatestMap[payload.code] = payload;
        } else if (parsed.event === 'kbar_current' && payload) {
          pendingBatch.kbarCurrent = payload;
        } else if (parsed.event === 'market_summary_latest' && payload?.market_code) {
          pendingBatch.marketSummaryMap = pendingBatch.marketSummaryMap || {};
          pendingBatch.marketSummaryMap[payload.market_code] = payload;
        } else if (parsed.event === 'spot_latest_list' && payload) {
          pendingBatch.spotLatestList = payload;
        } else if (parsed.event === 'spot_market_distribution_latest' && payload) {
          pendingBatch.spotMarketDistributionLatest = payload;
        } else if (parsed.event === 'spot_market_distribution_series' && payload) {
          pendingBatch.spotMarketDistributionSeries = payload;
        } else if (parsed.event === 'heartbeat' && typeof payload?.ts === 'number') {
          pendingBatch.heartbeatTs = payload.ts;
        }
      } catch (e) {
        // ignore parse failures in worker
      }
    }
    scheduleFlush();
  } else if (msg.type === 'flush') {
    if (Object.keys(pendingBatch).length > 0) {
      postMessage({ type: 'batch', batch: pendingBatch });
      pendingBatch = {};
    }
  }
};
