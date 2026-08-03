# Stakes — bet on your own accountability

An iOS app where friends stake each other on self-improvement goals
("200 push-ups/day for 30 days, $50 each"). Miss your daily proof by your local
midnight and the stake goes to the friend who kept their word.

This is the **Phase 0 + Phase 1** scaffold from the build plan: Expo/React
Native app, Supabase backend, the timezone-correct deadline engine, and
**track-only** money (the app never holds funds — it settles who owes whom and
hands the loser a Venmo link). Real escrow (Stripe Connect) is a later phase.

> ⚖️ **Read before adding real money:** holding and paying out cash looks like
> money transmission + wagering and is regulated per-state. Keep v1 track-only.
> Get legal review + Stripe Connect + state geo-restrictions before Phase 4.

---

## What's here

```
stakes/
├─ app/                     # Expo Router screens
│  ├─ (auth)/login.tsx      # phone-OTP sign in
│  ├─ (tabs)/               # Home, Bets, Friends, Wallet, Profile
│  └─ bet/                  # create.tsx, [id].tsx (detail + proof)
├─ lib/                     # supabase client, auth, bets, time, health, venmo…
├─ constants/theme.ts       # Vencer dark+gold palette
└─ supabase/
   ├─ migrations/           # schema, RLS, deadline engine (pg_cron)
   └─ functions/            # verify-proof (AI), send-reminders
```

The signature mechanic — "the app knows the second you miss midnight" — lives in
`supabase/migrations/0001_init.sql` as the `settle_deadlines()` function, run
every minute by `pg_cron`. Deadlines resolve to **each user's local midnight**
via their stored IANA timezone.

---

## Setup

### 1. Prerequisites
- Node 18+, and the Expo CLI (`npx expo`)
- The **Expo Go** app on your iPhone (App Store) for instant testing
- A free **Supabase** account
- (Phase 2) An **Anthropic API key** for AI proof checks

### 2. Install
```bash
cd stakes
npm install
# Align native module versions to the installed Expo SDK:
npx expo install --fix
```

### 3. Supabase backend
1. Create a project at supabase.com.
2. Run the migrations (SQL editor → paste each file, in order):
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_storage.sql`
   - If `pg_cron` / `pg_net` aren't enabled: Database → Extensions → enable them.
3. Auth → Providers → **Phone**: enable and connect an SMS provider (Twilio).
   For development you can instead enable "Enable phone confirmations" test mode.
4. Copy your URL + anon key: Settings → API.

### 4. Environment
```bash
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_ANON_KEY
```

### 5. Run it
```bash
npx expo start
# scan the QR code with your iPhone camera → opens in Expo Go
```
Sign in with your phone number, set your display name + Venmo handle in Profile,
add a friend, and create a bet.

### 6. Edge Functions (optional now, needed for Phase 2)
```bash
npx supabase functions deploy verify-proof
npx supabase functions deploy send-reminders
# set secrets:
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

---

## Testing the deadline engine (the core mechanic)
1. Create a bet whose start date is today and open it on two accounts.
2. Have the opponent **Accept** — this calls `activate_bet()` and generates the
   per-day check-in grid.
3. To force a quick settlement, in the SQL editor set one check-in's `due_at`
   to a moment in the past:
   ```sql
   update checkins set due_at = now() - interval '1 minute'
   where id = '<a-pending-checkin-id>';
   select settle_deadlines();   -- normally cron runs this every minute
   ```
4. The bet flips to `settled`, `winner_id` is set, and a `ledger` row appears —
   visible on the **Wallet** tab with a Venmo pay link.

---

## Proof verification (layered, per the plan)
- **Apple Health** (`lib/health.ts`) — auto-verify runs/steps/minutes. Requires
  an **EAS dev build** (not Expo Go); the module loads lazily and no-ops in Go.
- **AI photo/video** (`supabase/functions/verify-proof`) — Claude vision returns
  `pass | uncertain | fail`. `pass` provisionally verifies; else escalates.
  (Honest limit: AI confirms *"this is really push-ups,"* not exact rep counts.)
- **Friend confirm/dispute** — the reliable backbone, in `bet/[id].tsx`.

---

## Roadmap (from the full plan)
- **Phase 2** — wire HealthKit auto-verify + AI video checks into the flow.
- **Phase 3** — head-to-head + open bounty ("first to bench 315"), activity
  feed, group pots, disputes/ref.
- **Phase 4** — real money via **Stripe Connect** (escrow, KYC, payouts, 1.5%
  fee, anti-collusion, 18+ age gate, state geo-restrictions). Gated on legal
  review.

Full plan: see the approved build plan (data model, state machine, costs).
