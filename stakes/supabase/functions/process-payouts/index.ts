// Edge Function: process-payouts
// Turns settled bets into money. Runs on a schedule (pg_cron via net.http_post,
// or an external scheduler). For each settled bet with a winner, an unpaid pot,
// and a payout-ready winner, it Transfers the pot minus fees to the winner's
// Express connected account and records it.
//
// Fee model: winner receives pot minus PLATFORM_FEE_PCT (default 1.5%).
// (Stripe processing was already deducted from the platform balance at charge
// time; tune here if you'd rather gross it up.)
//
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLATFORM_FEE_PCT

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FEE_PCT = Number(Deno.env.get("PLATFORM_FEE_PCT") ?? "1.5") / 100;

Deno.serve(async () => {
  // Settled bets that have a winner and a pot but no transfer yet.
  const { data: bets } = await admin
    .from("bets")
    .select("id, winner_id, pot_amount, currency")
    .eq("status", "settled")
    .not("winner_id", "is", null)
    .gt("pot_amount", 0);

  let paid = 0;
  for (const bet of bets ?? []) {
    // Skip if a transfer already exists for this bet.
    const { data: existing } = await admin.from("payments")
      .select("id").eq("bet_id", bet.id).eq("kind", "transfer").maybeSingle();
    if (existing) continue;

    // Winner must have a payout-ready connected account.
    const { data: acct } = await admin.from("connected_accounts")
      .select("stripe_account_id, payouts_enabled").eq("user_id", bet.winner_id).maybeSingle();
    if (!acct?.payouts_enabled) continue; // wait until they finish onboarding

    const pot = Number(bet.pot_amount);
    const fee = round2(pot * FEE_PCT);
    const net = round2(pot - fee);

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(net * 100),
        currency: (bet.currency ?? "USD").toLowerCase(),
        destination: acct.stripe_account_id,
        transfer_group: `bet_${bet.id}`,
        metadata: { bet_id: bet.id, winner_id: bet.winner_id },
      });
      await admin.from("payments").insert({
        bet_id: bet.id, user_id: bet.winner_id, kind: "transfer",
        amount: net, fee, stripe_id: transfer.id, status: "succeeded",
      });
      paid++;
    } catch (e) {
      console.error(`payout failed for bet ${bet.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ paid }), { headers: { "content-type": "application/json" } });
});

function round2(n: number): number { return Math.round(n * 100) / 100; }
