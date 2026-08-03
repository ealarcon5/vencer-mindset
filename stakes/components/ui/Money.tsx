import { Text as RNText, TextStyle } from "react-native";
import { colors, numeric, typography as typeScale } from "../../constants/theme";

// Consistent currency formatting with tabular figures.
export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function Money({
  amount,
  currency = "USD",
  variant = "body",
  tone,
  style,
}: {
  amount: number;
  currency?: string;
  variant?: keyof typeof typeScale;
  tone?: "primary" | "secondary" | "success" | "danger";
  style?: TextStyle;
}) {
  const color =
    tone === "success" ? colors.success :
    tone === "danger" ? colors.danger :
    tone === "secondary" ? colors.textSecondary : colors.text;
  return (
    <RNText style={[typeScale[variant] as any, numeric, { color }, style]}>
      {formatMoney(amount, currency)}
    </RNText>
  );
}
