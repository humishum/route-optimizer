import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export function TrialScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Active Trial</Text>
      <View style={styles.intentRow}>
        <Button title="A" onPress={() => {}} />
        <Button title="B" onPress={() => {}} />
        <Button title="C" onPress={() => {}} />
      </View>
      <Button title="Discard Trial" onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 16 },
  intentRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
});
