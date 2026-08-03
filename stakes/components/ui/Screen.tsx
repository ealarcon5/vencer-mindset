import { ScrollView, View, StyleSheet, RefreshControl, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, screen } from "../../constants/theme";

// Standard screen chrome: grouped background + safe area. `scroll` wraps content
// in a ScrollView (default). Pair with a native large-title header from the
// navigator for the Apple feel.
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  style?: ViewStyle;
}) {
  const inner = padded ? <View style={styles.padded}>{children}</View> : children;

  if (!scroll) {
    return <SafeAreaView edges={["bottom"]} style={[styles.flex, style]}>{inner}</SafeAreaView>;
  }
  return (
    <ScrollView
      style={[styles.flex, style]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {inner}
    </ScrollView>
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.huge },
  padded: { paddingHorizontal: screen.margin },
});
