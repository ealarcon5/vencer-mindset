// Stakes design system — "light & airy, as if Apple made it."
// Monochrome canvas + a single restrained accent. Hierarchy comes from type
// size, weight, and whitespace — not color. Everything in the app reads from
// these tokens so the UI stays one coherent system (that's what stops it
// looking live-coded).

import { Platform, TextStyle } from "react-native";

export const colors = {
  // Surfaces
  bg: "#FFFFFF",            // primary canvas
  grouped: "#F2F2F7",       // iOS systemGroupedBackground (screen behind cards)
  card: "#FFFFFF",          // inset grouped card
  cardPressed: "#F5F5F7",
  separator: "#E5E5EA",     // hairline
  separatorStrong: "#D1D1D6",

  // Text
  text: "#1D1D1F",          // Apple near-black
  textSecondary: "#6E6E73",
  textTertiary: "#8E8E93",
  textOnDark: "#FFFFFF",

  // The single accent — interactive text / active states only.
  accent: "#0071E3",
  accentPressed: "#0060C0",

  // Primary action fill (Apple-style black button).
  fill: "#1D1D1F",
  fillPressed: "#000000",

  // Outcome-only semantics (used sparingly, on results).
  success: "#34C759",
  danger: "#FF3B30",
  warning: "#FF9F0A",

  // Overlays
  scrim: "rgba(0,0,0,0.4)",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

// 4-pt spacing scale.
export const spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
} as const;

export const screen = { margin: 20 } as const;

// System font (SF Pro on iOS). We never ship a custom font — the system face
// *is* the Apple look.
const systemFont = Platform.select({ ios: undefined, default: undefined });

// Type scale mirroring iOS text styles. Hierarchy = size + weight.
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.37 },
  title1:     { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: 0.36 },
  title2:     { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: 0.35 },
  title3:     { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: 0.38 },
  headline:   { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.43 },
  body:       { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.43 },
  callout:    { fontSize: 16, lineHeight: 21, fontWeight: "400", letterSpacing: -0.32 },
  subhead:    { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.23 },
  footnote:   { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.08 },
  caption:    { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
} satisfies Record<string, TextStyle>;

// Big numerals (stakes, streaks, countdowns) look best tabular + tight.
export const numeric: TextStyle = {
  fontVariant: ["tabular-nums"],
  fontFamily: systemFont,
};

export const shadow = {
  // Whisper-soft elevation; we prefer hairline borders to heavy shadows.
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
} as const;
