import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { myBets } from "../../lib/bets";
import { supabase } from "../../lib/supabase";
import { humanCountdown, localDateKey, deviceTimezone } from "../../lib/time";
import type { Bet, Checkin } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

type Row = { bet: Bet; checkin: Checkin | null };

export default function Home() {
  const { session } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const uid = session?.user.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const bets = (await myBets(uid)).filter((b) => b.status === "active");
    const tz = deviceTimezone();
    const key = localDateKey(tz);
    const withCheckins = await Promise.all(
      bets.map(async (bet) => {
        const { data } = await supabase
          .from("checkins").select("*")
          .eq("bet_id", bet.id).eq("user_id", uid).eq("local_date", key).maybeSingle();
        return { bet, checkin: (data as Checkin) ?? null };
      }),
    );
    setRows(withCheckins);
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
      data={rows}
      keyExtractor={(r) => r.bet.id}
      refreshControl={
        <RefreshControl tintColor={colors.gold} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />
      }
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.h1}>Today</Text>
          <Text style={styles.sub}>Keep your word. Prove it before midnight.</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active bets yet.</Text>
          <Pressable style={styles.cta} onPress={() => router.push("/bet/create")}>
            <Text style={styles.ctaText}>+ Start a bet</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => {
        const done = item.checkin?.status === "verified";
        const missed = item.checkin?.status === "failed";
        return (
          <Pressable style={styles.card} onPress={() => router.push(`/bet/${item.bet.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.bet.title}</Text>
              <Text style={styles.cardMeta}>
                ${item.bet.stake_amount} on the line
                {item.checkin ? ` · due ${humanCountdown(item.checkin.due_at)}` : ""}
              </Text>
            </View>
            <View style={[styles.badge, done && styles.badgeDone, missed && styles.badgeMiss]}>
              <Text style={styles.badgeText}>
                {done ? "✓ Done" : missed ? "✗ Missed" : "Log proof"}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: "800" },
  sub: { color: colors.textDim, marginTop: 4 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.card,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  cardMeta: { color: colors.textDim, marginTop: 4, fontSize: 13 },
  badge: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  badgeDone: { backgroundColor: colors.green },
  badgeMiss: { backgroundColor: colors.red },
  badgeText: { color: colors.bg, fontWeight: "800", fontSize: 13 },
  empty: { alignItems: "center", marginTop: spacing.xl },
  emptyText: { color: colors.textDim, marginBottom: spacing.md },
  cta: { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  ctaText: { color: colors.bg, fontWeight: "800" },
});
