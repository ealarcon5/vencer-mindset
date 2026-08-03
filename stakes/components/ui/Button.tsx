import { Pressable, ActivityIndicator, StyleSheet, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { colors, radius, spacing } from "../../constants/theme";

type Variant = "primary" | "secondary" | "plain" | "destructive";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.full,
        variant === "primary" && { backgroundColor: pressed ? colors.fillPressed : colors.fill },
        variant === "secondary" && { backgroundColor: pressed ? colors.cardPressed : colors.grouped },
        variant === "destructive" && { backgroundColor: pressed ? colors.cardPressed : colors.grouped },
        variant === "plain" && styles.plain,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.textOnDark : colors.accent} />
      ) : (
        <Text
          variant="headline"
          tone={
            variant === "primary" ? "onDark" :
            variant === "destructive" ? "danger" : "accent"
          }
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Two buttons side by side. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  full: { alignSelf: "stretch" },
  plain: { backgroundColor: "transparent", height: 44 },
  disabled: { opacity: 0.4 },
  row: { flexDirection: "row", gap: spacing.md },
});
