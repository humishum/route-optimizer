import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function PlaceEditorScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Place Editor</Text>
      <Text>Map-based region editor will live here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
});
