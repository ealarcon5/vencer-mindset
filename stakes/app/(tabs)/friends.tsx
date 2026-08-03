import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import * as Contacts from "expo-contacts";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/database.types";
import {
  Header, Text, Field, ListSection, ListRow, Button, EmptyState,
} from "../../components/ui";
import { colors, spacing, screen } from "../../constants/theme";

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

  async function syncContacts() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") return Alert.alert("Contacts permission needed");
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const numbers = data.flatMap((c) => (c.phoneNumbers ?? []).map((p) =>
      "+1" + (p.number ?? "").replace(/\D/g, "").replace(/^1/, "")));
    if (!numbers.length) return Alert.alert("No contacts with phone numbers found");
    const { data: matches } = await supabase.from("profiles").select("*").in("phone", numbers).neq("id", uid);
    setResults((matches ?? []) as Profile[]);
    if (!matches?.length) Alert.alert("None of your contacts are on Stakes yet", "Invite them to join!");
  }

  async function addFriend(friendId: string) {
    if (!uid) return;
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
    const { data } = await supabase.from("profiles").select("*")
      .ilike("display_name", `%${q}%`).neq("id", uid).limit(10);
    setResults((data ?? []) as Profile[]);
  }

  const showing = results.length ? results : friends;

  return (
    <View style={styles.flex}>
      <Header title="Friends" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive">
        <View style={styles.searchWrap}>
          <Field placeholder="Search by name" value={search} onChangeText={searchByName} autoCapitalize="words" />
          <Button label="Find friends from contacts" variant="secondary" onPress={syncContacts} />
        </View>

        {showing.length === 0 ? (
          <EmptyState symbol="person.2" title="No friends yet" message="Sync your contacts to see who's already on Stakes." />
        ) : (
          <ListSection header={results.length ? "Results" : "Your friends"}>
            {showing.map((p) => {
              const isFriend = friends.some((f) => f.id === p.id);
              return (
                <ListRow
                  key={p.id}
                  title={p.display_name}
                  subtitle={isFriend ? "Friends" : undefined}
                  rightElement={
                    !isFriend ? (
                      <Text variant="subhead" tone="accent" onPress={() => addFriend(p.id)} style={{ fontWeight: "600" }}>Add</Text>
                    ) : undefined
                  }
                />
              );
            })}
          </ListSection>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingBottom: 120 },
  searchWrap: { paddingHorizontal: screen.margin, gap: spacing.sm, marginBottom: spacing.lg },
});
