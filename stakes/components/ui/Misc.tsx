import { View, TextInput, Pressable, StyleSheet, TextInputProps } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./Text";
import { Symbol } from "./Symbol";
import { colors, radius, spacing, screen } from "../../constants/theme";

// --- Avatar --------------------------------------------------------------
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text variant="headline" tone="secondary">{(name || "?").charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// --- Stat (big numeral + label) -----------------------------------------
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title1">{value}</Text>
      <Text variant="footnote" tone="secondary">{label}</Text>
    </View>
  );
}

// --- EmptyState ----------------------------------------------------------
export function EmptyState({
  symbol, title, message,
}: { symbol: string; title: string; message?: string }) {
  return (
    <View style={styles.empty}>
      <Symbol name={symbol as any} size={44} color={colors.textTertiary} />
      <Text variant="title3" style={{ marginTop: spacing.md }}>{title}</Text>
      {message ? <Text variant="subhead" tone="secondary" center style={{ marginTop: spacing.xs }}>{message}</Text> : null}
    </View>
  );
}

// --- Field (labeled text input) -----------------------------------------
export function Field({
  label, hint, style, ...rest
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text variant="footnote" tone="secondary" style={styles.fieldLabel}>{label.toUpperCase()}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, style]}
        {...rest}
      />
      {hint ? <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>{hint}</Text> : null}
    </View>
  );
}

// --- Segmented control ---------------------------------------------------
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(opt); }}
            style={[styles.segmentItem, active && styles.segmentActive]}
          >
            <Text variant="subhead" tone={active ? "primary" : "secondary"}
              style={active ? { fontWeight: "600" } : undefined}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.grouped, alignItems: "center", justifyContent: "center" },
  stat: { alignItems: "center", gap: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.huge, paddingHorizontal: screen.margin },
  fieldLabel: { marginBottom: spacing.xs, marginLeft: spacing.xs },
  input: {
    height: 50, backgroundColor: colors.card, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, fontSize: 17, color: colors.text,
  },
  segment: { flexDirection: "row", backgroundColor: colors.grouped, borderRadius: radius.md, padding: 2 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.card, ...{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } },
});
