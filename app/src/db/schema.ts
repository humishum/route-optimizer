export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  intent TEXT,
  actual TEXT,
  confidence REAL,
  status TEXT NOT NULL,
  total_time_sec REAL,
  distance_m REAL,
  stall_time_sec REAL,
  metric_region_times_json TEXT,
  device_info_json TEXT,
  trackpoint_count INTEGER,
  event_count INTEGER,
  FOREIGN KEY(place_id) REFERENCES places(id)
);

CREATE TABLE IF NOT EXISTS region_events (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  t INTEGER NOT NULL,
  region_id TEXT NOT NULL,
  event TEXT NOT NULL,
  FOREIGN KEY(trial_id) REFERENCES trials(id)
);

CREATE INDEX IF NOT EXISTS idx_region_events_trial ON region_events(trial_id);
CREATE INDEX IF NOT EXISTS idx_region_events_t ON region_events(t);

CREATE TABLE IF NOT EXISTS trackpoints (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  t INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  accuracy_m REAL,
  speed_mps REAL,
  heading_deg REAL,
  FOREIGN KEY(trial_id) REFERENCES trials(id)
);

CREATE INDEX IF NOT EXISTS idx_trackpoints_trial ON trackpoints(trial_id);
CREATE INDEX IF NOT EXISTS idx_trackpoints_t ON trackpoints(t);
`;
