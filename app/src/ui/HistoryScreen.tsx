import React, { useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { exportBundle } from "../services/exporter";

export function HistoryScreen(): JSX.Element {
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    setStatus("Exporting...");
    const path = await exportBundle("0.1.0");
    setStatus(path ? `Exported to ${path}` : "Export complete");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text>Completed trials and export tools appear here.</Text>
      <Button title="Export Bundle" onPress={handleExport} />
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  status: { marginTop: 12, color: "#666" },
});
