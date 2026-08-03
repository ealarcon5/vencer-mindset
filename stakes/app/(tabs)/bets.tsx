import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { myBets } from "../../lib/bets";
import type { Bet } from "../../lib/database.types";
import {
  Header, ListSection, ListRow, Money, Segmented, EmptyState,
} from "../../components/ui";
import { colors, spacing, screen } from "../../constants/theme";

type Filter = "Active" | "Invites" | "History";

export default function Bets() {
  const { session } = useAuth();
  const router = useRouter();
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState<Filter>("Active");
  const uid = session?.user.id;

  useFocusEffect(useCallback(() => {
    if (uid) myBets(uid).then(setBets);
  }, [uid]));

  const filtered = useMemo(() => bets.filter((b) => {
    if (filter === "Active") return b.status === "active" || b.status === "funding";
    if (filter === "Invites") return b.status === "invited" || b.status === "draft";
    return b.status === "settled" || b.status === "canceled";
  }), [bets, filter]);

  return (
    <View style={styles.flex}>
      <Header title="Bets" actionSymbol="plus" onAction={() => router.push("/bet/create")} />
      <View style={styles.filter}>
        <Segmented options={["Active", "Invites", "History"]} value={filter} onChange={(v) => setFilter(v as Filter)} />
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {filtered.length === 0 ? (
          <EmptyState symbol="tray" title={`No ${filter.toLowerCase()} bets`} />
        ) : (
          <ListSection>
            {filtered.map((b) => (
              <ListRow
                key={b.id}
                title={b.title}
                subtitle={`${b.target} ${b.metric}/day · ${b.start_date} → ${b.end_date}`}
                leadingSymbol={symbolFor(b.status)}
                leadingColor={colorFor(b.status)}
                onPress={() => router.push(`/bet/${b.id}`)}
                showChevron
                rightElement={<Money amount={Number(b.stake_amount)} variant="subhead" tone="secondary" />}
              />
            ))}
          </ListSection>
        )}
      </ScrollView>
    </View>
  );
}

function symbolFor(status: string): string {
  return status === "settled" ? "checkmark.seal.fill"
    : status === "active" ? "flame.fill"
    : status === "funding" ? "creditcard.fill"
    : status === "canceled" ? "xmark" : "envelope.fill";
}
function colorFor(status: string): string {
  return status === "settled" ? colors.success
    : status === "active" ? colors.fill
    : status === "canceled" ? colors.textTertiary : colors.accent;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.grouped },
  filter: { paddingHorizontal: screen.margin, paddingBottom: spacing.md },
  content: { paddingBottom: 120 },
});
