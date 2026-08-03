# Stakes — bet on your own accountability

An iOS app where friends stake each other on self-improvement goals
("200 push-ups/day for 30 days, $50 each"). Both pay into escrow; miss your daily
proof by your local midnight and the pot goes to the friend who kept their word.

Designed to feel **like Apple made it** — light & airy, monochrome with a single
restrained accent, oversized system type, inset grouped cards, SF Symbols,
materials, motion, and haptics.

## Status
- **Design system** — a real, reusable UI kit (`components/ui/`) every screen
  consumes. Light/monochrome tokens in `constants/theme.ts`.
- **Escrow payments (Stripe Connect)** — both players pay their stake into the
  platform balance; the winner is auto-paid on settlement (pot − 1.5% fee). Apple
  Pay via Stripe PaymentSheet. **Built in Stripe test mode.**
- **Deadline engine, layered proof, auth, friends** — from the earlier phase.

> ⚖️ **Before real money:** this is *wagering*, which Stripe restricts. Keep it in
> **test mode** and, before going live, get Stripe approval + legal review, add an
> 18+ age gate, state geo-restrictions, and anti-collusion controls.

---

## Layout
```
stakes/
├─ app/                     # Expo Router screens (all use the design system)
│  ├─ (auth)/login.tsx      # Apple-style phone-OTP sign in
│  ├─ (tabs)/               # Home, Bets, Friends, Wallet, Profile
│  └─ bet/                  # create.tsx, [id].tsx (funding + proof + payout)
├─ components/ui/           # THE design system — Text, Button, List, Card,
│                           #   Screen, Header, Money, Symbol, Misc
├─ constants/theme.ts       # light/monochrome tokens + type scale
├─ lib/                     # supabase, auth, bets, stripe, time, health…
└─ supabase/
   ├─ migrations/           # 0001 schema+deadline engine, 0002 storage, 0003 payments
   └─ functions/            # connect-onboard, create-stake-payment,
                            #   stripe-webhook, process-payouts, verify-proof, send-reminders
```

---

## Setup

### 1. Install
```bash
cd stakes
npm install
npx expo install --fix          # align native module versions to the SDK
```

### 2. Supabase
Run the migrations in order in the SQL editor:
`0001_init.sql` → `0002_storage.sql` → `0003_payments.sql`.
Enable extensions `pg_cron` and `pg_net` if prompted. Enable **Phone** auth
(Twilio) under Auth → Providers. Copy your URL + anon key (Settings → API).

### 3. Env
```bash
cp .env.example .env            # SUPABASE_URL, SUPABASE_ANON_KEY
```

### 4. Run the design (works in Expo Go)
```bash
npx expo start                  # scan the QR with your iPhone
```
Browsing, auth, creating/accepting bets, and the whole UI run in **Expo Go**.

### 5. Payments need an EAS dev build (one-time)
`@stripe/stripe-react-native` is a native module, so **Apple Pay / PaymentSheet
don't run in Expo Go**. Make a dev client:
```bash
npm i -g eas-cli && eas login
eas build --profile development --platform ios
```
Then set the Stripe secrets and deploy the Edge Functions:
```bash
supabase functions deploy connect-onboard create-stake-payment process-payouts
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_PUBLISHABLE_KEY=pk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  PLATFORM_FEE_PCT=1.5
```
Point a Stripe webhook (test mode) at the `stripe-webhook` function URL for
`payment_intent.succeeded` and `account.updated`. Schedule `process-payouts`
(pg_cron `net.http_post`, or any scheduler) every minute.

---

## Money flow
```
create bet → opponent accepts → BOTH pay stake (PaymentSheet / Apple Pay)
          → funds held in platform balance (escrow)
          → bet activates only once both funded (stripe-webhook → mark_funded)
active → daily proof; miss by local midnight → settle_deadlines sets the winner
       → process-payouts transfers pot − 1.5% to the winner's Stripe balance
```
Winners set up a Stripe **Express** account once (Wallet → "Set up payouts") to
receive money.

## Testing escrow (test mode)
Use Stripe test card `4242 4242 4242 4242`. Create a bet, accept + pay on both
accounts, force a missed deadline (`select settle_deadlines();`), then run
`process-payouts` — the winner's Wallet shows the payout, the loser shows the
loss.

## Design principles (so it stays Apple-grade)
Every screen renders through `components/ui`. Never hard-code colors, font sizes,
or spacing — use `constants/theme.ts` tokens. Icons are **SF Symbols** only (no
emoji). Primary actions are black buttons; system blue is for interactive text
only. Hierarchy comes from type size/weight and whitespace, not color.

## Roadmap
Compliance track (Stripe approval, legal, 18+, geo, anti-collusion) → then
HealthKit + AI proof wired end-to-end → head-to-head & bounty bets → social feed.
