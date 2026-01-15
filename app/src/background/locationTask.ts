import * as TaskManager from "expo-task-manager";
import type { LocationObject } from "expo-location";
import { TASK_LOCATION } from "./taskNames";
import { handleLocationUpdate } from "../services/trialManager";

TaskManager.defineTask(
  TASK_LOCATION,
  ({
    data,
    error,
  }: {
    data?: { locations: LocationObject[] };
    error?: Error;
  }) => {
    if (error || !data?.locations?.length) {
      return;
    }
    handleLocationUpdate(data.locations).catch(() => {});
  },
);
