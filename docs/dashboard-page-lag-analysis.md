# Dashboard 页面卡顿问题分析与解决方式

## 背景

本次分析聚焦于 `apps/frontend/src/features/dashboard` 与 `apps/frontend/src/features/realtime` 的实时链路，目标是解释当前 dashboard 页面可能出现卡顿（掉帧、交互迟滞、滚动不顺）的原因，并给出可执行的解决方式。

---

## 问题 1：SSE 高频更新导致时间序列被“全量重建”

### 现象

- 每次 realtime 数据到达时，时间序列都会从 baseline 重新计算，而不是只更新增量点。
- 数据点变多后，CPU 占用和渲染耗时会逐步上升。

### 证据位置

- `apps/frontend/src/features/dashboard/hooks/use-kbar-timeline.ts`
- `apps/frontend/src/features/dashboard/hooks/use-metric-timeline.ts`
- `apps/frontend/src/features/dashboard/lib/market-overview-mapper.ts`

### 根因

- `useMemo` 的依赖里包含 `kbarCurrent/metricLatest`，每次更新都会触发：
  1. 遍历 baseline 数据；
  2. 重新构造 map；
  3. `Object.keys -> sort -> map` 重建整段序列。

这是典型的 “高频输入 + 全量重算” 模式。

### 解决方式

1. 将 timeline 逻辑改为**增量 patch**：
   - baseline 初次加载后固定为初始序列；
   - realtime 仅按 `minuteTs` 更新末尾点或追加新点。
2. 保留有序数组结构，避免每次 `Object.keys + sort`。
3. 仅在代码切换/日期切换时重新建 baseline。

---

## 问题 2：同一数据被多张图重复转换，放大主线程负担

### 现象

- 同一份 `tickSeries` 被 4 张图（OrderFlow、VolumeLadder、BidAskPressure、ProgramActivity）重复做映射转换。
- 每次 tick 都会触发多次重复 `map` 与图表重布局。

### 证据位置

- `apps/frontend/src/features/dashboard/components/PanelCharts.tsx`
- `apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx`

### 根因

- 各图组件各自调用 `toOrderFlowMarketData`/衍生转换，未共享中间结果。
- 图表库本身每次 data identity 改变都会执行较重的 layout/paint。

### 解决方式

1. 在上层（如 `RealtimeDashboardOverview`）统一 `useMemo` 一次生成 chartData。
2. 将统一的 chartData 透传给 4 张图，避免重复转换。
3. 对稳定配置（axis/tooltip formatter）做常量化或 memo，降低 diff 成本。

---

## 问题 3：`DashboardMetricPanels` 渲染路径计算过重

### 现象

- 面板内订阅多个 realtime slice，更新频率高。
- `GapKlinePanelChart` 在 render 中执行大量计算（map/filter/flatMap/min/max），每次更新都会重复执行。

### 证据位置

- `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`

### 根因

- 计算逻辑与视图渲染耦合，导致每次 state 变化都触发同步重算。
- `spotLatestList` 更新会带动整块 SVG 重新生成。

### 解决方式

1. 将 `gapKlineData`、`validPctRows`、`baseMin/baseMax`、`yScale` 等迁入 `useMemo`。
2. 拆分组件并使用 `React.memo`，隔离“高频变化”和“低频静态”区域。
3. 若业务允许，降低该模块更新频率（例如按秒聚合后再渲染）。

---

## 问题 4：OTC 指数序列在 realtime 下仍走全量合并

### 现象

- OTC 最新点更新时，仍走“合并后全量重排”。

### 证据位置

- `apps/frontend/src/features/dashboard/hooks/use-otc-index-series.ts`

### 根因

- `useMemo` 中使用 `toSeries` 对全量数据做排序与重建。

### 解决方式

1. 维护有序序列与索引，按 `minuteTs` 原位更新或 append。
2. 仅当出现乱序数据时才做局部修正，不做全量排序。

---

## 问题 5：SSE 过滤链路存在不必要的高频格式化开销

### 现象

- 每个 event 都会做交易时段判断。
- 时段判断内部多次调用 `Intl.DateTimeFormat` / 日期解析。

### 证据位置

- `apps/frontend/src/features/realtime/services/realtime-manager.ts`

### 根因

- `shouldApplyDashboardSseEvent` 高频调用；
- `resolveTaipeiDatePart` 每次都新建 formatter，存在可优化空间。

### 解决方式

1. 缓存 formatter（模块级单例），避免重复构造。
2. 缓存当日 session bounds（按日刷新），减少重复 `Date.parse`。
3. 先做轻量字段判定，再做日期边界判定（短路优化）。

---

## 已确认不是主因的点

- 图表动画已关闭（多数 `isAnimationActive={false}`），动画本身不是主要瓶颈。
- 页面路由骨架屏逻辑与卡顿关系较小（更偏首次切页体验，不是持续掉帧来源）。

---

## 推荐落地顺序（低风险到高收益）

1. 先做 `DashboardMetricPanels` 的 memo 化与组件拆分。  
2. 再做 `tickSeries` 的共享转换（避免 4 张图重复 map）。  
3. 最后把 timeline 改为增量 patch（最大收益，但改动面更大）。  

---

## 预期效果

完成上述优化后，通常可获得以下改善：

- realtime 更新时 CPU 峰值下降；
- dashboard 图表区域掉帧减少；
- 页面交互（滚动、hover、切换）更稳定；
- 随时间增长导致的“越跑越卡”现象显著缓解。

