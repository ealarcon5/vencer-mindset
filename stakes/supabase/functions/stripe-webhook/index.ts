// Edge Function: stripe-webhook
// Source of truth for money events. Verifies Stripe's signature, then:
//   * payment_intent.succeeded → mark that participant funded (activates the bet
//     once both have paid) via the mark_funded() SQL function.
//   * account.updated → keep connected_accounts.payouts_enabled in sync.
//
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// (Stripe calls it directly; it authenticates via the signing secret, not a JWT.)
//
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (e) {
    return new Response(`Bad signature: ${e}`, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { bet_id, user_id, stake } = pi.metadata ?? {};
      if (bet_id && user_id) {
        // Stripe processing fee, if expanded; otherwise 0 here.
        await admin.rpc("mark_funded", {
          p_bet_id: bet_id,
          p_user_id: user_id,
          p_payment_intent: pi.id,
          p_amount: Number(stake ?? pi.amount / 100),
          p_fee: 0,
        });
      }
    } else if (event.type === "account.updated") {
      const acct = event.data.object as Stripe.Account;
      await admin.from("connected_accounts")
        .update({
          payouts_enabled: acct.payouts_enabled ?? false,
          onboarding_status: acct.details_submitted ? "complete" : "pending",
        })
        .eq("stripe_account_id", acct.id);
    }
  } catch (e) {
    return new Response(`Handler error: ${e}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "content-type": "application/json" },
  });
});
