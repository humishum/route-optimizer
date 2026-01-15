import * as Notifications from "expo-notifications";

export const INTENT_CATEGORY_ID = "trial_intent_category";

export async function configureNotificationActions(routeIds: string[]): Promise<void> {
  const actions = routeIds.slice(0, 4).map((routeId) => ({
    identifier: `intent_${routeId}`,
    buttonTitle: routeId,
    options: { opensAppToForeground: false },
  }));
  await Notifications.setNotificationCategoryAsync(INTENT_CATEGORY_ID, actions);
}

export async function notifyTrialStart(placeName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Trial started",
      body: `Select intent for ${placeName}`,
      categoryIdentifier: INTENT_CATEGORY_ID,
    },
    trigger: null,
  });
}

export async function notifyTrialEnd(placeName: string, summary: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Trial complete: ${placeName}`,
      body: summary,
    },
    trigger: null,
  });
}

export async function notifyGeofenceHit(label: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Geofence entered",
        body: label,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn("Geofence notification skipped:", error);
  }
}
