import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Symbol } from "../../components/ui/Symbol";
import { colors } from "../../constants/theme";

// SF Symbol tab icons + a translucent blurred tab bar (iOS material). Screens
// render their own large-title Header, so the navigator header stays hidden.
const ICONS: Record<string, string> = {
  index: "house.fill",
  bets: "target",
  friends: "person.2.fill",
  wallet: "creditcard.fill",
  profile: "person.crop.circle",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: true,
        tabBarStyle: Platform.OS === "ios"
          ? { position: "absolute", borderTopColor: colors.separator, backgroundColor: "transparent" }
          : { backgroundColor: colors.bg, borderTopColor: colors.separator },
        tabBarBackground: () =>
          Platform.OS === "ios"
            ? <BlurView tint="light" intensity={80} style={StyleSheet.absoluteFill} />
            : null,
        tabBarIcon: ({ color, focused }) => (
          <Symbol
            name={ICONS[route.name] as any}
            size={24}
            color={color}
            weight={focused ? "semibold" : "regular"}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="bets" options={{ title: "Bets" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
