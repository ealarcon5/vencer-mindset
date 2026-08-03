import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { registerPushToken } from "../../lib/notifications";
import { deviceTimezone } from "../../lib/time";
import type { Profile } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const uid = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [venmo, setVenmo] = useState("");

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) {
      setProfile(data as Profile);
      setName(data.display_name ?? "");
      setVenmo(data.venmo_handle ?? "");
    }
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    if (!uid) return;
    await supabase.from("profiles").update({
      display_name: name.trim() || "New user",
      venmo_handle: venmo.trim().replace(/^@/, "") || null,
      timezone: deviceTimezone(),
    }).eq("id", uid);
    await registerPushToken(uid);
    Alert.alert("Saved", "Profile updated.");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName}
        placeholder="Emiliano" placeholderTextColor={colors.textDim} />

      <Text style={styles.label}>Venmo handle (for payouts)</Text>
      <TextInput style={styles.input} value={venmo} onChangeText={setVenmo}
        autoCapitalize="none" placeholder="your-venmo" placeholderTextColor={colors.textDim} />

      <Text style={styles.meta}>Timezone: {profile?.timezone ?? deviceTimezone()}</Text>
      <Text style={styles.metaDim}>Deadlines resolve to midnight in this zone.</Text>

      <Pressable style={styles.save} onPress={save}>
        <Text style={styles.saveText}>Save</Text>
      </Pressable>

      <Pressable style={styles.signout} onPress={signOut}>
        <Text style={styles.signoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  label: { color: colors.text, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  meta: { color: colors.text, marginTop: spacing.lg, fontWeight: "600" },
  metaDim: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  save: { backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  saveText: { color: colors.bg, fontWeight: "800" },
  signout: { padding: spacing.md, alignItems: "center", marginTop: spacing.sm },
  signoutText: { color: colors.red, fontWeight: "700" },
});
