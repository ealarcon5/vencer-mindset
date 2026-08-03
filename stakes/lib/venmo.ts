import { Linking } from "react-native";

// v1 "track-only" payout: we never hold money. When a bet settles, we hand the
// loser a deep link that opens Venmo (or Cash App) pre-filled to pay the winner.

export function venmoPayUrl(opts: {
  handle: string;        // recipient's Venmo username (no leading @)
  amount: number;
  note: string;
}): string {
  const { handle, amount, note } = opts;
  const q = new URLSearchParams({
    txn: "pay",
    recipients: handle.replace(/^@/, ""),
    amount: amount.toFixed(2),
    note,
  });
  return `venmo://paycharge?${q.toString()}`;
}

export function cashAppUrl(cashtag: string, amount: number): string {
  return `https://cash.app/${cashtag.startsWith("$") ? cashtag : "$" + cashtag}/${amount.toFixed(2)}`;
}

export async function openPayment(url: string) {
  const ok = await Linking.canOpenURL(url);
  if (ok) return Linking.openURL(url);
  // Fall back to the Venmo web/App Store page if the app isn't installed.
  return Linking.openURL("https://venmo.com");
}
