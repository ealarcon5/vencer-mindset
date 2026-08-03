import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { venmoPayUrl, openPayment } from "../../lib/venmo";
import type { LedgerEntry, Profile } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

type Entry = LedgerEntry & { from: Profile; to: Profile };

export default function Wallet() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [entries, setEntries] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from("ledger")
      .select("*, from:profiles!ledger_from_user_fkey(*), to:profiles!ledger_to_user_fkey(*)")
      .or(`from_user.eq.${uid},to_user.eq.${uid}`)
      .order("created_at", { ascending: false });
    setEntries((data ?? []) as any);
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markPaid(id: string) {
    await supabase.from("ledger").update({ status: "marked_paid" }).eq("id", id);
    await load();
  }

  const owed = entries.filter((e) => e.to_user === uid && e.status === "unpaid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const owe = entries.filter((e) => e.from_user === uid && e.status === "unpaid")
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <View style={styles.screen}>
      <View style={styles.summaryRow}>
        <Summary label="You're owed" value={owed} good />
        <Summary label="You owe" value={owe} />
      </View>
      <Text style={styles.note}>
        v1 is track-only — the app never holds your money. It just settles who
        owes whom and hands you a Venmo link. Real escrow comes later.
      </Text>

      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
        data={entries}
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Text style={styles.empty}>No settled bets yet.</Text>}
        renderItem={({ item }) => {
          const iOwe = item.from_user === uid;
          const other = iOwe ? item.to : item.from;
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.line}>
                  {iOwe ? `You owe ${other.display_name}` : `${other.display_name} owes you`}
                </Text>
                <Text style={styles.amount}>${Number(item.amount).toFixed(2)}</Text>
                <Text style={[styles.tag, item.status === "marked_paid" && { color: colors.green }]}>
                  {item.status === "marked_paid" ? "Marked paid" : "Unpaid"}
                </Text>
              </View>
              {iOwe && item.status === "unpaid" && (
                <View style={{ gap: 6 }}>
                  {other.venmo_handle ? (
                    <Pressable style={styles.payBtn} onPress={() =>
                      openPayment(venmoPayUrl({
                        handle: other.venmo_handle!, amount: Number(item.amount),
                        note: "Lost a Stakes bet 😅 — paying up.",
                      }))
                    }>
                      <Text style={styles.payText}>Pay via Venmo</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.markBtn} onPress={() => markPaid(item.id)}>
                    <Text style={styles.markText}>Mark paid</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function Summary({ label, value, good }: { label: string; value: number; good?: boolean }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: good ? colors.green : colors.gold }]}>
        ${value.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  summaryRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  summaryCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { color: colors.textDim, fontSize: 13 },
  summaryValue: { fontSize: 26, fontWeight: "800", marginTop: 4 },
  note: { color: colors.textDim, fontSize: 12, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  line: { color: colors.text, fontWeight: "700" },
  amount: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  tag: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  payBtn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  payText: { color: colors.bg, fontWeight: "800", fontSize: 12 },
  markBtn: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  markText: { color: colors.text, fontWeight: "700", fontSize: 12, textAlign: "center" },
  empty: { color: colors.textDim, textAlign: "center", marginTop: spacing.xl },
});
