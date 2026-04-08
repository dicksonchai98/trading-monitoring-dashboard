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

export interface MarketSummaryPoint {
  code?: string;
  market_code?: string;
  trade_date?: string;
  minute_ts?: number;
  event_ts?: number;
  estimated_turnover?: number | null;
  cumulative_turnover?: number | null;
  yesterday_estimated_turnover?: number | null;
  estimated_turnover_diff?: number | null;
  estimated_turnover_ratio?: number | null;
}

export type MarketSummaryResponse = MarketSummaryPoint[];

export interface DailyAmplitudePoint {
  code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  day_amplitude: number;
}

export type DailyAmplitudeResponse = DailyAmplitudePoint[];

export interface EstimatedVolumeBaselineResponse {
  marketSummaryToday: MarketSummaryResponse;
  marketSummaryYesterday: MarketSummaryResponse;
}
