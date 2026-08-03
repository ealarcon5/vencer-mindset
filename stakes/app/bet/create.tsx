import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { createBet } from "../../lib/bets";
import { localDateKey, deviceTimezone } from "../../lib/time";
import type { Profile } from "../../lib/database.types";
import {
  Text, Field, Segmented, Button, ListSection, ListRow, Money, EmptyState,
} from "../../components/ui";
import { colors, spacing, screen } from "../../constants/theme";

const METRICS = ["reps", "pages", "miles", "minutes"] as const;
const PROOF = ["honor", "photo", "video", "health"] as const;

export default function CreateBet() {
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;

  const [friends, setFriends] = useState<Profile[]>([]);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [title, setTitle] = useState("200 push-ups");
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("reps");
  const [target, setTarget] = useState("200");
  const [days, setDays] = useState("30");
  const [stake, setStake] = useState("50");
  const [restDays, setRestDays] = useState("0");
  const [proofMode, setProofMode] = useState<(typeof PROOF)[number]>("photo");
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!uid) return;
    supabase.from("friendships")
      .select("friend:profiles!friendships_friend_id_fkey(*)")
      .eq("user_id", uid).eq("status", "accepted")
      .then(({ data }) => setFriends((data ?? []).map((r: any) => r.friend)));
  }, [uid]));

  async function submit() {
    if (!uid) return;
    if (!opponent) return Alert.alert("Pick who you're betting");
    setBusy(true);
    try {
      const tz = deviceTimezone();
      const start = localDateKey(tz);
      const end = addDays(start, Math.max(1, parseInt(days) || 1) - 1);
      const bet = await createBet(uid, {
        opponentId: opponent.id, title: title.trim(), metric,
        target: parseFloat(target) || 1, startDate: start, endDate: end,
        deadlineLocalTime: "23:59", stakeAmount: parseFloat(stake) || 0,
        restDaysAllowed: parseInt(restDays) || 0, proofMode,
      });
      router.replace(`/bet/${bet.id}`);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const stakeNum = parseFloat(stake) || 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="largeTitle" style={styles.title}>New bet</Text>

      {/* Opponent */}
      {friends.length === 0 ? (
        <EmptyState symbol="person.2" title="No friends yet" message="Add a friend first to bet them." />
      ) : (
        <ListSection header="Betting against">
          {friends.map((f) => (
            <ListRow
              key={f.id}
              title={f.display_name}
              leadingSymbol={opponent?.id === f.id ? "checkmark.circle.fill" : "circle"}
              leadingColor={opponent?.id === f.id ? colors.accent : colors.grouped}
              onPress={() => setOpponent(f)}
            />
          ))}
        </ListSection>
      )}

      {/* Goal */}
      <View style={styles.block}>
        <Field label="Goal" value={title} onChangeText={setTitle} placeholder="200 push-ups" />
        <Text variant="footnote" tone="secondary" style={styles.miniLabel}>MEASURED IN</Text>
        <Segmented options={METRICS as unknown as string[]} value={metric} onChange={(v) => setMetric(v as any)} />
      </View>

      <View style={styles.block}>
        <View style={styles.row}>
          <View style={styles.half}><Field label="Target / day" value={target} onChangeText={setTarget} keyboardType="numeric" /></View>
          <View style={styles.half}><Field label="Duration (days)" value={days} onChangeText={setDays} keyboardType="numeric" /></View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}><Field label="Stake ($)" value={stake} onChangeText={setStake} keyboardType="numeric" /></View>
          <View style={styles.half}><Field label="Rest days" value={restDays} onChangeText={setRestDays} keyboardType="numeric" /></View>
        </View>
      </View>

      <View style={styles.block}>
        <Text variant="footnote" tone="secondary" style={styles.miniLabel}>PROOF EACH DAY</Text>
        <Segmented options={PROOF as unknown as string[]} value={proofMode} onChange={(v) => setProofMode(v as any)} />
      </View>

      {/* Pot summary */}
      <View style={styles.potCard}>
        <View style={styles.potRow}>
          <Text variant="subhead" tone="secondary">You each stake</Text>
          <Money amount={stakeNum} variant="headline" />
        </View>
        <View style={styles.potRow}>
          <Text variant="subhead" tone="secondary">Winner takes (before fees)</Text>
          <Money amount={stakeNum * 2} variant="headline" tone="success" />
        </View>
        <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.sm }}>
          Your ${stakeNum || 0} is charged and held in escrow when both of you pay in. Miss a day past
          your rest days and it goes to {opponent?.display_name ?? "your friend"}.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Send bet" onPress={submit} loading={busy} disabled={!opponent} />
      </View>
    </ScrollView>
  );
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.huge },
  title: { paddingHorizontal: screen.margin, marginBottom: spacing.lg },
  block: { paddingHorizontal: screen.margin, marginBottom: spacing.xl },
  miniLabel: { marginBottom: spacing.sm, marginTop: spacing.xs, marginLeft: spacing.xs },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  potCard: { marginHorizontal: screen.margin, backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.xl },
  potRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  footer: { paddingHorizontal: screen.margin },
});
