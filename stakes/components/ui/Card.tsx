import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, spacing, screen, shadow } from "../../constants/theme";

// A free-standing rounded card (for hero content that isn't a list row).
export function Card({
  children,
  onPress,
  padded = true,
  inset = true,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  inset?: boolean;
  style?: ViewStyle;
}) {
  const s = [
    styles.card,
    inset && { marginHorizontal: screen.margin },
    padded && styles.padded,
    style,
  ];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { backgroundColor: colors.cardPressed }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow.card },
  padded: { padding: spacing.lg },
});
