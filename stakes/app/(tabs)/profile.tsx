import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { registerPushToken } from "../../lib/notifications";
import { deviceTimezone } from "../../lib/time";
import type { Profile } from "../../lib/database.types";
import {
  Header, Text, Field, ListSection, ListRow, Button, Avatar,
} from "../../components/ui";
import { colors, spacing, screen } from "../../constants/theme";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const uid = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) { setProfile(data as Profile); setName(data.display_name ?? ""); }
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    if (!uid) return;
    await supabase.from("profiles").update({
      display_name: name.trim() || "New user",
      timezone: deviceTimezone(),
    }).eq("id", uid);
    await registerPushToken(uid);
    Alert.alert("Saved");
    load();
  }

  return (
    <View style={styles.flex}>
      <Header title="Profile" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive">
        <View style={styles.identity}>
          <Avatar name={name || "?"} size={72} />
          <Text variant="title2" style={{ marginTop: spacing.md }}>{name || "New user"}</Text>
          <Text variant="subhead" tone="secondary">{profile?.phone ?? ""}</Text>
        </View>

        <ListSection header="Your name">
          <View style={styles.fieldRow}>
            <Field value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          </View>
        </ListSection>

        <ListSection header="Details" footer={`Deadlines resolve to midnight in your timezone.`}>
          <ListRow title="Timezone" value={profile?.timezone ?? deviceTimezone()} leadingSymbol="clock.fill" leadingColor={colors.textTertiary} />
          <ListRow title="Notifications" subtitle="Deadline reminders & results" leadingSymbol="bell.fill" leadingColor={colors.textTertiary} />
        </ListSection>

        <ListSection>
          <ListRow title="Terms of Service" leadingSymbol="doc.text.fill" leadingColor={colors.textTertiary} showChevron onPress={() => {}} />
          <ListRow title="Privacy Policy" leadingSymbol="hand.raised.fill" leadingColor={colors.textTertiary} showChevron onPress={() => {}} />
        </ListSection>

        <View style={styles.actions}>
          <Button label="Save" onPress={save} />
          <Button label="Sign out" variant="destructive" onPress={signOut} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingBottom: 120 },
  identity: { alignItems: "center", paddingVertical: spacing.lg },
  fieldRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  actions: { paddingHorizontal: screen.margin, gap: spacing.md, marginTop: spacing.sm },
});
