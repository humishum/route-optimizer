import type { MetricRegion, Place, TrackPoint, Trial } from "./models";
import { haversineDistanceM, isPointInCircle } from "./geospatial";

const DEFAULT_STALL_SPEED_MPS = 0.8;
const DEFAULT_MIN_DELTA_DISTANCE_M = 1.5;

export type MetricsResult = {
  totalTimeSec?: number;
  distanceM?: number;
  stallTimeSec?: number;
  metricRegionTimes?: Record<string, number>;
};

type MetricsConfig = {
  stallSpeedMps?: number;
  minDeltaDistanceM?: number;
};

export function computeMetrics(
  place: Place,
  trial: Trial,
  trackpoints: TrackPoint[],
  config: MetricsConfig = {},
): MetricsResult {
  if (!trial.endedAt || trackpoints.length < 2) {
    return {};
  }

  const stallSpeedMps = config.stallSpeedMps ?? DEFAULT_STALL_SPEED_MPS;
  const minDeltaDistanceM =
    config.minDeltaDistanceM ?? DEFAULT_MIN_DELTA_DISTANCE_M;

  const points = [...trackpoints].sort((a, b) => a.t - b.t);
  let distanceM = 0;
  let stallTimeSec = 0;
  const metricRegionTimes = initMetricRegionTimes(place.metricRegions);

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dtSec = (b.t - a.t) / 1000;
    if (dtSec <= 0) {
      continue;
    }

    const segmentDistance = haversineDistanceM(a, b);
    distanceM += segmentDistance;

    const speed =
      b.speedMps ??
      a.speedMps ??
      (segmentDistance > 0 ? segmentDistance / dtSec : undefined);

    const stalled =
      speed !== undefined
        ? speed < stallSpeedMps
        : segmentDistance < minDeltaDistanceM;

    if (stalled) {
      stallTimeSec += dtSec;
      accrueMetricRegionTimes(metricRegionTimes, place.metricRegions, a, b, dtSec);
    }
  }

  return {
    totalTimeSec: (trial.endedAt - trial.startedAt) / 1000,
    distanceM,
    stallTimeSec,
    metricRegionTimes,
  };
}

function initMetricRegionTimes(
  regions: MetricRegion[],
): Record<string, number> {
  return regions.reduce<Record<string, number>>((acc, region) => {
    acc[region.id] = 0;
    return acc;
  }, {});
}

function accrueMetricRegionTimes(
  times: Record<string, number>,
  regions: MetricRegion[],
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  dtSec: number,
): void {
  if (regions.length === 0) {
    return;
  }

  const midpoint = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
  for (const region of regions) {
    const inside =
      isPointInCircle(a, region.circle) ||
      isPointInCircle(b, region.circle) ||
      isPointInCircle(midpoint, region.circle);
    if (inside) {
      times[region.id] += dtSec;
    }
  }
}
