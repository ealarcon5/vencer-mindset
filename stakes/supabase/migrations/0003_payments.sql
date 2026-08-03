-- Migration 0003: Stripe Connect escrow.
--
-- Money flow (test mode first):
--   * Each participant pays their stake into the PLATFORM balance = escrow.
--   * A bet becomes 'active' only once BOTH participants have funded.
--   * On settlement the pot (minus fees) is Transferred to the winner's
--     Express connected account.
--
-- Note: 'funding' is added to the bet_status enum. It is only ever *used* at
-- runtime (inside function bodies), never in DDL in this file, so it's safe to
-- add and reference here.

alter type bet_status add value if not exists 'funding';

-- Payers: map app user -> Stripe Customer.
create table stripe_customers (
  user_id            uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text not null,
  created_at         timestamptz not null default now()
);

-- Payees: map app user -> Stripe Express connected account.
create table connected_accounts (
  user_id           uuid primary key references profiles(id) on delete cascade,
  stripe_account_id text not null,
  onboarding_status text not null default 'pending', -- pending | complete
  payouts_enabled   boolean not null default false,
  created_at        timestamptz not null default now()
);

-- The real money ledger / audit trail (supersedes the informational `ledger`).
create type payment_kind   as enum ('charge', 'transfer', 'refund');
create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create table payments (
  id         uuid primary key default gen_random_uuid(),
  bet_id     uuid references bets(id) on delete set null,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       payment_kind not null,
  amount     numeric not null,         -- gross amount in dollars
  fee        numeric not null default 0,
  stripe_id  text,                     -- payment_intent / transfer / refund id
  status     payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index payments_user_idx on payments (user_id, created_at desc);

-- Funding state on participants + bets.
alter table bet_participants add column funded boolean not null default false;
alter table bet_participants add column payment_intent_id text;
alter table bets add column funding_status text not null default 'unfunded'; -- unfunded | partial | funded
alter table bets add column pot_amount numeric not null default 0;

-- Called by the Stripe webhook (service role) when a participant's stake
-- PaymentIntent succeeds. Marks them funded, records the charge, and once every
-- participant has funded, flips the bet to active and builds the check-in grid.
create or replace function mark_funded(
  p_bet_id uuid, p_user_id uuid, p_payment_intent text, p_amount numeric, p_fee numeric
) returns void
language plpgsql security definer as $$
declare
  remaining int;
  total_pot numeric;
begin
  update bet_participants
     set funded = true, payment_intent_id = p_payment_intent
   where bet_id = p_bet_id and user_id = p_user_id;

  insert into payments (bet_id, user_id, kind, amount, fee, stripe_id, status)
  values (p_bet_id, p_user_id, 'charge', p_amount, p_fee, p_payment_intent, 'succeeded');

  select count(*) filter (where not funded) into remaining
    from bet_participants where bet_id = p_bet_id;

  if remaining = 0 then
    select coalesce(sum(amount), 0) into total_pot
      from payments where bet_id = p_bet_id and kind = 'charge' and status = 'succeeded';
    update bets set status = 'active', funding_status = 'funded', pot_amount = total_pot
     where id = p_bet_id;
    perform activate_bet(p_bet_id);
  else
    update bets set funding_status = 'partial' where id = p_bet_id and funding_status = 'unfunded';
  end if;
end;
$$;

-- RLS
alter table stripe_customers    enable row level security;
alter table connected_accounts  enable row level security;
alter table payments            enable row level security;

create policy "own stripe customer" on stripe_customers for select using (user_id = auth.uid());
create policy "own connected account" on connected_accounts for select using (user_id = auth.uid());
create policy "own payments" on payments for select using (user_id = auth.uid());
-- Writes to all three happen only from Edge Functions using the service role,
-- which bypasses RLS — so no insert/update policies are granted to clients.
