import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Alert, ActivityIndicator, Image } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  acceptBet, declineBet, betParticipants, submitProof, confirmProof, disputeProof,
} from "../../lib/bets";
import { fundStake, paymentsAvailable } from "../../lib/stripe";
import { humanCountdown, localDateKey, deviceTimezone } from "../../lib/time";
import type { Bet, BetParticipant, Checkin, Profile } from "../../lib/database.types";
import {
  Text, Card, Button, ButtonRow, Money, Symbol, Avatar,
} from "../../components/ui";
import { colors, spacing, screen, radius } from "../../constants/theme";

type Part = BetParticipant & { profile: Profile; funded: boolean };

export default function BetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const uid = session?.user.id!;
  const [bet, setBet] = useState<Bet | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [myCheckins, setMyCheckins] = useState<Checkin[]>([]);
  const [today, setToday] = useState<Checkin | null>(null);
  const [review, setReview] = useState<{ checkin: Checkin; proofId: string; url?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: b } = await supabase.from("bets").select("*").eq("id", id).single();
    setBet(b as Bet);
    const p = (await betParticipants(id)) as Part[];
    setParts(p);

    const { data: mine } = await supabase.from("checkins").select("*")
      .eq("bet_id", id).eq("user_id", uid).order("local_date");
    setMyCheckins((mine ?? []) as Checkin[]);
    setToday(((mine ?? []) as Checkin[]).find((c) => c.local_date === localDateKey(deviceTimezone())) ?? null);

    const opp = p.find((x) => x.user_id !== uid);
    if (opp) {
      const { data: sub } = await supabase.from("checkins").select("*")
        .eq("bet_id", id).eq("user_id", opp.user_id).eq("status", "submitted")
        .order("local_date", { ascending: false }).limit(1).maybeSingle();
      if (sub) {
        const { data: proof } = await supabase.from("proofs").select("*")
          .eq("checkin_id", (sub as Checkin).id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
        setReview(proof ? { checkin: sub as Checkin, proofId: (proof as any).id, url: (proof as any).media_url } : null);
      } else setReview(null);
    }
    setLoading(false);
  }, [id, uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!bet) return <View style={styles.center}><Text tone="secondary">Bet not found.</Text></View>;

  const me = parts.find((p) => p.user_id === uid);
  const opponent = parts.find((p) => p.user_id !== uid);
  const needsAccept = me?.status === "invited";
  const needsFunding = !needsAccept && !me?.funded && ["invited", "funding"].includes(bet.status);
  const waitingOnOther = me?.funded && opponent && !opponent.funded && bet.status !== "active";

  const stake = Number(bet.stake_amount);
  const pot = Number(bet.pot_amount) || stake * 2;
  const winnerNet = round2(pot * (1 - 0.015));
  const iWon = bet.status === "settled" && bet.winner_id === uid;
  const iLost = Boolean(bet.status === "settled" && bet.winner_id && bet.winner_id !== uid);

  async function onAccept() { setBusy(true); await acceptBet(id, uid); await load(); setBusy(false); }
  async function onDecline() { await declineBet(id, uid); }

  async function pay() {
    if (!paymentsAvailable()) {
      return Alert.alert("Dev build required", "Payments run in an EAS dev build, not Expo Go. The rest of the app works in Expo Go.");
    }
    setBusy(true);
    const { ok, error } = await fundStake(id);
    setBusy(false);
    if (error) Alert.alert("Payment failed", error);
    if (ok) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); load(); }
  }

  async function logProof() {
    if (!today) return;
    let mediaUrl: string | undefined;
    if (bet!.proof_mode === "photo" || bet!.proof_mode === "video") {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: bet!.proof_mode === "video" ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
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
    await submitProof({ checkinId: today.id, userId: uid, proofMode: bet!.proof_mode, mediaUrl });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    load();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {/* Hero */}
      <View style={styles.hero}>
        <Text variant="largeTitle" center>{bet.title}</Text>
        <View style={styles.heroMeta}>
          <Money amount={stake} variant="title3" tone="secondary" />
          <Text variant="title3" tone="tertiary">  ·  {bet.target} {bet.metric}/day</Text>
        </View>
        <OutcomeBadge status={bet.status} iWon={iWon} iLost={iLost} />
      </View>

      {/* Settled */}
      {bet.status === "settled" && (
        <Card style={styles.block}>
          {iWon ? (
            <View style={styles.settled}>
              <Symbol name="trophy.fill" size={40} color={colors.success} />
              <Text variant="title2" style={{ marginTop: spacing.sm }}>You won</Text>
              <Money amount={winnerNet} variant="largeTitle" tone="success" style={{ marginVertical: spacing.xs }} />
              <Text variant="footnote" tone="secondary" center>
                {pot > 0 ? `$${pot.toFixed(0)} pot minus the 1.5% fee, sent to your Stripe balance.` : "Sent to your balance."}
              </Text>
            </View>
          ) : iLost ? (
            <View style={styles.settled}>
              <Symbol name="xmark.circle.fill" size={40} color={colors.danger} />
              <Text variant="title2" style={{ marginTop: spacing.sm }}>You lost this one</Text>
              <Text variant="subhead" tone="secondary" center style={{ marginTop: spacing.xs }}>
                Your stake went to {opponent?.profile.display_name}. Run it back?
              </Text>
            </View>
          ) : (
            <Text variant="headline" center>Bet complete.</Text>
          )}
        </Card>
      )}

      {/* Accept invite */}
      {needsAccept && (
        <Card style={styles.block}>
          <Text variant="headline">{opponent?.profile.display_name} bet you</Text>
          <Text variant="subhead" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            Accept, then pay your ${stake} stake to lock it in. Winner takes {`$${winnerNet.toFixed(2)}`}.
          </Text>
          <ButtonRow>
            <Button label="Decline" variant="destructive" onPress={onDecline} />
            <Button label="Accept" onPress={onAccept} loading={busy} />
          </ButtonRow>
        </Card>
      )}

      {/* Fund */}
      {needsFunding && !needsAccept && (
        <Card style={styles.block}>
          <View style={styles.feeRow}><Text variant="body">Your stake</Text><Money amount={stake} variant="body" /></View>
          <View style={styles.divider} />
          <View style={styles.feeRow}><Text variant="body">Pot if you win</Text><Money amount={winnerNet} variant="body" tone="success" /></View>
          <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            Charged now and held in escrow until the bet settles. Apple Pay supported.
          </Text>
          <Button label={`Pay $${stake.toFixed(0)} to lock in`} onPress={pay} loading={busy} />
        </Card>
      )}

      {waitingOnOther && (
        <Card style={styles.block}>
          <View style={styles.waiting}>
            <Symbol name="hourglass" size={28} color={colors.textTertiary} />
            <Text variant="headline" style={{ marginTop: spacing.sm }}>You're paid in</Text>
            <Text variant="subhead" tone="secondary" center>Waiting for {opponent?.profile.display_name} to pay their stake.</Text>
          </View>
        </Card>
      )}

      {/* Today's proof */}
      {bet.status === "active" && today && (
        <Card style={styles.block}>
          <Text variant="footnote" tone="secondary">TODAY · DUE {humanCountdown(today.due_at).toUpperCase()}</Text>
          {today.status === "verified" ? (
            <View style={styles.todayDone}>
              <Symbol name="checkmark.circle.fill" size={24} color={colors.success} />
              <Text variant="headline" tone="success">Verified{today.verified_by ? ` · ${today.verified_by}` : ""}</Text>
            </View>
          ) : today.status === "failed" ? (
            <View style={styles.todayDone}>
              <Symbol name="xmark.circle.fill" size={24} color={colors.danger} />
              <Text variant="headline" tone="danger">Missed</Text>
            </View>
          ) : today.status === "submitted" ? (
            <Text variant="subhead" tone="secondary" style={{ marginTop: spacing.sm }}>Submitted — waiting for {opponent?.profile.display_name} to confirm.</Text>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Button label="Log today's proof" onPress={logProof} />
            </View>
          )}
        </Card>
      )}

      {/* Review opponent proof */}
      {review && (
        <Card style={styles.block}>
          <Text variant="headline" style={{ marginBottom: spacing.md }}>Confirm {opponent?.profile.display_name}'s proof</Text>
          {review.url ? <ProofImage path={review.url} /> : <Text tone="secondary">Honor submission — no media.</Text>}
          <ButtonRow>
            <Button label="Dispute" variant="destructive" onPress={async () => { await disputeProof(review.checkin.id, review.proofId); load(); }} />
            <Button label="Confirm" onPress={async () => { await confirmProof(review.checkin.id, review.proofId); Haptics.selectionAsync().catch(()=>{}); load(); }} />
          </ButtonRow>
        </Card>
      )}

      {/* Streak grid */}
      {myCheckins.length > 0 && (
        <Card style={styles.block}>
          <Text variant="footnote" tone="secondary">YOUR STREAK</Text>
          <View style={styles.grid}>
            {myCheckins.map((c) => (
              <View key={c.id} style={[
                styles.dot,
                c.status === "verified" && { backgroundColor: colors.success },
                c.status === "failed" && { backgroundColor: colors.danger },
                c.status === "submitted" && { backgroundColor: colors.warning },
              ]} />
            ))}
          </View>
          <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.sm }}>
            {myCheckins.filter((c) => c.status === "verified").length} of {myCheckins.length} days verified
          </Text>
        </Card>
      )}

      {/* Players */}
      <Card style={styles.block}>
        <Text variant="footnote" tone="secondary" style={{ marginBottom: spacing.md }}>PLAYERS</Text>
        {parts.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <Avatar name={p.profile.display_name} size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="body">{p.profile.display_name}{p.user_id === uid ? " (you)" : ""}</Text>
              <Text variant="footnote" tone="secondary">
                {p.funded ? "Paid in" : "Not paid"} · 🔥 {p.current_streak}
              </Text>
            </View>
            {p.funded ? <Symbol name="checkmark.seal.fill" size={18} color={colors.success} /> : null}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function ProofImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    supabase.storage.from("proof-media").createSignedUrl(path, 300).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]));
  if (!url) return <Text tone="secondary">Loading proof…</Text>;
  return <Image source={{ uri: url }} style={styles.proofImg} resizeMode="cover" />;
}

function OutcomeBadge({ status, iWon, iLost }: { status: string; iWon: boolean; iLost: boolean }) {
  let label: string = status;
  let color: string = colors.textSecondary;
  if (status === "active") { label = "Active"; color = colors.fill; }
  else if (status === "funding") { label = "Awaiting payment"; color = colors.warning; }
  else if (status === "invited") { label = "Invite"; color = colors.accent; }
  else if (status === "settled") { label = iWon ? "You won" : iLost ? "You lost" : "Settled"; color = iWon ? colors.success : iLost ? colors.danger : colors.textSecondary; }
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text variant="footnote" style={{ color, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function round2(n: number) { return Math.round(n * 100) / 100; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.grouped },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.grouped },
  content: { paddingTop: 100, paddingBottom: spacing.huge },
  hero: { alignItems: "center", paddingHorizontal: screen.margin, marginBottom: spacing.xl },
  heroMeta: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, marginTop: spacing.md },
  block: { marginBottom: spacing.lg },
  settled: { alignItems: "center", paddingVertical: spacing.sm },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.sm },
  waiting: { alignItems: "center", paddingVertical: spacing.sm },
  todayDone: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  dot: { width: 16, height: 16, borderRadius: 4, backgroundColor: colors.grouped },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  proofImg: { width: "100%", height: 240, borderRadius: radius.md, marginBottom: spacing.md, backgroundColor: colors.grouped },
});
