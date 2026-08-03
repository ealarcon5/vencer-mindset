import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { myBets } from "../../lib/bets";
import type { Bet } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

const STATUS_COLOR: Record<string, string> = {
  active: colors.gold, invited: colors.yellow, settled: colors.green, canceled: colors.textDim, draft: colors.textDim,
};

export default function Bets() {
  const { session } = useAuth();
  const router = useRouter();
  const [bets, setBets] = useState<Bet[]>([]);
  const uid = session?.user.id;

  useFocusEffect(useCallback(() => {
    if (uid) myBets(uid).then(setBets);
  }, [uid]));

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
        data={bets}
        keyExtractor={(b) => b.id}
        ListEmptyComponent={<Text style={styles.empty}>No bets yet. Tap + to start one.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/bet/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                ${item.stake_amount} · {item.metric} · {item.start_date} → {item.end_date}
              </Text>
            </View>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] ?? colors.textDim }]}>
              {item.status}
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push("/bet/create")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.card,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textDim, marginTop: 4, fontSize: 12 },
  status: { fontWeight: "800", textTransform: "capitalize", fontSize: 12 },
  empty: { color: colors.textDim, textAlign: "center", marginTop: spacing.xl },
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 60, height: 60,
    borderRadius: 30, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: colors.bg, fontSize: 32, fontWeight: "800", marginTop: -2 },
});
