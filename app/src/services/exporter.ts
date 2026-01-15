import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { buildPlacesPayload, eventsToCsv, trackpointsToCsv, trialsToCsv } from "../domain/export";
import {
  initializeDatabase,
  listAllEvents,
  listAllTrackpoints,
  listPlaces,
  listTrials,
  openDatabase,
} from "../db/queries";

export async function exportBundle(appVersion: string): Promise<string | undefined> {
  const db = openDatabase();
  await initializeDatabase(db);

  const [places, trials, events, trackpoints] = await Promise.all([
    listPlaces(db),
    listTrials(db),
    listAllEvents(db),
    listAllTrackpoints(db),
  ]);

  const placeById = Object.fromEntries(places.map((place) => [place.id, place]));
  const exportedAtIso = new Date().toISOString();

  const zip = new JSZip();
  zip.file("places.json", JSON.stringify(buildPlacesPayload(places, exportedAtIso, appVersion), null, 2));
  zip.file("trials.csv", trialsToCsv(trials, placeById));
  zip.file("events.csv", eventsToCsv(events));
  zip.file("trackpoints.csv", trackpointsToCsv(trackpoints));
  zip.file("README.txt", buildReadme());

  const base64 = await zip.generateAsync({ type: "base64" });
  const path = `${FileSystem.cacheDirectory}commute-export-${Date.now()}.zip`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path);
  }

  return path;
}

function buildReadme(): string {
  return [
    "Commute Experiment Export Bundle",
    "",
    "Files:",
    "- places.json",
    "- trials.csv",
    "- events.csv",
    "- trackpoints.csv",
    "",
    "All timestamps are ISO8601 UTC.",
  ].join("\n");
}
