// Edge Function: create-stake-payment
// Creates the PaymentIntent (+ ephemeral key + customer) that the app's Stripe
// PaymentSheet needs so the caller can pay their stake into escrow (the platform
// balance). Apple Pay is offered automatically by PaymentSheet.
//
// Body: { bet_id }
// Env: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const { bet_id } = await req.json();

    // Verify the caller is a participant and hasn't already funded.
    const { data: part } = await admin.from("bet_participants")
      .select("*, bets(stake_amount, currency, title)")
      .eq("bet_id", bet_id).eq("user_id", user.id).maybeSingle();
    if (!part) return json({ error: "not a participant" }, 403);
    if (part.funded) return json({ error: "already funded" }, 400);

    const stake = Number((part as any).bets.stake_amount);
    const currency = ((part as any).bets.currency ?? "USD").toLowerCase();
    const amountCents = Math.round(stake * 100);

    // Reuse or create the Stripe customer for this payer.
    let { data: sc } = await admin.from("stripe_customers").select("*").eq("user_id", user.id).maybeSingle();
    let customerId = sc?.stripe_customer_id;
    if (!customerId) {
      const c = await stripe.customers.create({ metadata: { user_id: user.id } });
      customerId = c.id;
      await admin.from("stripe_customers").insert({ user_id: user.id, stripe_customer_id: customerId });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId }, { apiVersion: "2024-06-20" },
    );

    // Charge to the PLATFORM (no destination) → funds are escrowed in platform
    // balance until settlement. transfer_group ties the pot together.
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      customer: customerId,
      transfer_group: `bet_${bet_id}`,
      description: `Stake for "${(part as any).bets.title}"`,
      metadata: { bet_id, user_id: user.id, stake: String(stake) },
      automatic_payment_methods: { enabled: true },
    });

    return json({
      paymentIntent: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY"),
      amount: stake,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
