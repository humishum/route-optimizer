import * as TaskManager from "expo-task-manager";
import type { GeofencingEventType } from "expo-location";
import { TASK_GEOFENCE } from "./taskNames";
import { handleGeofenceEvent } from "../services/trialManager";

TaskManager.defineTask(
  TASK_GEOFENCE,
  ({ data, error }: { data?: { eventType: GeofencingEventType; region?: { identifier: string } }; error?: Error }) => {
    if (error || !data?.region?.identifier) {
      return;
    }
    const { eventType, region } = data;
    handleGeofenceEvent(region.identifier, eventType, Date.now()).catch(() => {});
  },
);
