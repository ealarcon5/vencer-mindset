import { View, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { Symbol } from "./Symbol";
import { colors, spacing, screen } from "../../constants/theme";

// A large, airy in-screen title header (Apple large-title feel) with an optional
// circular trailing action button. Rendered at the top of each tab screen.
export function Header({
  title,
  subtitle,
  actionSymbol,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionSymbol?: string;
  onAction?: () => void;
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          <Text variant="largeTitle">{title}</Text>
          {subtitle ? <Text variant="subhead" tone="secondary" style={{ marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        {actionSymbol && onAction ? (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onAction(); }}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            hitSlop={10}
          >
            <Symbol name={actionSymbol as any} size={22} color={colors.accent} weight="semibold" />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.grouped },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: screen.margin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleWrap: { flex: 1 },
  action: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xxs,
  },
});
