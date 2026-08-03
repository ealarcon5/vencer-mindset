import { SymbolView, SymbolViewProps } from "expo-symbols";
import { OpaqueColorValue, Platform, Text } from "react-native";
import { colors } from "../../constants/theme";

// Thin wrapper over SF Symbols. On Android (or if a glyph is missing) it simply
// renders nothing rather than an emoji — the app is iOS-first.
export function Symbol({
  name,
  size = 22,
  color = colors.text,
  weight = "regular",
}: {
  name: SymbolViewProps["name"];
  size?: number;
  color?: string | OpaqueColorValue;
  weight?: SymbolViewProps["weight"];
}) {
  if (Platform.OS !== "ios") return <Text> </Text>;
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color as any}
      weight={weight}
      resizeMode="scaleAspectFit"
    />
  );
}
