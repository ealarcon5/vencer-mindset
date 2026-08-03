// Client-side Stripe helpers.
//
// @stripe/stripe-react-native is a NATIVE module — it does not run in Expo Go.
// We lazy-require it so the rest of the app (design system, browsing) still runs
// in Expo Go; payment actions only work once you make an EAS dev build.

import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

let stripeRN: any = null;
function getStripe() {
  if (stripeRN) return stripeRN;
  try {
    // @ts-ignore optional native module
    stripeRN = require("@stripe/stripe-react-native");
  } catch {
    stripeRN = null;
  }
  return stripeRN;
}

export function paymentsAvailable(): boolean {
  return !!getStripe();
}

/**
 * Pay your stake into escrow for a bet. Presents the native Stripe PaymentSheet
 * (Apple Pay + card). Returns true if the payment succeeded.
 */
export async function fundStake(betId: string): Promise<{ ok: boolean; error?: string }> {
  const Stripe = getStripe();
  if (!Stripe) return { ok: false, error: "Payments require a dev build (not Expo Go)." };

  // 1. Ask the backend to create the PaymentIntent for our stake.
  const { data, error } = await supabase.functions.invoke("create-stake-payment", {
    body: { bet_id: betId },
  });
  if (error || data?.error) return { ok: false, error: data?.error ?? error?.message };

  // 2. Initialise Stripe + the PaymentSheet.
  await Stripe.initStripe({
    publishableKey: data.publishableKey,
    merchantIdentifier: "merchant.com.vencer.stakes",
  });
  const init = await Stripe.initPaymentSheet({
    merchantDisplayName: "Stakes",
    customerId: data.customer,
    customerEphemeralKeySecret: data.ephemeralKey,
    paymentIntentClientSecret: data.paymentIntent,
    applePay: { merchantCountryCode: "US" },
    allowsDelayedPaymentMethods: false,
    returnURL: "stakes://wallet",
  });
  if (init.error) return { ok: false, error: init.error.message };

  // 3. Present it. The webhook marks us funded on success.
  const result = await Stripe.presentPaymentSheet();
  if (result.error) {
    return { ok: false, error: result.error.code === "Canceled" ? undefined : result.error.message };
  }
  return { ok: true };
}

/** Open Stripe Express onboarding so the user can receive payouts. */
export async function startPayoutOnboarding(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("connect-onboard", { body: {} });
  if (error || data?.error) return { ok: false, error: data?.error ?? error?.message };
  await WebBrowser.openAuthSessionAsync(data.url, "stakes://wallet");
  return { ok: true };
}

export async function getConnectedAccount(userId: string) {
  const { data } = await supabase.from("connected_accounts").select("*").eq("user_id", userId).maybeSingle();
  return data;
}
