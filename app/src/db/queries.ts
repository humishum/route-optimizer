import * as SQLite from "expo-sqlite";
import type { Place, RegionEvent, TrackPoint, Trial } from "../domain/models";
import { CREATE_TABLES_SQL } from "./schema";

const DB_NAME = "commute.db";

export function openDatabase(): SQLite.SQLiteDatabase {
  return SQLite.openDatabase(DB_NAME);
}

export async function initializeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await executeSqlAsync(db, CREATE_TABLES_SQL);
}

export async function upsertPlace(db: SQLite.SQLiteDatabase, place: Place): Promise<void> {
  const payload = JSON.stringify(place);
  await executeSqlAsync(
    db,
    `INSERT INTO places (id, name, is_active, json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       is_active=excluded.is_active,
       json=excluded.json,
       updated_at=excluded.updated_at`,
    [place.id, place.name, place.isActive ? 1 : 0, payload, place.updatedAt],
  );
}

export async function listPlaces(db: SQLite.SQLiteDatabase): Promise<Place[]> {
  const result = await executeSqlAsync(db, "SELECT json FROM places ORDER BY name ASC");
  return result.rows._array.map((row) => JSON.parse(row.json));
}

export async function getPlaceById(
  db: SQLite.SQLiteDatabase,
  placeId: string,
): Promise<Place | undefined> {
  const result = await executeSqlAsync(db, "SELECT json FROM places WHERE id = ? LIMIT 1", [
    placeId,
  ]);
  if (result.rows.length === 0) {
    return undefined;
  }
  return JSON.parse(result.rows.item(0).json);
}

export async function insertTrial(db: SQLite.SQLiteDatabase, trial: Trial): Promise<void> {
  await executeSqlAsync(
    db,
    `INSERT INTO trials (
       id, place_id, started_at, ended_at, intent, actual, confidence, status,
       total_time_sec, distance_m, stall_time_sec, metric_region_times_json,
       device_info_json, trackpoint_count, event_count
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trial.id,
      trial.placeId,
      trial.startedAt,
      trial.endedAt ?? null,
      trial.intent ?? null,
      trial.actual ?? null,
      trial.confidence ?? null,
      trial.status,
      trial.totalTimeSec ?? null,
      trial.distanceM ?? null,
      trial.stallTimeSec ?? null,
      trial.metricRegionTimes ? JSON.stringify(trial.metricRegionTimes) : null,
      JSON.stringify(trial.deviceInfo),
      trial.trackpointCount ?? null,
      trial.eventCount ?? null,
    ],
  );
}

export async function updateTrial(db: SQLite.SQLiteDatabase, trial: Trial): Promise<void> {
  await executeSqlAsync(
    db,
    `UPDATE trials SET
       ended_at = ?,
       intent = ?,
       actual = ?,
       confidence = ?,
       status = ?,
       total_time_sec = ?,
       distance_m = ?,
       stall_time_sec = ?,
       metric_region_times_json = ?,
       device_info_json = ?,
       trackpoint_count = ?,
       event_count = ?
     WHERE id = ?`,
    [
      trial.endedAt ?? null,
      trial.intent ?? null,
      trial.actual ?? null,
      trial.confidence ?? null,
      trial.status,
      trial.totalTimeSec ?? null,
      trial.distanceM ?? null,
      trial.stallTimeSec ?? null,
      trial.metricRegionTimes ? JSON.stringify(trial.metricRegionTimes) : null,
      JSON.stringify(trial.deviceInfo),
      trial.trackpointCount ?? null,
      trial.eventCount ?? null,
      trial.id,
    ],
  );
}

export async function findActiveTrialByPlace(
  db: SQLite.SQLiteDatabase,
  placeId: string,
): Promise<Trial | undefined> {
  const result = await executeSqlAsync(
    db,
    "SELECT * FROM trials WHERE place_id = ? AND status = 'active' LIMIT 1",
    [placeId],
  );
  if (result.rows.length === 0) {
    return undefined;
  }
  return mapTrialRow(result.rows.item(0));
}

export async function findLastTrialByPlace(
  db: SQLite.SQLiteDatabase,
  placeId: string,
): Promise<Trial | undefined> {
  const result = await executeSqlAsync(
    db,
    "SELECT * FROM trials WHERE place_id = ? ORDER BY started_at DESC LIMIT 1",
    [placeId],
  );
  if (result.rows.length === 0) {
    return undefined;
  }
  return mapTrialRow(result.rows.item(0));
}

export async function getTrialById(
  db: SQLite.SQLiteDatabase,
  trialId: string,
): Promise<Trial | undefined> {
  const result = await executeSqlAsync(db, "SELECT * FROM trials WHERE id = ? LIMIT 1", [
    trialId,
  ]);
  if (result.rows.length === 0) {
    return undefined;
  }
  return mapTrialRow(result.rows.item(0));
}

export async function findAnyActiveTrial(
  db: SQLite.SQLiteDatabase,
): Promise<Trial | undefined> {
  const result = await executeSqlAsync(
    db,
    "SELECT * FROM trials WHERE status = 'active' ORDER BY started_at DESC LIMIT 1",
  );
  if (result.rows.length === 0) {
    return undefined;
  }
  return mapTrialRow(result.rows.item(0));
}

export async function insertRegionEvent(
  db: SQLite.SQLiteDatabase,
  event: RegionEvent,
): Promise<void> {
  await executeSqlAsync(
    db,
    `INSERT INTO region_events (id, trial_id, t, region_id, event)
     VALUES (?, ?, ?, ?, ?)`,
    [event.id, event.trialId, event.t, event.regionId, event.event],
  );
}

export async function insertTrackPoint(
  db: SQLite.SQLiteDatabase,
  point: TrackPoint,
): Promise<void> {
  await executeSqlAsync(
    db,
    `INSERT INTO trackpoints (id, trial_id, t, lat, lon, accuracy_m, speed_mps, heading_deg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      point.id,
      point.trialId,
      point.t,
      point.lat,
      point.lon,
      point.accuracyM ?? null,
      point.speedMps ?? null,
      point.headingDeg ?? null,
    ],
  );
}

export async function listEventsForTrial(
  db: SQLite.SQLiteDatabase,
  trialId: string,
): Promise<RegionEvent[]> {
  const result = await executeSqlAsync(
    db,
    "SELECT * FROM region_events WHERE trial_id = ? ORDER BY t ASC",
    [trialId],
  );
  return result.rows._array.map(mapEventRow);
}

export async function listTrackpointsForTrial(
  db: SQLite.SQLiteDatabase,
  trialId: string,
): Promise<TrackPoint[]> {
  const result = await executeSqlAsync(
    db,
    "SELECT * FROM trackpoints WHERE trial_id = ? ORDER BY t ASC",
    [trialId],
  );
  return result.rows._array.map(mapTrackPointRow);
}

function executeSqlAsync(
  db: SQLite.SQLiteDatabase,
  sql: string,
  params: SQLite.SQLStatementArg[] = [],
): Promise<SQLite.SQLResultSet> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          reject(error);
          return false;
        },
      );
    });
  });
}

function mapTrialRow(row: SQLite.SQLResultSetRowList["_array"][number]): Trial {
  return {
    id: row.id,
    placeId: row.place_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    intent: row.intent ?? undefined,
    actual: row.actual ?? undefined,
    confidence: row.confidence ?? undefined,
    status: row.status,
    totalTimeSec: row.total_time_sec ?? undefined,
    distanceM: row.distance_m ?? undefined,
    stallTimeSec: row.stall_time_sec ?? undefined,
    metricRegionTimes: row.metric_region_times_json
      ? JSON.parse(row.metric_region_times_json)
      : undefined,
    deviceInfo: row.device_info_json ? JSON.parse(row.device_info_json) : {},
    trackpointCount: row.trackpoint_count ?? undefined,
    eventCount: row.event_count ?? undefined,
  };
}

function mapEventRow(row: SQLite.SQLResultSetRowList["_array"][number]): RegionEvent {
  return {
    id: row.id,
    trialId: row.trial_id,
    t: row.t,
    regionId: row.region_id,
    event: row.event,
  };
}

function mapTrackPointRow(
  row: SQLite.SQLResultSetRowList["_array"][number],
): TrackPoint {
  return {
    id: row.id,
    trialId: row.trial_id,
    t: row.t,
    lat: row.lat,
    lon: row.lon,
    accuracyM: row.accuracy_m ?? undefined,
    speedMps: row.speed_mps ?? undefined,
    headingDeg: row.heading_deg ?? undefined,
  };
}
