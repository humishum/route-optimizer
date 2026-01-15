# route-optimizer

Early implementation of the Commute Experiment app spec. This repo contains a TypeScript module layout for an Expo app that:

- Starts/stops trials via geofences
- Records intent, route events, and GPS trackpoints
- Computes metrics and infers actual route
- Prepares exportable CSV bundles for analysis

## Structure

`/app/src` is the core implementation:

- `background/` Expo Task Manager definitions
- `db/` SQLite schema + query helpers
- `domain/` types, geospatial helpers, metrics, route inference, export helpers
- `services/` trial lifecycle, geofence registration, notifications, permissions
- `ui/` starter screens (placeholders)

## Run the app (iOS)

```bash
cd app
npm install
npx expo start --ios
```

## Analysis scripts

Python analysis scripts live in `/analysis` and use `uv` for dependency management.

```bash
cd analysis
uv venv
uv sync
python export_summary.py /path/to/unzipped
```

## Next steps

- Add route labeling UX (assign evidence regions to routes)
- Improve trial history and analytics screens
- Add automated test harness for inference + metrics
