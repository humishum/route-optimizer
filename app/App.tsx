import React, { useEffect } from "react";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { PlacesScreen } from "./src/ui/PlacesScreen";
import { PlaceEditorScreen } from "./src/ui/PlaceEditorScreen";
import { TrialScreen } from "./src/ui/TrialScreen";
import { HistoryScreen } from "./src/ui/HistoryScreen";
import { ensurePermissions } from "./src/services/permissions";
import { refreshGeofences } from "./src/services/geofenceManager";
import { setIntentForActiveTrial } from "./src/services/trialManager";
import type { RootStackParamList, TabsParamList } from "./src/ui/navigationTypes";

import "./src/background/geofenceTask";
import "./src/background/locationTask";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator<TabsParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): JSX.Element {
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    let subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      if (action.startsWith("intent_")) {
        const intent = action.replace("intent_", "");
        setIntentForActiveTrial(intent).catch(() => {});
      }
    });

    ensurePermissions()
      .then((granted) => {
        if (!granted) {
          return;
        }
        return refreshGeofences();
      })
      .finally(() => setReady(true));

    return () => {
      subscription.remove();
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Preparing commute tracking…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="PlaceEditor" component={PlaceEditorScreen} options={{ title: "Edit Place" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function Tabs(): JSX.Element {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Places" component={PlacesScreen} />
      <Tab.Screen name="Trial" component={TrialScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#666" },
});
