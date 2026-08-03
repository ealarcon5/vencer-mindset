// Minimal hand-written types for the tables the app touches. Once your schema
// is live you can regenerate a full version with:
//   npx supabase gen types typescript --project-id <ref> > lib/database.types.ts

export type BetType = "daily_habit" | "head_to_head" | "bounty";
export type BetStatus = "draft" | "invited" | "funding" | "active" | "settled" | "canceled";
export type ParticipantStatus =
  | "invited" | "active" | "failed" | "won" | "declined";
export type CheckinStatus = "pending" | "submitted" | "verified" | "failed";
export type VerifiedBy = "health" | "ai" | "friend" | "auto" | "auto_miss" | null;

export interface Profile {
  id: string;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  venmo_handle: string | null;
  push_token: string | null;
  created_at: string;
}

export interface Bet {
  id: string;
  creator_id: string;
  type: BetType;
  title: string;
  metric: string;
  target: number;
  start_date: string;
  end_date: string;
  deadline_local_time: string;
  stake_amount: number;
  currency: string;
  rest_days_allowed: number;
  proof_mode: string;
  status: BetStatus;
  winner_id: string | null;
  funding_status: string;
  pot_amount: number;
  created_at: string;
}

export interface BetParticipant {
  id: string;
  bet_id: string;
  user_id: string;
  role: string;
  status: ParticipantStatus;
  current_streak: number;
  missed_count: number;
  accepted_at: string | null;
  funded: boolean;
  payment_intent_id: string | null;
}

export interface Checkin {
  id: string;
  bet_id: string;
  user_id: string;
  due_at: string;
  local_date: string;
  status: CheckinStatus;
  verified_by: VerifiedBy;
}

export interface LedgerEntry {
  id: string;
  bet_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  currency: string;
  status: "unpaid" | "marked_paid";
  created_at: string;
}
