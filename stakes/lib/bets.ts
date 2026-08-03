// Client-side bet operations. These wrap Supabase queries so screens stay thin.

import { supabase } from "./supabase";
import { localDateKey } from "./time";
import type { Bet, BetParticipant, Checkin, Profile } from "./database.types";

export type CreateBetInput = {
  opponentId: string;
  title: string;
  metric: string;          // reps | pages | miles | minutes
  target: number;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  deadlineLocalTime: string; // "23:59"
  stakeAmount: number;
  restDaysAllowed: number;
  proofMode: string;       // honor | photo | video | health
};

/** Create a daily-habit bet and invite the opponent. Bet starts as 'invited'. */
export async function createBet(creatorId: string, input: CreateBetInput) {
  const { data: bet, error } = await supabase
    .from("bets")
    .insert({
      creator_id: creatorId,
      type: "daily_habit",
      title: input.title,
      metric: input.metric,
      target: input.target,
      start_date: input.startDate,
      end_date: input.endDate,
      deadline_local_time: input.deadlineLocalTime,
      stake_amount: input.stakeAmount,
      rest_days_allowed: input.restDaysAllowed,
      proof_mode: input.proofMode,
      status: "invited",
    })
    .select()
    .single();
  if (error || !bet) throw error;

  const { error: pErr } = await supabase.from("bet_participants").insert([
    { bet_id: bet.id, user_id: creatorId, role: "creator", status: "active", accepted_at: new Date().toISOString() },
    { bet_id: bet.id, user_id: input.opponentId, role: "opponent", status: "invited" },
  ]);
  if (pErr) throw pErr;

  return bet as Bet;
}

/** Opponent accepts an invite → activate the bet and generate the check-in grid. */
export async function acceptBet(betId: string, userId: string) {
  await supabase
    .from("bet_participants")
    .update({ status: "active", accepted_at: new Date().toISOString() })
    .eq("bet_id", betId)
    .eq("user_id", userId);
  // activate_bet is a SECURITY DEFINER function that flips status + builds checkins.
  const { error } = await supabase.rpc("activate_bet", { p_bet_id: betId });
  if (error) throw error;
}

export async function declineBet(betId: string, userId: string) {
  await supabase.from("bet_participants")
    .update({ status: "declined" }).eq("bet_id", betId).eq("user_id", userId);
  await supabase.from("bets").update({ status: "canceled" }).eq("id", betId);
}

/** Today's check-in for the given bet + user, in the user's timezone. */
export async function todaysCheckin(betId: string, userId: string, tz: string) {
  const key = localDateKey(tz);
  const { data } = await supabase
    .from("checkins")
    .select("*")
    .eq("bet_id", betId)
    .eq("user_id", userId)
    .eq("local_date", key)
    .maybeSingle();
  return data as Checkin | null;
}

/**
 * Submit proof for a check-in. In honor mode this immediately verifies (the
 * opponent can still dispute); with media it inserts a proof row that a friend
 * confirms or that verify-proof (AI) can evaluate.
 */
export async function submitProof(opts: {
  checkinId: string;
  userId: string;
  proofMode: string;
  mediaUrl?: string;
  reportedValue?: number;
}) {
  const source =
    opts.proofMode === "video" ? "video" :
    opts.proofMode === "photo" ? "photo" :
    opts.proofMode === "health" ? "healthkit" : "manual";

  await supabase.from("proofs").insert({
    checkin_id: opts.checkinId,
    user_id: opts.userId,
    media_url: opts.mediaUrl ?? null,
    source,
    reported_value: opts.reportedValue ?? null,
  });

  // Honor mode: mark submitted+verified right away (trust, dispute later).
  if (opts.proofMode === "honor") {
    await supabase.from("checkins")
      .update({ status: "verified", verified_by: "friend" })
      .eq("id", opts.checkinId);
  } else {
    await supabase.from("checkins")
      .update({ status: "submitted" })
      .eq("id", opts.checkinId);
  }
}

/** Opponent confirms a submitted proof → verify the check-in. */
export async function confirmProof(checkinId: string, proofId: string) {
  await supabase.from("proofs")
    .update({ friend_confirmation: "confirmed" }).eq("id", proofId);
  await supabase.from("checkins")
    .update({ status: "verified", verified_by: "friend" }).eq("id", checkinId);
}

/** Opponent disputes → knock the check-in back to pending for a re-submit. */
export async function disputeProof(checkinId: string, proofId: string) {
  await supabase.from("proofs")
    .update({ friend_confirmation: "disputed" }).eq("id", proofId);
  await supabase.from("checkins")
    .update({ status: "pending", verified_by: null }).eq("id", checkinId);
}

/** All bets the user participates in, newest first. */
export async function myBets(userId: string): Promise<Bet[]> {
  const { data: parts } = await supabase
    .from("bet_participants").select("bet_id").eq("user_id", userId);
  const ids = (parts ?? []).map((p: any) => p.bet_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("bets").select("*").in("id", ids).order("created_at", { ascending: false });
  return (data ?? []) as Bet[];
}

export async function betParticipants(betId: string): Promise<(BetParticipant & { profile: Profile })[]> {
  const { data } = await supabase
    .from("bet_participants")
    .select("*, profile:profiles(*)")
    .eq("bet_id", betId);
  return (data ?? []) as any;
}
