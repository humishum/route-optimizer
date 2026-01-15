import type { Place } from "../domain/models";
import { getPlaceById, initializeDatabase, listPlaces, openDatabase, upsertPlace } from "../db/queries";

export async function loadPlaces(): Promise<Place[]> {
  const db = openDatabase();
  await initializeDatabase(db);
  return listPlaces(db);
}

export async function savePlace(place: Place): Promise<void> {
  const db = openDatabase();
  await initializeDatabase(db);
  await upsertPlace(db, place);
}

export async function loadPlace(placeId: string): Promise<Place | undefined> {
  const db = openDatabase();
  await initializeDatabase(db);
  return getPlaceById(db, placeId);
}
