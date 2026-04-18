# SSE Batching 與 UI 穩定化設計

日期：2026-04-18
作者：Copilot

摘要
- 目標：以「穩定 UI（降低重繪，10Hz 上限）」為首要準則，解決 batch 覆蓋 bug、降低主線程壓力、並提供未來移到 Web Worker 的路徑。

成功準則
- UI 重繪頻率穩定在最多 10 次／秒（charts）。
- 不再因同一讀取迴圈而遺失同類事件（修正覆蓋 bug）。
- 在 100ms 時窗內合併多次讀取以減少 setState 次數。
- 可逐步切換到 Worker-based 解析（未必初次部署）。

變更總覽（要做的事）
1. 修正 batch 覆蓋 bug：把 ServingSseBatch 由單值屬性改為 per-event map/array（例如 metricLatestMap: Record<code, payload>）。collectServingSseEvent 應 append 而非覆蓋。
2. Client time-window batching：在 realtime-manager 中增加 pendingBatch 與 scheduleApply（預設 window = 100ms），stream loop 的每次解析結果合併到 pendingBatch，timer 到期時一次性 apply。
3. UI 節流（10Hz）：chart component 層使用節流 hook（useThrottledSubscription）或 local rAF 篩選，確保繪圖最多 10Hz。series 實作 ring-buffer 或 in-place capped array（避免頻繁 slice）。
4. Worker 路線（選做）：設計對 Worker 的抽象界面（fetch-in-worker 或 post-chunk-in-worker），Worker 做 decode/parse/validate/aggregate，再以固定節拍 postMessage 給主線程。

詳細設計

A. ServingSseBatch 結構變更
- 以前（問題）：
  - batch.metricLatest?: { code, payload }  // 單一值，會被同一讀取內的後續事件覆蓋
- 改為（建議）：
  interface ServingSseBatch {
    metricLatestMap?: Record<string, MetricLatestPayload>;
    marketSummaryMap?: Record<string, MarketSummaryPayload>;
    otcSummaryMap?: Record<string, OtcSummaryPayload>;
    quoteLatestMap?: Record<string, QuoteLatestPayload>;
    spotLatestList?: SpotLatestListPayload[]; // 如需序列保留
    spotMarketDistributionLatest?: SpotMarketDistributionLatestPayload; // 如果 server 每次發的只有最新則可保留單一
    indexContribRanking?: IndexContributionRankingPayload | null; // 少量全局事件可維持單值
    indexContribSector?: IndexContributionSectorPayload | null;
    heartbeatTs?: number;
  }

- collectServingSseEvent 變更：對每個 parsed event append 到相對 map：
  - 如果 event === 'metric_latest' 且 parsed.data.code === 'XXX'，則 batch.metricLatestMap[code] = parsedPayload;
  - 如 event 類型允許多筆（同類多筆），則使用 map 或 push 到 array（視需要）。

B. pendingBatch 與 time-window batching 實作（realtime-manager）
- 全域變數（manager 實例內）：
  - private pendingBatch: ServingSseBatch | null = null;
  - private applyTimer: ReturnType<typeof setTimeout> | null = null;
  - private BATCH_WINDOW_MS = 100; // 可配置

- onFramesParsed(frames):
  - 對每個 frame 呼 collectServingSseEvent(parsed.event, payload, pendingBatchCandidate)
  - merge pendingBatchCandidate 到 this.pendingBatch（對 map 做 shallow merge，對 arrays 做 concat）
  - if (!this.applyTimer) this.applyTimer = setTimeout(() => { this.flushPendingBatch(); }, BATCH_WINDOW_MS);

- flushPendingBatch():
  - const batch = this.pendingBatch; this.pendingBatch = null; clear applyTimer
  - applyServingSseBatch(batch);

設計考量
- 為何 100ms？
  - 在預設情況下，100ms balance 延遲和合併效益；對於 10Hz UI cap，100ms 可把多個事件合併為一次更新。
- 為何仍保留某些單值（index contrib）？
  - 少量全局事件（每秒一次或更少）直接用單值會簡潔且不會丟失資訊。

C. applyServingSseBatch 的更新策略
- 不要一次用一個大物件替換整個 store 狀態。
- 建議：applyServingSseBatch 展開 maps，並對每個鍵呼 useRealtimeStore.getState().upsertXxx（細粒度 upsert），或在一次 set() 中只包含被改變的子樹（目前採用此法，但要確保只拷貝必要的部分）。
- 例如：
  - for (const [code, payload] of Object.entries(batch.metricLatestMap || {})) {
      useRealtimeStore.getState().upsertMetricLatest(code, payload);
    }

D. UI 層節流與 series 儲存
- 提供 useThrottledSubscription(selector, ms) hook：在 hook 內透過 useRef 緩存 latestValue 並每 ms 用 setState 推一次（使用 rAF 或 setTimeout）。
- Series 儲存：把 appendPoint 改成在固定 cap 下做 in-place shallow copy（例如複製 references 最小化）或使用 typed ring-buffer（固定長度、覆寫舊項），在 React 層回傳新的 Array 參考以觸發 render，但避免每次都做 full slice 或大量分配。
- Chart lib：Recharts 為 SVG，如果需更高效可考慮 canvas-based libs（uPlot, lightning-chart, or custom canvas）。先用節流降頻即可。

E. Web Worker 路線（選項，設計要點）
- API 方法 A: Worker fetches stream directly
  - Pros: 主線程負擔最小；Cons: Worker 無法直接使用 browser 的 fetch stream in all browsers? Fetch in worker is supported in modern browsers; token 傳遞/renewal需考量。
- API 方法 B: 主線程把 response.body chunks 傳給 worker
  - Pros: 主線程控制 connection；Cons: 需要在主線程仍做 getReader() 並 postMessage 成本。
- 建議：先實作 B（較保守），但視瀏覽器支持再評估 A。

測試計畫
- 單元：collectServingSseEvent 對多 frames 的合併行為測試（覆蓋各 event type）。
- 積分：開啓 ENABLE_SPOT_GAP_K_MOCK 模式，以高頻 stream 模擬，量測 CPU 主線程耗時 / FPS / GC。
- E2E：在不同網速/背景 tab 測試行為。

回滾與部署步驟
1. 實作（batch map + pending batching + UI throttle）並開 feature flag（VITE_ENABLE_SSE_BATCHING=true）。
2. 部署至 staging，測量 key metrics。
3. 若 ok，部署至 production；如需更強效再做 Worker 版。

附錄：簡短 sample pseudocode

// merge helper
function mergeBatch(dest, src) {
  if (!src) return dest;
  dest = dest || {};
  // shallow merge maps
  for (const k of Object.keys(src.metricLatestMap || {})) {
    dest.metricLatestMap = dest.metricLatestMap || {};
    dest.metricLatestMap[k] = src.metricLatestMap[k];
  }
  // arrays: concat (careful with cap)
}

// scheduling
if (!this.applyTimer) {
  this.applyTimer = setTimeout(() => { this.flushPendingBatch(); }, this.BATCH_WINDOW_MS);
}

-- END
