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

## Next steps

- Initialize an Expo app and wire these modules into `App.tsx`
- Add a map-based place editor and region catalog storage
- Add export bundle creation using `expo-file-system` + zip helper
