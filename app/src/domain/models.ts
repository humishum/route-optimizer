export type GeoCircle = {
  id: string;
  lat: number;
  lon: number;
  radiusM: number;
};

export type TriggerRules = {
  minSecondsBetweenTrials: number;
  requireHeadingWithinDeg?: number;
  expectedHeadingDeg?: number;
  minSpeedMps?: number;
};

export type RouteId = string;

export type RouteEvidence =
  | { type: "region_enter"; regionId: string; weight: number }
  | {
      type: "region_sequence";
      regionIds: string[];
      weight: number;
      maxGapSec?: number;
    }
  | {
      type: "corridor_match";
      corridorId: string;
      weight: number;
      maxAvgDistM?: number;
    }
  | { type: "negative_region"; regionId: string; weight: number };

export type IntentRules = {
  successIfActualIn: RouteId[];
  failureLabel?: string;
};

export type RouteDef = {
  id: RouteId;
  label: string;
  description: string;
  evidence: RouteEvidence[];
  intentRules?: IntentRules;
};

export type MetricRegion = {
  id: string;
  label: string;
  circle: GeoCircle;
  stallSpeedMps: number;
};

export type CorridorDef = {
  id: string;
  label: string;
  routeId: RouteId;
  polyline: { lat: number; lon: number }[];
  maxMatchAvgDistM: number;
};

export type Place = {
  id: string;
  name: string;
  timezone: string;
  startRegion: GeoCircle;
  endRegion: GeoCircle;
  triggerRules: TriggerRules;
  routeRegions?: GeoCircle[];
  routeDefs: RouteDef[];
  metricRegions: MetricRegion[];
  corridors?: CorridorDef[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
};

export type TrialStatus = "active" | "complete" | "discarded";

export type Trial = {
  id: string;
  placeId: string;
  startedAt: number;
  endedAt?: number;
  intent?: RouteId;
  actual?: RouteId;
  confidence?: number;
  totalTimeSec?: number;
  distanceM?: number;
  stallTimeSec?: number;
  metricRegionTimes?: Record<string, number>;
  status: TrialStatus;
  deviceInfo: {
    platform: "ios";
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
  trackpointCount?: number;
  eventCount?: number;
};

export type RegionEvent = {
  id: string;
  trialId: string;
  t: number;
  regionId: string;
  event: "enter" | "exit";
};

export type TrackPoint = {
  id: string;
  trialId: string;
  t: number;
  lat: number;
  lon: number;
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
};
