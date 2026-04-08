export interface KbarTodayPoint {
  code: string;
  trade_date: string;
  minute_ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amplitude?: number;
  amplitude_pct?: number;
}

export interface MetricTodayPoint {
  bid?: number;
  ask?: number;
  mid?: number;
  spread?: number;
  bid_size?: number;
  ask_size?: number;
  main_force_big_order?: number;
  event_ts?: string;
  ts?: number;
}

export type KbarTodayResponse = KbarTodayPoint[];
export type MetricTodayResponse = MetricTodayPoint[];

export interface OrderFlowBaselineResponse {
  kbarToday: KbarTodayResponse;
  metricToday: MetricTodayResponse;
}
