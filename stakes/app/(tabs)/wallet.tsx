import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { getConnectedAccount, startPayoutOnboarding, paymentsAvailable } from "../../lib/stripe";
import {
  Header, Text, Card, Money, ListSection, ListRow, Button,
} from "../../components/ui";
import { colors, spacing, screen } from "../../constants/theme";

type Payment = {
  id: string; kind: "charge" | "transfer" | "refund"; amount: number;
  created_at: string; bets: { title: string; status: string } | null;
};

export default function Wallet() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("payments")
      .select("id, kind, amount, created_at, bets(title, status)")
      .eq("user_id", uid).order("created_at", { ascending: false });
    setPayments((data ?? []) as any);
    const acct = await getConnectedAccount(uid);
    setPayoutsEnabled(!!acct?.payouts_enabled);
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const inPlay = payments
    .filter((p) => p.kind === "charge" && p.bets && ["active", "funding"].includes(p.bets.status))
    .reduce((s, p) => s + Number(p.amount), 0);
  const won = payments.filter((p) => p.kind === "transfer").reduce((s, p) => s + Number(p.amount), 0);

  async function setupPayouts() {
    if (!paymentsAvailable()) {
      return Alert.alert("Dev build required", "Payments run in an EAS dev build, not Expo Go.");
    }
    setBusy(true);
    const { error } = await startPayoutOnboarding();
    setBusy(false);
    if (error) Alert.alert("Couldn't start onboarding", error);
    else load();
  }

  return (
    <View style={styles.flex}>
      <Header title="Wallet" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {/* Balance hero */}
        <Card style={styles.hero}>
          <Text variant="footnote" tone="secondary">IN ESCROW</Text>
          <Money amount={inPlay} variant="largeTitle" style={{ marginTop: spacing.xs }} />
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text variant="footnote" tone="secondary">Won all-time</Text>
              <Money amount={won} variant="headline" tone="success" />
            </View>
          </View>
        </Card>

        {/* Payout readiness */}
        <ListSection footer="Held stakes are paid out to your Stripe balance when you win. You need a verified payout account to receive money.">
          <ListRow
            title={payoutsEnabled ? "Payouts ready" : "Set up payouts"}
            subtitle={payoutsEnabled ? "You can receive winnings" : "Verify your identity with Stripe (2 min)"}
            leadingSymbol={payoutsEnabled ? "checkmark.seal.fill" : "banknote.fill"}
            leadingColor={payoutsEnabled ? colors.success : colors.fill}
            onPress={payoutsEnabled ? undefined : setupPayouts}
            showChevron={!payoutsEnabled}
          />
        </ListSection>

        {!payoutsEnabled && (
          <View style={{ paddingHorizontal: screen.margin, marginTop: -spacing.md, marginBottom: spacing.xxl }}>
            <Button label="Set up payouts" onPress={setupPayouts} loading={busy} />
          </View>
        )}

        {/* History */}
        {payments.length > 0 && (
          <ListSection header="Activity">
            {payments.map((p) => (
              <ListRow
                key={p.id}
                title={p.bets?.title ?? (p.kind === "transfer" ? "Payout" : "Payment")}
                subtitle={label(p.kind)}
                leadingSymbol={p.kind === "transfer" ? "arrow.down.circle.fill" : p.kind === "refund" ? "arrow.uturn.left.circle.fill" : "lock.circle.fill"}
                leadingColor={p.kind === "transfer" ? colors.success : colors.textTertiary}
                rightElement={
                  <Money
                    amount={Number(p.amount)}
                    variant="body"
                    tone={p.kind === "transfer" ? "success" : "secondary"}
                    style={{ fontWeight: "600" }}
                  />
                }
              />
            ))}
          </ListSection>
        )}
      </ScrollView>
    </View>
  );
}

function label(kind: string) {
  return kind === "transfer" ? "Winnings received"
    : kind === "refund" ? "Refunded"
    : "Held in escrow";
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingBottom: 120 },
  hero: { marginBottom: spacing.xxl, marginTop: spacing.xs },
  heroRow: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.xl },
  heroStat: { gap: 2 },
});
