import type { Place, RegionEvent, TrackPoint, Trial } from "./models";

export type ExportBundle = {
  places: Place[];
  trials: Trial[];
  events: RegionEvent[];
  trackpoints: TrackPoint[];
  exportedAtIso: string;
  appVersion: string;
};

export function buildPlacesPayload(
  places: Place[],
  exportedAtIso: string,
  appVersion: string,
): Record<string, unknown> {
  return {
    exported_at: exportedAtIso,
    app_version: appVersion,
    places,
  };
}

export function trialsToCsv(trials: Trial[], placeById: Record<string, Place>): string {
  const headers = [
    "trial_id",
    "place_id",
    "place_name",
    "started_at_iso",
    "ended_at_iso",
    "intent",
    "actual",
    "confidence",
    "total_time_sec",
    "distance_m",
    "stall_time_sec",
    "metric_region_times_json",
    "status",
    "device_info_json",
  ];
  const rows = trials.map((trial) => {
    const place = placeById[trial.placeId];
    return [
      trial.id,
      trial.placeId,
      place?.name ?? "",
      isoOrEmpty(trial.startedAt),
      isoOrEmpty(trial.endedAt),
      trial.intent ?? "",
      trial.actual ?? "",
      trial.confidence ?? "",
      trial.totalTimeSec ?? "",
      trial.distanceM ?? "",
      trial.stallTimeSec ?? "",
      trial.metricRegionTimes ? JSON.stringify(trial.metricRegionTimes) : "",
      trial.status,
      JSON.stringify(trial.deviceInfo),
    ];
  });
  return toCsv(headers, rows);
}

export function eventsToCsv(events: RegionEvent[]): string {
  const headers = ["event_id", "trial_id", "t_iso", "region_id", "event"];
  const rows = events.map((event) => [
    event.id,
    event.trialId,
    isoOrEmpty(event.t),
    event.regionId,
    event.event,
  ]);
  return toCsv(headers, rows);
}

export function trackpointsToCsv(trackpoints: TrackPoint[]): string {
  const headers = [
    "point_id",
    "trial_id",
    "t_iso",
    "lat",
    "lon",
    "accuracy_m",
    "speed_mps",
    "heading_deg",
  ];
  const rows = trackpoints.map((point) => [
    point.id,
    point.trialId,
    isoOrEmpty(point.t),
    point.lat,
    point.lon,
    point.accuracyM ?? "",
    point.speedMps ?? "",
    point.headingDeg ?? "",
  ]);
  return toCsv(headers, rows);
}

function isoOrEmpty(epochMs?: number): string {
  if (!epochMs) {
    return "";
  }
  return new Date(epochMs).toISOString();
}

function toCsv(headers: (string | number)[], rows: (string | number)[][]): string {
  const escaped = (value: string | number) => {
    const asString = String(value ?? "");
    if (asString.includes(",") || asString.includes("\n") || asString.includes("\"")) {
      return `"${asString.replace(/"/g, "\"\"")}"`;
    }
    return asString;
  };
  return [headers.map(escaped).join(","), ...rows.map((row) => row.map(escaped).join(","))].join(
    "\n",
  );
}
