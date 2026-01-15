import * as Location from "expo-location";
import type { GeoCircle, Place } from "../domain/models";
import { TASK_GEOFENCE } from "../background/taskNames";

export type GeofenceRegion = Location.LocationRegion;

export type ParsedRegion = {
  placeId: string;
  kind: "start" | "end" | "route" | "metric";
  regionId: string;
};

export function buildGeofenceRegions(places: Place[], maxRegions = 20): GeofenceRegion[] {
  const regions: GeofenceRegion[] = [];
  for (const place of places) {
    if (!place.isActive) {
      continue;
    }
    pushRegion(regions, place.id, "start", place.startRegion);
    pushRegion(regions, place.id, "end", place.endRegion);
    for (const route of place.routeDefs) {
      for (const evidence of route.evidence) {
        if (evidence.type === "region_enter" || evidence.type === "negative_region") {
          const region = findRegion(place, evidence.regionId);
          if (region) {
            pushRegion(regions, place.id, "route", region);
          }
        }
      }
    }
    for (const metric of place.metricRegions) {
      pushRegion(regions, place.id, "metric", metric.circle);
    }
    if (regions.length >= maxRegions) {
      break;
    }
  }
  return regions.slice(0, maxRegions);
}

export async function registerGeofences(regions: GeofenceRegion[]): Promise<void> {
  await Location.startGeofencingAsync(TASK_GEOFENCE, regions);
}

export function parseRegionIdentifier(identifier: string): ParsedRegion | undefined {
  const [placeId, kind, regionId] = identifier.split("|");
  if (!placeId || !kind || !regionId) {
    return undefined;
  }
  if (kind !== "start" && kind !== "end" && kind !== "route" && kind !== "metric") {
    return undefined;
  }
  return { placeId, kind, regionId };
}

function pushRegion(
  regions: GeofenceRegion[],
  placeId: string,
  kind: ParsedRegion["kind"],
  circle: GeoCircle,
): void {
  regions.push({
    identifier: `${placeId}|${kind}|${circle.id}`,
    latitude: circle.lat,
    longitude: circle.lon,
    radius: circle.radiusM,
    notifyOnEnter: true,
    notifyOnExit: true,
  });
}

function findRegion(place: Place, regionId: string): GeoCircle | undefined {
  if (place.startRegion.id === regionId) {
    return place.startRegion;
  }
  if (place.endRegion.id === regionId) {
    return place.endRegion;
  }
  if (place.routeRegions) {
    const routeRegion = place.routeRegions.find((region) => region.id === regionId);
    if (routeRegion) {
      return routeRegion;
    }
  }
  for (const metric of place.metricRegions) {
    if (metric.circle.id === regionId) {
      return metric.circle;
    }
  }
  return undefined;
}
