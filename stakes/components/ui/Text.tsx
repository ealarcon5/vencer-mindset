import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { colors, typography as typeScale } from "../../constants/theme";

type Variant = keyof typeof typeScale;
type Tone = "primary" | "secondary" | "tertiary" | "accent" | "onDark" | "success" | "danger";

const TONE: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  accent: colors.accent,
  onDark: colors.textOnDark,
  success: colors.success,
  danger: colors.danger,
};

export function Text({
  variant = "body",
  tone = "primary",
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; center?: boolean }) {
  return (
    <RNText
      style={[
        typeScale[variant] as any,
        { color: TONE[tone] },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({ center: { textAlign: "center" } });
