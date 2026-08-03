// Edge Function: connect-onboard
// Creates (or reuses) a Stripe Express connected account for the caller so they
// can RECEIVE payouts, and returns an onboarding link to open in-app.
//
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    // Reuse an existing connected account, else create one.
    let { data: existing } = await admin
      .from("connected_accounts").select("*").eq("user_id", user.id).maybeSingle();

    let accountId = existing?.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { transfers: { requested: true } },
        metadata: { user_id: user.id },
      });
      accountId = account.id;
      await admin.from("connected_accounts").insert({
        user_id: user.id, stripe_account_id: accountId, onboarding_status: "pending",
      });
    }

    const returnUrl = Deno.env.get("APP_RETURN_URL") ?? "stakes://wallet";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return json({ url: link.url, accountId });
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
