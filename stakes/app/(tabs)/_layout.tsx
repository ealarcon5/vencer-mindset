import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../constants/theme";

// Simple emoji tab icons keep the scaffold dependency-free. Swap for an icon
// set (e.g. @expo/vector-icons) whenever you like.
function Icon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.gold, fontWeight: "800", letterSpacing: 2 },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "STAKES", tabBarLabel: "Home",
        tabBarIcon: ({ color }) => <Icon glyph="🏠" color={color} /> }} />
      <Tabs.Screen name="bets" options={{ title: "BETS", tabBarLabel: "Bets",
        tabBarIcon: ({ color }) => <Icon glyph="🎯" color={color} /> }} />
      <Tabs.Screen name="friends" options={{ title: "FRIENDS", tabBarLabel: "Friends",
        tabBarIcon: ({ color }) => <Icon glyph="👥" color={color} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "WALLET", tabBarLabel: "Wallet",
        tabBarIcon: ({ color }) => <Icon glyph="💸" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "PROFILE", tabBarLabel: "Profile",
        tabBarIcon: ({ color }) => <Icon glyph="👤" color={color} /> }} />
    </Tabs>
  );
}
