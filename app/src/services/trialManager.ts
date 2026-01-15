import * as Location from "expo-location";
import type { GeofencingEventType } from "expo-location";
import { Platform } from "react-native";
import { TASK_LOCATION } from "../background/taskNames";
import type { Place, RegionEvent, TrackPoint, Trial } from "../domain/models";
import { computeMetrics } from "../domain/metrics";
import { inferActualRoute } from "../domain/routeInference";
import {
  findActiveTrialByPlace,
  findAnyActiveTrial,
  findLastTrialByPlace,
  getPlaceById,
  getTrialById,
  initializeDatabase,
  insertRegionEvent,
  insertTrackPoint,
  insertTrial,
  listEventsForTrial,
  listTrackpointsForTrial,
  openDatabase,
  updateTrial,
} from "../db/queries";
import { parseRegionIdentifier } from "./geofences";
import {
  configureNotificationActions,
  notifyGeofenceHit,
  notifyTrialEnd,
  notifyTrialStart,
} from "./notifications";
import { angleDiffDeg } from "../domain/geospatial";

let dbPromise: ReturnType<typeof openDatabase> | undefined;
let dbInitialized = false;

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  if (!dbInitialized) {
    await initializeDatabase(dbPromise);
    dbInitialized = true;
  }
  return dbPromise;
}

export async function handleGeofenceEvent(
  identifier: string,
  eventType: GeofencingEventType,
  timestampMs: number,
): Promise<void> {
  const parsed = parseRegionIdentifier(identifier);
  if (!parsed) {
    return;
  }

  if (eventType === Location.GeofencingEventType.Enter) {
    const place = await getPlaceById(await getDb(), parsed.placeId);
    const label = place ? `${place.name} • ${parsed.kind}` : `${parsed.placeId} • ${parsed.kind}`;
    await notifyGeofenceHit(label);
  }

  if (eventType === Location.GeofencingEventType.Enter) {
    if (parsed.kind === "start") {
      await startTrial(parsed.placeId, timestampMs);
      return;
    }
    if (parsed.kind === "end") {
      await endTrial(parsed.placeId, timestampMs);
      return;
    }
  }

  if (parsed.kind === "route" || parsed.kind === "metric") {
    await recordRegionEvent(parsed.placeId, parsed.regionId, eventType, timestampMs);
  }
}

export async function handleLocationUpdate(
  locations: Location.LocationObject[],
): Promise<void> {
  const db = await getDb();
  const activeTrial = await findAnyActiveTrial(db);
  if (!activeTrial) {
    return;
  }

  for (const location of locations) {
    const point: TrackPoint = {
      id: createId("tp"),
      trialId: activeTrial.id,
      t: location.timestamp ?? Date.now(),
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      accuracyM: location.coords.accuracy ?? undefined,
      speedMps: location.coords.speed ?? undefined,
      headingDeg: location.coords.heading ?? undefined,
    };
    await insertTrackPoint(db, point);
  }
}

export async function setIntent(trialId: string, intent: string): Promise<void> {
  const db = await getDb();
  const trial = await loadTrial(db, trialId);
  if (!trial || trial.status !== "active") {
    return;
  }
  trial.intent = intent;
  await updateTrial(db, trial);
}

export async function setIntentForActiveTrial(intent: string): Promise<void> {
  const db = await getDb();
  const trial = await findAnyActiveTrial(db);
  if (!trial || trial.status !== "active") {
    return;
  }
  trial.intent = intent;
  await updateTrial(db, trial);
}

async function startTrial(placeId: string, timestampMs: number): Promise<void> {
  const db = await getDb();
  const place = await getPlaceById(db, placeId);
  if (!place) {
    return;
  }

  const existing = await findAnyActiveTrial(db);
  if (existing) {
    return;
  }

  const lastTrial = await findLastTrialByPlace(db, placeId);
  if (lastTrial && timestampMs - lastTrial.startedAt < place.triggerRules.minSecondsBetweenTrials * 1000) {
    return;
  }

  const lastLocation = await Location.getLastKnownPositionAsync();
  if (place.triggerRules.minSpeedMps && lastLocation?.coords?.speed !== null) {
    const speed = lastLocation?.coords?.speed ?? 0;
    if (speed < place.triggerRules.minSpeedMps) {
      return;
    }
  }
  if (
    place.triggerRules.requireHeadingWithinDeg &&
    place.triggerRules.expectedHeadingDeg !== undefined &&
    lastLocation?.coords?.heading !== null
  ) {
    const heading = lastLocation?.coords?.heading ?? 0;
    const diff = angleDiffDeg(heading, place.triggerRules.expectedHeadingDeg);
    if (diff > place.triggerRules.requireHeadingWithinDeg) {
      return;
    }
  }

  const trial: Trial = {
    id: createId("trial"),
    placeId,
    startedAt: timestampMs,
    status: "active",
    deviceInfo: {
      platform: "ios",
      model: Platform.constants?.Model ?? undefined,
      osVersion: Platform.Version ? String(Platform.Version) : undefined,
    },
  };

  await insertTrial(db, trial);

  try {
    await Location.startLocationUpdatesAsync(TASK_LOCATION, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 5,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: false,
    });
  } catch (error) {
    console.warn("Location updates unavailable:", error);
  }

  await configureNotificationActions(place.routeDefs.map((route) => route.id));
  await notifyTrialStart(place.name);
}

async function endTrial(placeId: string, timestampMs: number): Promise<void> {
  const db = await getDb();
  const trial = await findActiveTrialByPlace(db, placeId);
  if (!trial) {
    return;
  }
  const place = await getPlaceById(db, placeId);
  if (!place) {
    return;
  }

  trial.endedAt = timestampMs;

  try {
    await Location.stopLocationUpdatesAsync(TASK_LOCATION);
  } catch (error) {
    console.warn("Stop location updates failed:", error);
  }

  const events = await listEventsForTrial(db, trial.id);
  const trackpoints = await listTrackpointsForTrial(db, trial.id);

  const metrics = computeMetrics(place, trial, trackpoints);
  const inference = inferActualRoute(place, events, trackpoints);

  trial.totalTimeSec = metrics.totalTimeSec;
  trial.distanceM = metrics.distanceM;
  trial.stallTimeSec = metrics.stallTimeSec;
  trial.metricRegionTimes = metrics.metricRegionTimes;
  trial.actual = inference.actual;
  trial.confidence = inference.confidence;
  trial.status = "complete";
  trial.trackpointCount = trackpoints.length;
  trial.eventCount = events.length;

  await updateTrial(db, trial);

  await notifyTrialEnd(
    place.name,
    `Actual: ${trial.actual ?? "unknown"} • ${trial.totalTimeSec?.toFixed(1) ?? "?"}s`,
  );
}

async function recordRegionEvent(
  placeId: string,
  regionId: string,
  eventType: GeofencingEventType,
  timestampMs: number,
): Promise<void> {
  const db = await getDb();
  const trial = await findActiveTrialByPlace(db, placeId);
  if (!trial) {
    return;
  }
  const event: RegionEvent = {
    id: createId("evt"),
    trialId: trial.id,
    t: timestampMs,
    regionId,
    event: eventType === Location.GeofencingEventType.Enter ? "enter" : "exit",
  };
  await insertRegionEvent(db, event);
}

async function loadTrial(db: ReturnType<typeof openDatabase>, trialId: string): Promise<Trial | undefined> {
  const trial = await getTrialById(db, trialId);
  return trial ?? undefined;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
