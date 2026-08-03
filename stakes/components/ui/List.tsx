import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import { Text } from "./Text";
import { Symbol } from "./Symbol";
import { colors, radius, spacing, screen } from "../../constants/theme";

// Inset grouped list — the iOS Settings look. A ListSection renders an optional
// uppercase header + a rounded white card; ListRows stack inside with hairline
// separators between them.

export function ListSection({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={[styles.section, style]}>
      {header ? <Text variant="footnote" tone="secondary" style={styles.header}>{header.toUpperCase()}</Text> : null}
      <View style={styles.card}>
        {rows.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text variant="footnote" tone="tertiary" style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  value,
  leadingSymbol,
  leadingColor,
  onPress,
  showChevron,
  danger,
  rightElement,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  leadingSymbol?: string;
  leadingColor?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  rightElement?: React.ReactNode;
}) {
  const content = (
    <>
      {leadingSymbol ? (
        <View style={[styles.iconWrap, { backgroundColor: leadingColor ?? colors.grouped }]}>
          <Symbol name={leadingSymbol as any} size={17} color={leadingColor ? colors.textOnDark : colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text variant="body" tone={danger ? "danger" : "primary"}>{title}</Text>
        {subtitle ? <Text variant="footnote" tone="secondary">{subtitle}</Text> : null}
      </View>
      {value ? <Text variant="body" tone="secondary">{value}</Text> : null}
      {rightElement}
      {showChevron ? <Symbol name="chevron.right" size={14} color={colors.textTertiary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardPressed }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  header: { marginLeft: screen.margin, marginBottom: spacing.sm },
  footer: { marginHorizontal: screen.margin, marginTop: spacing.sm },
  card: {
    marginHorizontal: screen.margin,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.card,
  },
  rowText: { flex: 1, gap: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.lg },
  iconWrap: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
