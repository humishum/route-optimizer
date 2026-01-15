import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

export async function ensurePermissions(): Promise<boolean> {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    return false;
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    return false;
  }

  const notificationStatus = await Notifications.requestPermissionsAsync();
  return notificationStatus.status === "granted";
}
