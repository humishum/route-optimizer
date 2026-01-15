import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export function PlacesScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Places</Text>
      <Text style={styles.subtitle}>Add places and toggle monitoring.</Text>
      <Button title="Add Place" onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 16 },
});
