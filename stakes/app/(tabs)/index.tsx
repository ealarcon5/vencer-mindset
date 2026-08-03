import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { myBets } from "../../lib/bets";
import { supabase } from "../../lib/supabase";
import { humanCountdown, localDateKey, deviceTimezone } from "../../lib/time";
import type { Bet, Checkin } from "../../lib/database.types";
import {
  Header, Text, Card, Money, Symbol, EmptyState, Button,
} from "../../components/ui";
import { colors, spacing, screen, radius } from "../../constants/theme";

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
    const key = localDateKey(deviceTimezone());
    const withCheckins = await Promise.all(
      bets.map(async (bet) => {
        const { data } = await supabase.from("checkins").select("*")
          .eq("bet_id", bet.id).eq("user_id", uid).eq("local_date", key).maybeSingle();
        return { bet, checkin: (data as Checkin) ?? null };
      }),
    );
    setRows(withCheckins);
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openToday = rows.filter((r) => r.checkin && r.checkin.status !== "verified" && r.checkin.status !== "failed");

  return (
    <View style={styles.flex}>
      <Header title="Today" subtitle={greeting()} actionSymbol="plus" onAction={() => router.push("/bet/create")} />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {rows.length === 0 ? (
          <EmptyState symbol="target" title="No active bets" message="Start a bet with a friend and put something real on the line." />
        ) : (
          <>
            {openToday.length > 0 && (
              <Text variant="footnote" tone="secondary" style={styles.sectionLabel}>
                {openToday.length} TO PROVE BEFORE MIDNIGHT
              </Text>
            )}
            {rows.map(({ bet, checkin }) => (
              <Card key={bet.id} onPress={() => router.push(`/bet/${bet.id}`)} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{bet.title}</Text>
                    <View style={styles.metaRow}>
                      <Money amount={Number(bet.stake_amount)} variant="footnote" tone="secondary" />
                      {checkin ? (
                        <Text variant="footnote" tone="secondary"> · due {humanCountdown(checkin.due_at)}</Text>
                      ) : null}
                    </View>
                  </View>
                  <StatusChip status={checkin?.status} />
                </View>
              </Card>
            ))}
          </>
        )}

        {rows.length > 0 && (
          <View style={{ paddingHorizontal: screen.margin, marginTop: spacing.sm }}>
            <Button label="New bet" variant="secondary" onPress={() => router.push("/bet/create")} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatusChip({ status }: { status?: string }) {
  if (status === "verified")
    return <Chip bg={colors.success} symbol="checkmark" label="Done" />;
  if (status === "failed")
    return <Chip bg={colors.danger} symbol="xmark" label="Missed" />;
  if (status === "submitted")
    return <Chip bg={colors.warning} symbol="clock" label="Pending" />;
  return <Chip bg={colors.fill} symbol="camera" label="Prove" />;
}

function Chip({ bg, symbol, label }: { bg: string; symbol: string; label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Symbol name={symbol as any} size={12} color={colors.textOnDark} weight="bold" />
      <Text variant="footnote" tone="onDark" style={{ fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function greeting(): string {
  return "Keep your word.";
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingBottom: 120 },
  sectionLabel: { marginHorizontal: screen.margin, marginBottom: spacing.sm, marginTop: spacing.xs },
  card: { marginBottom: spacing.md },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill,
  },
});
