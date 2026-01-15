# Commute Experiment App (React Native / Expo)

A *very detailed* software architecture + implementation spec for an iPhone app that automatically starts/stops “trials” when you enter/exit geofenced areas, records **intent vs actual route**, captures trackpoints/events, computes metrics, and exports everything for post-analysis (Python).

---

## 0. Problem Statement

You repeatedly drive to a destination where there are multiple plausible micro-routes (e.g., attempt a risky left turn right after an off-ramp vs a safer right-turn + u-turn). You want to determine which strategy is **time-optimal** (and optionally, risk-adjusted) across different traffic conditions.

The app must:

- Work across **multiple places** (different offices/complexes).
- **Automatically trigger** a data collection trial when approaching a place.
- Collect:
  - user **intent** (selected quickly)
  - actual route taken (inferred)
  - precise timing, track, and derived metrics (stop time, delays)
- Export data in well-defined formats for Python analysis.

---

## 1. High-Level Approach

A “place” defines:

- A **Start Zone** (geofence) → entering it automatically starts a trial.
- An **End Zone** (geofence) → entering it ends the trial.
- **Route classifiers** (geofences and/or corridor polylines) → used to infer which route actually happened.
- Optional **segment markers** (e.g., “left turn wait region”) → for metric decomposition.

Each trial captures:

- Metadata: timestamp, place, device, app version
- Intent: A/B/C/… chosen via notification buttons or in-app
- Events: enter/exit geofence events with timestamps
- Trackpoints: GPS samples during trial with speed/heading
- Derived metrics: total time, distance, stall time, turn-wait time, etc.

---

## 2. Constraints & Design Implications (iOS)

- iOS geofencing has region limits (often \~20 regions monitored at once).
  - **Design:** only monitor *active* places near you; keep regions minimal.
- Background execution for continuous tracking is restricted.
  - **Design:** geofencing always-on; high-rate GPS only during active trial.
- GPS noise near interchanges can cause misclassification.
  - **Design:** use:
    - “region hit with hysteresis”
    - optional corridor matching (polyline distance)
    - confidence scoring

---

## 3. Data Model

### 3.1 Place

A place describes an experiment site.

```ts
type Place = {
  id: string;                 // UUID
  name: string;               // "Office - Main Complex"
  timezone: string;           // e.g. "America/Los_Angeles"

  // Start/end define trial boundaries
  startRegion: GeoCircle;
  endRegion: GeoCircle;

  // Optional: ignore triggers when moving away, etc.
  triggerRules: TriggerRules;

  // Route inference
  routeDefs: RouteDef[];

  // Additional regions used for decomposition of time (waiting at turn etc.)
  metricRegions: MetricRegion[];

  // For corridor matching (optional)
  corridors?: CorridorDef[];

  // Metadata
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
};

type GeoCircle = {
  id: string;
  lat: number;
  lon: number;
  radiusM: number;
};

type TriggerRules = {
  // throttle to avoid repeated starts
  minSecondsBetweenTrials: number;  // e.g. 20*60
  // optional directionality check
  requireHeadingWithinDeg?: number; // e.g. 60
  expectedHeadingDeg?: number;      // e.g. 145
  // require speed threshold to avoid false starts in parking lots
  minSpeedMps?: number;             // e.g. 3.0
};
```

### 3.2 Route Definitions

Routes are strategies: A, B, C, etc. Each route can be inferred by *evidence*.

```ts
type RouteId = string; // "A" | "B" | "C" etc.

type RouteDef = {
  id: RouteId;
  label: string;
  description: string;

  // Evidence sources
  evidence: RouteEvidence[];

  // If intent is this route, but actual differs, mark as "miss" etc.
  intentRules?: IntentRules;
};

type RouteEvidence =
  | { type: "region_enter"; regionId: string; weight: number }
  | { type: "region_sequence"; regionIds: string[]; weight: number; maxGapSec?: number }
  | { type: "corridor_match"; corridorId: string; weight: number; maxAvgDistM?: number }
  | { type: "negative_region"; regionId: string; weight: number };

// Optional logic for intent->success
// Example: intent A is successful only if actual A

type IntentRules = {
  successIfActualIn: RouteId[];
  failureLabel?: string;  // e.g. "missed_left_turn"
};
```

### 3.3 Metric Regions

These help compute “waiting at left turn”, “delay at u-turn”, etc.

```ts
type MetricRegion = {
  id: string;
  label: string;              // "Left Turn Waiting"
  circle: GeoCircle;
  stallSpeedMps: number;      // e.g. 0.8
};
```

### 3.4 Corridors (Optional)

If geofences alone are ambiguous, corridors define a polyline path.

```ts
type CorridorDef = {
  id: string;
  label: string;
  routeId: RouteId;
  polyline: { lat: number; lon: number }[];
  maxMatchAvgDistM: number;   // e.g. 15m
};
```

### 3.5 Trial

```ts
type Trial = {
  id: string;
  placeId: string;

  // boundary timestamps
  startedAt: number;
  endedAt?: number;

  // intent can be set after start (notification action)
  intent?: RouteId;

  // computed at end
  actual?: RouteId;
  confidence?: number; // 0..1

  // derived metrics
  totalTimeSec?: number;
  distanceM?: number;
  stallTimeSec?: number;
  metricRegionTimes?: Record<string, number>; // metricRegionId -> seconds

  // bookkeeping
  status: "active" | "complete" | "discarded";

  // context
  deviceInfo: {
    platform: "ios";
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };

  // export pointers
  trackpointCount?: number;
  eventCount?: number;
};
```

### 3.6 Events & Trackpoints

```ts
type RegionEvent = {
  id: string;
  trialId: string;
  t: number;
  regionId: string;
  event: "enter" | "exit";
};

type TrackPoint = {
  id: string;
  trialId: string;
  t: number;
  lat: number;
  lon: number;
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
};
```

---

## 4. Storage Architecture

Use SQLite with normalized tables.

### 4.1 Tables

- `places` (json blob + indexed columns)
- `routes` (optional separate; can live in place json)
- `trials`
- `region_events`
- `trackpoints`
- `metric_cache` (optional computed metrics)

### 4.2 Suggested schema (SQLite)

```sql
CREATE TABLE places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE trials (
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

CREATE TABLE region_events (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  t INTEGER NOT NULL,
  region_id TEXT NOT NULL,
  event TEXT NOT NULL,
  FOREIGN KEY(trial_id) REFERENCES trials(id)
);

CREATE INDEX idx_region_events_trial ON region_events(trial_id);
CREATE INDEX idx_region_events_t ON region_events(t);

CREATE TABLE trackpoints (
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

CREATE INDEX idx_trackpoints_trial ON trackpoints(trial_id);
CREATE INDEX idx_trackpoints_t ON trackpoints(t);
```

---

## 5. Background Tasks

### 5.1 Expo Task Manager tasks

- `TASK_GEOFENCE`: handles enter/exit for monitored regions
- `TASK_LOCATION`: streams location updates during active trial

### 5.2 Permissions

- iOS:
  - Location: **Always** (required for geofence triggers)
  - Motion & Fitness (optional) can improve activity detection
  - Notifications: required for intent actions

### 5.3 Task responsibilities

**TASK\_GEOFENCE**

- Determine which place/region triggered.
- If startRegion entered → attempt to start a trial.
- If endRegion entered → end active trial.
- For any route/metric region enter/exit → record event.

**TASK\_LOCATION**

- On each location update during active trial:
  - Insert trackpoint
  - Optionally compute incremental distance/stall time (or do at end)

---

## 6. Trial Lifecycle & Algorithms

### 6.1 Starting a Trial (Geofence enter)

**Inputs:** triggering regionId, timestamp, last known location/heading/speed.

**Algorithm:**

1. Identify the place whose `startRegion.id == regionId`.
2. Check trigger throttling:
   - Query last trial for this place.
   - If `now - lastTrial.startedAt < minSecondsBetweenTrials` → ignore.
3. Optional heading constraint:
   - If `requireHeadingWithinDeg` and `abs(angleDiff(heading, expectedHeading)) > threshold` → ignore.
4. Optional min speed constraint:
   - If speed < minSpeed → ignore.
5. Create trial:
   - Insert `trials` row with status="active", startedAt=now.
6. Start location tracking:
   - `Location.startLocationUpdatesAsync(TASK_LOCATION, config)`
7. Fire notification:
   - "Trial started for PLACE. Choose intent: A/B/C"
   - Provide notification action buttons.

**Location updates config (suggested):**

- accuracy: `Location.Accuracy.Highest` or `BestForNavigation`
- timeInterval: 1000–2000 ms
- distanceInterval: 5–10 m
- activityType: `AutomotiveNavigation`

(You may tune for battery.)

### 6.2 Intent Capture

Intent should be set in the easiest possible way.

**Mechanisms:**

- Notification action buttons: A/B/C
- In-app quick intent panel (fallback)

**Algorithm:**

- On action, update active trial `intent` field.

### 6.3 Recording Events

For any geofence enter/exit (start/end/route/metric):

- Insert `region_events` row.

### 6.4 Ending a Trial (End geofence enter)

**Algorithm:**

1. Find active trial for the place.
2. Set `endedAt`.
3. Stop location updates.
4. Load all events + trackpoints for that trial.
5. Compute derived metrics:
   - total time
   - distance
   - stall time
   - time in metric regions while stalled
6. Infer actual route & confidence.
7. Update trial row status="complete" with computed fields.
8. Notification summary: totalTime, inferred actual.

### 6.5 Derived Metrics Computation

#### 6.5.1 Total time

```ts
totalTimeSec = (endedAt - startedAt) / 1000
```

#### 6.5.2 Distance

Compute using Haversine between consecutive trackpoints.

```ts
distanceM = sum_i haversine(p[i], p[i+1])
```

#### 6.5.3 Stall time

Define stall if speed < `stallSpeedMpsGlobal` (e.g. 0.8 m/s) OR if speed missing and delta distance < small threshold.

```ts
stallTimeSec = sum over segments dt where speed < threshold
```

#### 6.5.4 Time stalled inside metric regions

We need to know when trackpoints are inside a region.

Algorithm:

For each track segment [i→i+1]:

1. Determine stall for that segment.
2. If stalled, for each metric region:
   - check if mid-point is inside circle (cheap) OR if either endpoint inside
   - if inside → add dt to that region’s counter

Output: `metricRegionTimes[metricRegionId] = seconds`

---

## 7. Route Inference Algorithms

We provide two approaches: (A) evidence scoring from region events; (B) optional corridor matching.

### 7.1 Evidence Scoring (Primary)

For each routeDef, compute a score from evidence rules.

#### Evidence types

1. `region_enter`

- if trial has any enter event for regionId → add weight

2. `region_sequence`

- require events in order within max gap

3. `negative_region`

- if entered region, subtract weight (or disqualify)

#### Score algorithm

```ts
function scoreRoute(trialEvents, routeDef): number {
  let score = 0
  for (e of routeDef.evidence) {
    switch (e.type) {
      case "region_enter":
        if (entered(e.regionId)) score += e.weight
        break
      case "negative_region":
        if (entered(e.regionId)) score -= e.weight
        break
      case "region_sequence":
        if (sequenceSatisfied(e.regionIds, e.maxGapSec)) score += e.weight
        break
      case "corridor_match":
        // handled later if enabled
        break
    }
  }
  return score
}
```

Select the route with max score.

### 7.2 Confidence

Confidence can be a normalized margin:

```ts
best = max(scores)
second = secondMax(scores)
confidence = clamp((best - second) / max(1, abs(best)), 0, 1)
```

Also clamp to 0 if best is below a minimum threshold.

### 7.3 Corridor Matching (Optional)

Corridor matching reduces ambiguity when geofences overlap or are noisy.

Algorithm:

- For each corridor polyline:
  - compute average perpendicular distance from each trackpoint to the corridor
  - if avgDist <= corridor.maxMatchAvgDistM → treat as matched, add weight

Efficient point-to-polyline distance approximation is fine (segment distance).

If corridor and region scoring disagree, combine:

```ts
finalScore = alpha*regionScore + (1-alpha)*corridorScore
```

alpha default 0.7.

---

## 8. Monitoring Multiple Places Under Region Limits

### 8.1 Active Places

Only monitor geofences for a subset of places.

Policy:

- User toggles places active.
- Additionally, runtime selects *nearby* active places.

### 8.2 Nearby selection

Maintain last known location periodically (foreground or by location task if permitted).

Algorithm:

- Compute distance to each active place start region center.
- Select N closest (e.g. N=3).
- For selected places, register:
  - startRegion
  - endRegion
  - route evidence regions (minimal)
  - metric regions (optional)

Keep total under cap (\~20).

Re-register geofences when selection changes.

---

## 9. UI/UX Spec (Minimal distraction)

### Screens

1. **Places List**

- list of places
- toggle active
- button: add new place

2. **Place Editor (Map)**

- map
- add/edit:
  - start region
  - end region
  - route regions (tagged)
  - metric regions
- add routes A/B/C with descriptions
- validate region count

3. **Live Trial (optional)**

- shows trial running, intent status
- big intent buttons A/B/C
- stop/discard

4. **History / Analytics**

- list of trials
- quick stats per route
- export button

### Notification intents

When trial starts:

- notification: “Trial started: [Place]. Select intent.”
- actions: Intent A, Intent B, Intent C

When trial ends:

- summary: time + inferred actual

---

## 10. Export Formats (Python-friendly)

Exports must be deterministic, documented, and include IDs linking tables.

### 10.1 Export bundle

A single `.zip` containing:

- `places.json`
- `trials.csv`
- `events.csv`
- `trackpoints.csv`
- `README.txt` (schema)

### 10.2 places.json

Array of full Place objects.

```json
{
  "exported_at": "2026-01-12T18:40:00Z",
  "app_version": "1.0.0",
  "places": [ ... ]
}
```

### 10.3 trials.csv columns

- trial\_id
- place\_id
- place\_name
- started\_at\_iso
- ended\_at\_iso
- intent
- actual
- confidence
- total\_time\_sec
- distance\_m
- stall\_time\_sec
- metric\_region\_times\_json
- status
- device\_info\_json

### 10.4 events.csv columns

- event\_id
- trial\_id
- t\_iso
- region\_id
- event

### 10.5 trackpoints.csv columns

- point\_id
- trial\_id
- t\_iso
- lat
- lon
- accuracy\_m
- speed\_mps
- heading\_deg

### 10.6 Optional: per-trial GeoJSON track

`tracks/<trial_id>.geojson` for easier GIS handling.

---

## 11. Implementation Plan (Deliverables for Cursor/Codex)

### 11.1 Project structure

```
/app
  /src
    /background
      geofenceTask.ts
      locationTask.ts
    /db
      schema.ts
      migrations.ts
      queries.ts
    /domain
      models.ts
      routeInference.ts
      metrics.ts
      geospatial.ts
      export.ts
    /ui
      PlacesScreen.tsx
      PlaceEditorScreen.tsx
      TrialScreen.tsx
      HistoryScreen.tsx
    /services
      permissions.ts
      geofences.ts
      notifications.ts
      trialManager.ts
  app.config.ts
  package.json
```

### 11.2 Core modules

#### `trialManager.ts`

- `startTrial(placeId, triggerContext)`
- `setIntent(trialId, intent)`
- `endTrial(trialId)`
- `discardTrial(trialId, reason)`

#### `routeInference.ts`

- `inferActualRoute(place, trial, events, trackpoints)`

#### `metrics.ts`

- `computeMetrics(place, trial, trackpoints)`

#### `export.ts`

- `exportZipBundle()`

### 11.3 Database query helpers

- insert/select/update functions
- transaction wrappers

---

## 12. Algorithms (Precise Flow)

### 12.1 Geofence Event Handler Flow

Pseudo-flow:

1. Receive event: `{ eventType, regionId, timestamp }`.
2. Map regionId → placeId + kind (start/end/route/metric).
3. If start enter:
   - `trialManager.startTrial(placeId, ctx)`
4. Else if end enter:
   - find active trial for place
   - `trialManager.endTrial(trialId)`
5. Else:
   - if there is an active trial for that place:
     - insert RegionEvent

### 12.2 Location Update Handler Flow

1. Find active trial (should be at most 1 global active trial unless you allow overlap).
2. Insert TrackPoint.

Optional: compute incremental distance/stall in-memory cache, flush at end.

### 12.3 End Trial Flow

1. Load place config.
2. Load events + trackpoints.
3. Compute metrics.
4. Infer actual route + confidence.
5. Update trial row.

---

## 13. Edge Cases & Reliability

### 13.1 Duplicate starts

- throttle by time
- require “no active trial exists”

### 13.2 Missed end region

If end geofence not triggered:

- provide manual “finish” button
- implement timeout:
  - if trial exceeds e.g. 30 minutes and user leaves area, auto-finish/discard

### 13.3 GPS dropouts

- record accuracy, ignore points with accuracy > 50m for corridor matching

### 13.4 Multiple active trials

- simplest: enforce **single active trial globally**.
  - if a new start triggers while active → ignore or prompt.

---

## 14. Validation & Testing Strategy

- Unit tests for:

  - Haversine distance
  - stall time calculation
  - region scoring
  - sequence satisfaction

- Simulated playback:

  - import GPX/GeoJSON
  - run inference/metrics as if live

- In-app debug:

  - show last 50 events
  - show current monitored regions count

---

## 15. Post-analysis in Python (Expected Workflow)

Python user workflow:

1. Unzip export bundle.
2. Load with pandas:

```python
import pandas as pd
trials = pd.read_csv('trials.csv')
points = pd.read_csv('trackpoints.csv')
events = pd.read_csv('events.csv')
```

3. Compare by route:

- mean/median time
- variance/p90
- condition on weekday/time

4. Optional risk-adjusted objective:

`score = median_time + λ * p90_time`

---

## 16. Recommended Default Place Config (Example)

- Start zone: radius 120m (just before decision)
- End zone: radius 120m (parking entrance)
- Route evidence regions:
  - LEFT\_TURN: 60m
  - RIGHT\_COMPLEX: 60m
  - BLOCK\_UTURN: 60m
- Metric region:
  - LEFT\_WAIT: 40m around left turn stop line

---

## 17. Implementation Notes (Expo specifics)

- Use `Location.startGeofencingAsync(taskName, regions)`
- Use `Location.startLocationUpdatesAsync(taskName, options)`
- Ensure tasks are defined at module top-level (Expo requirement)

---

## 18. Deliverable Checklist for Implementation Tool

1. Expo RN project with TypeScript.
2. SQLite schema + migrations.
3. Place editor UI on map.
4. Geofence registration manager (nearby/active selection).
5. Background tasks.
6. Trial manager.
7. Route inference engine.
8. Metrics computation.
9. Export zip bundle.
10. Minimal analytics screen.

---

## 19. Open Choices (safe defaults provided)

- Stall speed threshold: default 0.8 m/s
- Location sampling: 1–2 seconds
- Confidence threshold: require bestScore >= 1.0
- Number of monitored places: 2–3

---

## 20. Next Step

If you want this spec to be even more implementation-ready, expand with:

- exact Expo config and permission strings for iOS
- code-level function signatures for every module
- JSON schema for `Place` validation (zod)
- sample export README with column definitions

(Those can be appended directly beneath this spec.)

