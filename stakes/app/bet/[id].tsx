import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator, Image,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  acceptBet, declineBet, betParticipants, submitProof, confirmProof, disputeProof,
} from "../../lib/bets";
import { humanCountdown, localDateKey, deviceTimezone } from "../../lib/time";
import type { Bet, BetParticipant, Checkin, Profile } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

type Part = BetParticipant & { profile: Profile };

export default function BetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id!;
  const [bet, setBet] = useState<Bet | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [myCheckins, setMyCheckins] = useState<Checkin[]>([]);
  const [today, setToday] = useState<Checkin | null>(null);
  const [pendingReview, setPendingReview] = useState<{ checkin: Checkin; proofId: string; url?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: b } = await supabase.from("bets").select("*").eq("id", id).single();
    setBet(b as Bet);
    setParts(await betParticipants(id));

    const tz = deviceTimezone();
    const { data: mine } = await supabase.from("checkins").select("*")
      .eq("bet_id", id).eq("user_id", uid).order("local_date");
    setMyCheckins((mine ?? []) as Checkin[]);
    setToday(((mine ?? []) as Checkin[]).find((c) => c.local_date === localDateKey(tz)) ?? null);

    // Any submitted proof from my opponent awaiting my confirm/dispute?
    const opp = (await betParticipants(id)).find((p) => p.user_id !== uid);
    if (opp) {
      const { data: sub } = await supabase.from("checkins").select("*")
        .eq("bet_id", id).eq("user_id", opp.user_id).eq("status", "submitted")
        .order("local_date", { ascending: false }).limit(1).maybeSingle();
      if (sub) {
        const { data: proof } = await supabase.from("proofs").select("*")
          .eq("checkin_id", (sub as Checkin).id).order("submitted_at", { ascending: false })
          .limit(1).maybeSingle();
        setPendingReview(proof ? { checkin: sub as Checkin, proofId: (proof as any).id, url: (proof as any).media_url } : null);
      } else setPendingReview(null);
    }
    setLoading(false);
  }, [id, uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const me = parts.find((p) => p.user_id === uid);
  const opponent = parts.find((p) => p.user_id !== uid);
  const invitedPending = me?.status === "invited";

  async function onAccept() {
    await acceptBet(id, uid); await load();
  }
  async function onDecline() {
    await declineBet(id, uid); router.back();
  }

  async function logProof() {
    if (!today || !bet) return;
    let mediaUrl: string | undefined;
    if (bet.proof_mode === "photo" || bet.proof_mode === "video") {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: bet.proof_mode === "video" ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const ext = asset.uri.split(".").pop() || "jpg";
      const path = `${uid}/${today.id}.${ext}`;
      const blob = await (await fetch(asset.uri)).blob();
      const { error } = await supabase.storage.from("proof-media").upload(path, blob, { upsert: true });
      if (error) return Alert.alert("Upload failed", error.message);
      mediaUrl = path;
    }
    await submitProof({ checkinId: today.id, userId: uid, proofMode: bet.proof_mode, mediaUrl });
    Alert.alert("Logged", bet.proof_mode === "honor"
      ? "Marked done. Your opponent can still dispute."
      : "Proof submitted for your opponent to confirm.");
    await load();
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>;
  if (!bet) return <View style={styles.center}><Text style={styles.dim}>Bet not found.</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
      <Text style={styles.h1}>{bet.title}</Text>
      <Text style={styles.meta}>
        ${bet.stake_amount} · {bet.target} {bet.metric}/day · proof: {bet.proof_mode}
      </Text>
      <Text style={styles.meta}>{bet.start_date} → {bet.end_date}</Text>
      <StatusPill status={bet.status} winnerId={bet.winner_id} uid={uid} />

      {/* Invite actions */}
      {invitedPending && (
        <View style={styles.actionRow}>
          <Pressable style={[styles.btn, styles.accept]} onPress={onAccept}>
            <Text style={styles.btnDark}>Accept bet</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.decline]} onPress={onDecline}>
            <Text style={styles.btnLight}>Decline</Text>
          </Pressable>
        </View>
      )}

      {/* Today's proof */}
      {bet.status === "active" && today && (
        <View style={styles.card}>
          <Text style={styles.cardH}>Today</Text>
          <Text style={styles.dim}>Due {humanCountdown(today.due_at)}</Text>
          {today.status === "verified" ? (
            <Text style={styles.done}>✓ Verified {today.verified_by ? `(${today.verified_by})` : ""}</Text>
          ) : today.status === "failed" ? (
            <Text style={styles.fail}>✗ Missed</Text>
          ) : today.status === "submitted" ? (
            <Text style={styles.pending}>Waiting on your opponent to confirm…</Text>
          ) : (
            <Pressable style={styles.logBtn} onPress={logProof}>
              <Text style={styles.btnDark}>Log today's proof</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Review opponent's submitted proof */}
      {pendingReview && (
        <View style={styles.card}>
          <Text style={styles.cardH}>Confirm {opponent?.profile.display_name}'s proof</Text>
          {pendingReview.url ? <ProofImage path={pendingReview.url} /> : <Text style={styles.dim}>Honor submission — no media.</Text>}
          <View style={styles.actionRow}>
            <Pressable style={[styles.btn, styles.accept]}
              onPress={async () => { await confirmProof(pendingReview.checkin.id, pendingReview.proofId); await load(); }}>
              <Text style={styles.btnDark}>Confirm</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.decline]}
              onPress={async () => { await disputeProof(pendingReview.checkin.id, pendingReview.proofId); await load(); }}>
              <Text style={styles.btnLight}>Dispute</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Streak grid */}
      {myCheckins.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardH}>Your streak</Text>
          <View style={styles.grid}>
            {myCheckins.map((c) => (
              <View key={c.id} style={[
                styles.dot,
                c.status === "verified" && { backgroundColor: colors.green },
                c.status === "failed" && { backgroundColor: colors.red },
                c.status === "submitted" && { backgroundColor: colors.yellow },
              ]} />
            ))}
          </View>
          <Text style={styles.dim}>
            {myCheckins.filter((c) => c.status === "verified").length} verified ·
            {" "}{myCheckins.filter((c) => c.status === "failed").length} missed
          </Text>
        </View>
      )}

      {/* Participants */}
      <View style={styles.card}>
        <Text style={styles.cardH}>Players</Text>
        {parts.map((p) => (
          <Text key={p.id} style={styles.player}>
            {p.profile.display_name}{p.user_id === uid ? " (you)" : ""} — {p.status}
            {" · "}🔥 {p.current_streak}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function ProofImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    supabase.storage.from("proof-media").createSignedUrl(path, 300)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]));
  if (!url) return <Text style={styles.dim}>Loading proof…</Text>;
  return <Image source={{ uri: url }} style={styles.proofImg} resizeMode="cover" />;
}

function StatusPill({ status, winnerId, uid }: { status: string; winnerId: string | null; uid: string }) {
  let text = status, color = colors.gold;
  if (status === "settled") {
    text = winnerId === uid ? "🏆 You won" : winnerId ? "You lost" : "Settled";
    color = winnerId === uid ? colors.green : colors.red;
  }
  return <View style={[styles.pill, { borderColor: color }]}><Text style={[styles.pillText, { color }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800" },
  meta: { color: colors.textDim, marginTop: 4 },
  dim: { color: colors.textDim },
  pill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, marginTop: spacing.sm },
  pillText: { fontWeight: "800", textTransform: "capitalize" },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardH: { color: colors.text, fontWeight: "800", fontSize: 16, marginBottom: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  accept: { backgroundColor: colors.gold },
  decline: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  logBtn: { backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginTop: spacing.sm },
  btnDark: { color: colors.bg, fontWeight: "800" },
  btnLight: { color: colors.text, fontWeight: "700" },
  done: { color: colors.green, fontWeight: "800", marginTop: spacing.sm, fontSize: 16 },
  fail: { color: colors.red, fontWeight: "800", marginTop: spacing.sm, fontSize: 16 },
  pending: { color: colors.yellow, marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  dot: { width: 18, height: 18, borderRadius: 4, backgroundColor: colors.cardAlt },
  player: { color: colors.text, marginBottom: 4 },
  proofImg: { width: "100%", height: 220, borderRadius: radius.md, marginBottom: spacing.sm },
});
