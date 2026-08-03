import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, Alert } from "react-native";
import * as Contacts from "expo-contacts";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/database.types";
import { colors, spacing, radius } from "../../constants/theme";

export default function Friends() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [friends, setFriends] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  const loadFriends = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from("friendships")
      .select("friend:profiles!friendships_friend_id_fkey(*)")
      .eq("user_id", uid).eq("status", "accepted");
    setFriends((data ?? []).map((r: any) => r.friend));
  }, [uid]);

  useFocusEffect(useCallback(() => { loadFriends(); }, [loadFriends]));

  // Match device contacts against registered users by phone number.
  async function syncContacts() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") return Alert.alert("Contacts permission needed");
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const numbers = data.flatMap((c) => (c.phoneNumbers ?? []).map((p) =>
      "+1" + (p.number ?? "").replace(/\D/g, "").replace(/^1/, ""),
    ));
    if (!numbers.length) return;
    const { data: matches } = await supabase
      .from("profiles").select("*").in("phone", numbers).neq("id", uid);
    setResults((matches ?? []) as Profile[]);
  }

  async function addFriend(friendId: string) {
    if (!uid) return;
    // Insert both directions so either party sees the friendship.
    await supabase.from("friendships").insert([
      { user_id: uid, friend_id: friendId, status: "accepted" },
      { user_id: friendId, friend_id: uid, status: "accepted" },
    ]);
    await loadFriends();
    setResults((r) => r.filter((p) => p.id !== friendId));
  }

  async function searchByName(q: string) {
    setSearch(q);
    if (q.length < 2) return setResults([]);
    const { data } = await supabase
      .from("profiles").select("*").ilike("display_name", `%${q}%`).neq("id", uid).limit(10);
    setResults((data ?? []) as Profile[]);
  }

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.md }}>
        <TextInput
          style={styles.input}
          placeholder="Search people by name"
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={searchByName}
        />
        <Pressable style={styles.syncBtn} onPress={syncContacts}>
          <Text style={styles.syncText}>📇 Find friends from contacts</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 120 }}
        data={results.length ? results : friends}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <Text style={styles.section}>{results.length ? "Results" : "Your friends"}</Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>No friends yet — sync your contacts.</Text>}
        renderItem={({ item }) => {
          const isFriend = friends.some((f) => f.id === item.id);
          return (
            <View style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>
                {item.display_name.charAt(0).toUpperCase()}
              </Text></View>
              <Text style={styles.name}>{item.display_name}</Text>
              {!isFriend && (
                <Pressable style={styles.addBtn} onPress={() => addFriend(item.id)}>
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  input: {
    backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  syncBtn: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  syncText: { color: colors.gold, fontWeight: "700" },
  section: { color: colors.textDim, fontWeight: "700", marginBottom: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  avatarText: { color: colors.bg, fontWeight: "800" },
  name: { color: colors.text, flex: 1, fontSize: 16 },
  addBtn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  addText: { color: colors.bg, fontWeight: "800" },
  empty: { color: colors.textDim, textAlign: "center", marginTop: spacing.xl },
});
