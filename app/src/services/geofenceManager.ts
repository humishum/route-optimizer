import * as Location from "expo-location";
import { TASK_GEOFENCE } from "../background/taskNames";
import { buildGeofenceRegions, registerGeofences } from "./geofences";
import { loadPlaces } from "./placeStore";

export async function refreshGeofences(): Promise<void> {
  try {
    const places = await loadPlaces();
    const regions = buildGeofenceRegions(places);
    if (regions.length === 0) {
      const started = await Location.hasStartedGeofencingAsync(TASK_GEOFENCE);
      if (started) {
        await Location.stopGeofencingAsync(TASK_GEOFENCE);
      }
      return;
    }
    await registerGeofences(regions);
  } catch (error) {
    // Geofencing may be unavailable in Expo Go or simulators.
    console.warn("Geofence registration skipped:", error);
  }
}
