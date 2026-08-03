// Edge Function: send-reminders
// -----------------------------------------------------------------------------
// Sends push nudges for check-ins that are still pending and due within the
// next `windowMinutes`. Intended to be invoked on a schedule (pg_cron ->
// net.http_post, or an external scheduler) a few times an evening.
//
// Uses Expo's push API so it works for both dev (Expo Go) and standalone builds.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const windowMinutes = 120; // remind people with <2h left
  const now = new Date();
  const soon = new Date(now.getTime() + windowMinutes * 60_000).toISOString();

  const { data: checkins, error } = await admin
    .from("checkins")
    .select("id, user_id, due_at, bets(title), profiles:user_id(push_token, display_name)")
    .eq("status", "pending")
    .gte("due_at", now.toISOString())
    .lte("due_at", soon);

  if (error) return new Response(error.message, { status: 500 });

  const messages = (checkins ?? [])
    .filter((c: any) => c.profiles?.push_token)
    .map((c: any) => ({
      to: c.profiles.push_token,
      sound: "default",
      title: "Prove it before midnight ⏳",
      body: `Your "${c.bets?.title}" bet is due soon — log today's proof or you lose.`,
      data: { checkin_id: c.id },
    }));

  if (messages.length) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(messages),
    });
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "content-type": "application/json" },
  });
});
