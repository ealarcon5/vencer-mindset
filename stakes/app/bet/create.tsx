import { useCallback, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { createBet } from "../../lib/bets";
import { localDateKey, deviceTimezone } from "../../lib/time";
import type { Profile } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

const METRICS = ["reps", "pages", "miles", "minutes"];
const PROOF_MODES = ["honor", "photo", "video", "health"];

export default function CreateBet() {
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;

  const [friends, setFriends] = useState<Profile[]>([]);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [title, setTitle] = useState("200 push-ups");
  const [metric, setMetric] = useState("reps");
  const [target, setTarget] = useState("200");
  const [days, setDays] = useState("30");
  const [stake, setStake] = useState("50");
  const [restDays, setRestDays] = useState("0");
  const [proofMode, setProofMode] = useState("honor");
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
    if (!opponent) return Alert.alert("Pick an opponent");
    setBusy(true);
    try {
      const tz = deviceTimezone();
      const start = localDateKey(tz);
      const end = addDays(start, Math.max(1, parseInt(days) || 1) - 1);
      await createBet(uid, {
        opponentId: opponent.id,
        title: title.trim(),
        metric,
        target: parseFloat(target) || 1,
        startDate: start,
        endDate: end,
        deadlineLocalTime: "23:59",
        stakeAmount: parseFloat(stake) || 0,
        restDaysAllowed: parseInt(restDays) || 0,
        proofMode,
      });
      Alert.alert("Bet sent!", `${opponent.display_name} needs to accept it.`);
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
      <Text style={styles.h1}>New bet</Text>

      <Label>Opponent</Label>
      <View style={styles.chips}>
        {friends.length === 0 && <Text style={styles.dim}>Add friends first (Friends tab).</Text>}
        {friends.map((f) => (
          <Chip key={f.id} label={f.display_name} active={opponent?.id === f.id}
            onPress={() => setOpponent(f)} />
        ))}
      </View>

      <Label>Goal</Label>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Label>Metric</Label>
      <View style={styles.chips}>
        {METRICS.map((m) => <Chip key={m} label={m} active={metric === m} onPress={() => setMetric(m)} />)}
      </View>

      <Row>
        <Field label="Target" value={target} onChange={setTarget} keyboard="numeric" />
        <Field label="Days" value={days} onChange={setDays} keyboard="numeric" />
      </Row>
      <Row>
        <Field label="Stake ($)" value={stake} onChange={setStake} keyboard="numeric" />
        <Field label="Rest days" value={restDays} onChange={setRestDays} keyboard="numeric" />
      </Row>

      <Label>Proof method</Label>
      <View style={styles.chips}>
        {PROOF_MODES.map((p) => <Chip key={p} label={p} active={proofMode === p} onPress={() => setProofMode(p)} />)}
      </View>
      <Text style={styles.dim}>
        Deadline is 11:59pm your local time each day. Miss it (beyond your rest
        days) and the stake goes to your opponent.
      </Text>

      <Pressable style={[styles.submit, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.submitText}>{busy ? "Sending…" : "Send bet"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: spacing.sm }}>{children}</View>;
}
function Field({ label, value, onChange, keyboard }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={keyboard} />
    </View>
  );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextActive: { color: colors.bg },
  dim: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
  submit: { backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  submitText: { color: colors.bg, fontWeight: "800", fontSize: 16 },
});
