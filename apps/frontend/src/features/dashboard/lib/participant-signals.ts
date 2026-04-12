export interface ParticipantSignalBasePoint {
  day: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amplitude: number;
}

export interface ParticipantSignalWithMaPoint extends ParticipantSignalBasePoint {
  ma3: number | null;
  ma5: number | null;
  ma10: number | null;
  ampOpen: number;
  ampHigh: number;
  ampLow: number;
  ampClose: number;
  ampBody: number;
}

function movingAverage(values: number[], index: number, window: number): number | null {
  if (index + 1 < window) {
    return null;
  }
  const start = index - window + 1;
  const slice = values.slice(start, index + 1);
  const sum = slice.reduce((acc, value) => acc + value, 0);
  return sum / window;
}

export function withAmplitudeMovingAverages(
  rows: ParticipantSignalBasePoint[],
): ParticipantSignalWithMaPoint[] {
  const amplitudes = rows.map((row) => row.amplitude);

  return rows.map((row, index) => {
    const totalAmplitude = Math.abs(row.amplitude);
    const bodyAmplitude = Math.abs(row.close - row.open);
    const ampHigh = totalAmplitude;
    const ampLow = 0;
    const ampOpen = 0;
    const ampClose = bodyAmplitude;

    return {
      ...row,
      ma3: movingAverage(amplitudes, index, 3),
      ma5: movingAverage(amplitudes, index, 5),
      ma10: movingAverage(amplitudes, index, 10),
      ampOpen,
      ampHigh,
      ampLow,
      ampClose,
      ampBody: bodyAmplitude,
    };
  });
}
