import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export function HistoryScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text>Completed trials and export tools appear here.</Text>
      <Button title="Export Bundle" onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
});
