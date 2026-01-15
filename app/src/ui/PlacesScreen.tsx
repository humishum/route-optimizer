import React, { useCallback, useState } from "react";
import { View, Text, Button, StyleSheet, FlatList, Switch, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Place } from "../domain/models";
import { loadPlaces, savePlace } from "../services/placeStore";
import { refreshGeofences } from "../services/geofenceManager";
import type { RootStackParamList } from "./navigationTypes";

export function PlacesScreen(): JSX.Element {
  const [places, setPlaces] = useState<Place[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const refresh = useCallback(async () => {
    const list = await loadPlaces();
    setPlaces(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const toggleActive = async (place: Place) => {
    const updated = { ...place, isActive: !place.isActive, updatedAt: Date.now() };
    await savePlace(updated);
    await refreshGeofences();
    await refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Places</Text>
      <Text style={styles.subtitle}>Add places and toggle monitoring.</Text>
      <Button title="Add Place" onPress={() => navigation.navigate("PlaceEditor", {})} />
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("PlaceEditor", { placeId: item.id })}
          >
            <View>
              <Text style={styles.placeName}>{item.name}</Text>
              <Text style={styles.placeMeta}>{item.routeDefs.length} routes</Text>
            </View>
            <Switch value={item.isActive} onValueChange={() => toggleActive(item)} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No places yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  list: { marginTop: 16, gap: 12 },
  row: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  placeName: { fontSize: 16, fontWeight: "600" },
  placeMeta: { fontSize: 12, color: "#666", marginTop: 4 },
  empty: { marginTop: 24, color: "#666" },
});
