import type {
  CorridorDef,
  Place,
  RegionEvent,
  RouteDef,
  RouteEvidence,
  TrackPoint,
} from "./models";
import { averageDistanceToPolylineM } from "./geospatial";

const DEFAULT_MIN_SCORE = 1;
const DEFAULT_ALPHA = 0.7;

export type RouteInferenceResult = {
  actual?: string;
  confidence?: number;
  scores: Record<string, number>;
};

export function inferActualRoute(
  place: Place,
  events: RegionEvent[],
  trackpoints: TrackPoint[],
): RouteInferenceResult {
  const normalizedEvents = events.filter((e) => e.event === "enter");
  const scores: Record<string, number> = {};

  for (const route of place.routeDefs) {
    scores[route.id] = scoreRoute(route, normalizedEvents);
  }

  if (place.corridors && place.corridors.length > 0) {
    const corridorScores = scoreCorridors(place.corridors, trackpoints);
    for (const route of place.routeDefs) {
      const existing = scores[route.id] ?? 0;
      const corridorScore = corridorScores[route.id] ?? 0;
      scores[route.id] = DEFAULT_ALPHA * existing + (1 - DEFAULT_ALPHA) * corridorScore;
    }
  }

  const { bestId, bestScore, secondScore } = selectBest(scores);
  if (!bestId || bestScore < DEFAULT_MIN_SCORE) {
    return { scores };
  }

  const confidence = computeConfidence(bestScore, secondScore);
  return { actual: bestId, confidence, scores };
}

function scoreRoute(route: RouteDef, events: RegionEvent[]): number {
  let score = 0;
  for (const evidence of route.evidence) {
    score += scoreEvidence(evidence, events);
  }
  return score;
}

function scoreEvidence(evidence: RouteEvidence, events: RegionEvent[]): number {
  switch (evidence.type) {
    case "region_enter":
      return hasRegionEnter(events, evidence.regionId) ? evidence.weight : 0;
    case "negative_region":
      return hasRegionEnter(events, evidence.regionId) ? -evidence.weight : 0;
    case "region_sequence":
      return sequenceSatisfied(events, evidence.regionIds, evidence.maxGapSec)
        ? evidence.weight
        : 0;
    case "corridor_match":
      return 0;
    default:
      return 0;
  }
}

function hasRegionEnter(events: RegionEvent[], regionId: string): boolean {
  return events.some((event) => event.regionId === regionId);
}

function sequenceSatisfied(
  events: RegionEvent[],
  regionIds: string[],
  maxGapSec?: number,
): boolean {
  if (regionIds.length === 0) {
    return false;
  }

  const byRegion: Record<string, number[]> = {};
  for (const event of events) {
    if (!byRegion[event.regionId]) {
      byRegion[event.regionId] = [];
    }
    byRegion[event.regionId].push(event.t);
  }

  let lastTime: number | undefined;
  for (const regionId of regionIds) {
    const hits = byRegion[regionId];
    if (!hits || hits.length === 0) {
      return false;
    }
    const nextTime = hits.find((t) => (lastTime ? t >= lastTime : true));
    if (nextTime === undefined) {
      return false;
    }
    if (lastTime && maxGapSec !== undefined) {
      const gapSec = (nextTime - lastTime) / 1000;
      if (gapSec > maxGapSec) {
        return false;
      }
    }
    lastTime = nextTime;
  }

  return true;
}

function scoreCorridors(
  corridors: CorridorDef[],
  trackpoints: TrackPoint[],
): Record<string, number> {
  const points = trackpoints.map((point) => ({ lat: point.lat, lon: point.lon }));
  const scores: Record<string, number> = {};

  for (const corridor of corridors) {
    const avgDist = averageDistanceToPolylineM(points, corridor.polyline);
    if (avgDist === undefined) {
      continue;
    }
    if (avgDist <= corridor.maxMatchAvgDistM) {
      scores[corridor.routeId] =
        (scores[corridor.routeId] ?? 0) + (corridor.maxMatchAvgDistM - avgDist);
    }
  }

  return scores;
}

function selectBest(scores: Record<string, number>): {
  bestId?: string;
  bestScore: number;
  secondScore: number;
} {
  let bestId: string | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondScore = Number.NEGATIVE_INFINITY;

  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestId = id;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  return { bestId, bestScore, secondScore };
}

function computeConfidence(best: number, second: number): number {
  const denominator = Math.max(1, Math.abs(best));
  const margin = (best - second) / denominator;
  return Math.max(0, Math.min(1, margin));
}
