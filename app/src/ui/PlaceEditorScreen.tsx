import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Button, ScrollView } from "react-native";
import MapView, { Circle, Marker, MapPressEvent } from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Place, RouteDef, MetricRegion } from "../domain/models";
import { loadPlace, savePlace } from "../services/placeStore";
import { refreshGeofences } from "../services/geofenceManager";
import type { RootStackParamList } from "./navigationTypes";

export function PlaceEditorScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const params = route.params as { placeId?: string } | undefined;

  const [place, setPlace] = useState<Place | undefined>(undefined);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"start" | "end" | "route" | "metric">("start");
  const [radius, setRadius] = useState("80");
  const [routeId, setRouteId] = useState("A");

  const routeDefs = useMemo<RouteDef[]>(() => {
    if (place?.routeDefs?.length) {
      return place.routeDefs;
    }
    return [
      { id: "A", label: "A", description: "Primary", evidence: [] },
      { id: "B", label: "B", description: "Alternate", evidence: [] },
      { id: "C", label: "C", description: "Backup", evidence: [] },
    ];
  }, [place?.routeDefs]);

  useEffect(() => {
    if (!params?.placeId) {
      return;
    }
    loadPlace(params.placeId).then((loaded) => {
      if (loaded) {
        setPlace(loaded);
        setName(loaded.name);
      }
    });
  }, [params?.placeId]);

  const onMapLongPress = useCallback(
    (event: MapPressEvent) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const radiusM = Number(radius) || 80;
      const id = createId("region");
      setPlace((prev) => {
        const base = prev ?? createEmptyPlace(name);
        if (mode === "start") {
          return {
            ...base,
            startRegion: { id: createId("start"), lat: latitude, lon: longitude, radiusM },
          };
        }
        if (mode === "end") {
          return {
            ...base,
            endRegion: { id: createId("end"), lat: latitude, lon: longitude, radiusM },
          };
        }
        if (mode === "route") {
          const region = { id, lat: latitude, lon: longitude, radiusM };
          const updatedRouteDefs = addEvidenceRegion(base.routeDefs, routeId, id);
          return {
            ...base,
            routeRegions: [...(base.routeRegions ?? []), region],
            routeDefs: updatedRouteDefs,
          };
        }
        const metric: MetricRegion = {
          id: createId("metric"),
          label: `Metric ${base.metricRegions.length + 1}`,
          circle: { id, lat: latitude, lon: longitude, radiusM },
          stallSpeedMps: 0.8,
        };
        return {
          ...base,
          metricRegions: [...base.metricRegions, metric],
        };
      });
    },
    [mode, radius, routeId, name],
  );

  const onSave = async () => {
    if (!place) {
      return;
    }
    const updated: Place = {
      ...place,
      name: name.trim() || place.name,
      routeDefs,
      updatedAt: Date.now(),
    };
    await savePlace(updated);
    await refreshGeofences();
    navigation.goBack();
  };

  const mapRegion = place?.startRegion
    ? {
        latitude: place.startRegion.lat,
        longitude: place.startRegion.lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Place Editor</Text>
      <TextInput
        style={styles.input}
        placeholder="Place name"
        value={name}
        onChangeText={setName}
      />
      <ScrollView horizontal style={styles.modeRow}>
        <Button title="Start" onPress={() => setMode("start")} />
        <Button title="End" onPress={() => setMode("end")} />
        <Button title="Route" onPress={() => setMode("route")} />
        <Button title="Metric" onPress={() => setMode("metric")} />
      </ScrollView>
      <View style={styles.row}>
        <Text style={styles.label}>Radius (m)</Text>
        <TextInput style={styles.radiusInput} value={radius} onChangeText={setRadius} />
        {mode === "route" && (
          <>
            <Text style={styles.label}>Route</Text>
            <TextInput style={styles.radiusInput} value={routeId} onChangeText={setRouteId} />
          </>
        )}
      </View>
      <MapView
        style={styles.map}
        onLongPress={onMapLongPress}
        initialRegion={
          mapRegion ?? {
            latitude: 37.773972,
            longitude: -122.431297,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        }
        showsUserLocation
      >
        {place?.startRegion && (
          <>
            <Marker
              coordinate={{ latitude: place.startRegion.lat, longitude: place.startRegion.lon }}
              title="Start"
            />
            <Circle
              center={{ latitude: place.startRegion.lat, longitude: place.startRegion.lon }}
              radius={place.startRegion.radiusM}
              strokeColor="#2e7d32"
              fillColor="rgba(46, 125, 50, 0.2)"
            />
          </>
        )}
        {place?.endRegion && (
          <>
            <Marker
              coordinate={{ latitude: place.endRegion.lat, longitude: place.endRegion.lon }}
              title="End"
            />
            <Circle
              center={{ latitude: place.endRegion.lat, longitude: place.endRegion.lon }}
              radius={place.endRegion.radiusM}
              strokeColor="#1565c0"
              fillColor="rgba(21, 101, 192, 0.2)"
            />
          </>
        )}
        {place?.routeRegions?.map((region) => (
          <Circle
            key={region.id}
            center={{ latitude: region.lat, longitude: region.lon }}
            radius={region.radiusM}
            strokeColor="#6a1b9a"
            fillColor="rgba(106, 27, 154, 0.2)"
          />
        ))}
        {place?.metricRegions?.map((metric) => (
          <Circle
            key={metric.circle.id}
            center={{ latitude: metric.circle.lat, longitude: metric.circle.lon }}
            radius={metric.circle.radiusM}
            strokeColor="#ef6c00"
            fillColor="rgba(239, 108, 0, 0.2)"
          />
        ))}
      </MapView>
      <Button title="Save Place" onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  modeRow: { flexGrow: 0, marginBottom: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  label: { fontSize: 12, color: "#666" },
  radiusInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 6,
    minWidth: 60,
    textAlign: "center",
  },
  map: { flex: 1, minHeight: 300, borderRadius: 12, marginBottom: 12 },
});

function createEmptyPlace(name: string): Place {
  const now = Date.now();
  const defaultCircle = { id: createId("start"), lat: 0, lon: 0, radiusM: 100 };
  return {
    id: createId("place"),
    name: name.trim() || "New Place",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    startRegion: defaultCircle,
    endRegion: { ...defaultCircle, id: createId("end") },
    routeRegions: [],
    routeDefs: [
      { id: "A", label: "A", description: "Primary", evidence: [] },
      { id: "B", label: "B", description: "Alternate", evidence: [] },
      { id: "C", label: "C", description: "Backup", evidence: [] },
    ],
    metricRegions: [],
    corridors: [],
    triggerRules: {
      minSecondsBetweenTrials: 600,
      minSpeedMps: 3,
      requireHeadingWithinDeg: 60,
      expectedHeadingDeg: 145,
    },
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
}

function addEvidenceRegion(routeDefs: RouteDef[], routeId: string, regionId: string): RouteDef[] {
  return routeDefs.map((route) => {
    if (route.id !== routeId) {
      return route;
    }
    return {
      ...route,
      evidence: [...route.evidence, { type: "region_enter", regionId, weight: 1 }],
    };
  });
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
