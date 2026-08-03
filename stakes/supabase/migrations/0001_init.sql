-- Stakes — accountability betting app
-- Migration 0001: core schema, RLS, and the timezone-correct deadline engine.
--
-- Design notes:
--   * "midnight" is per-user LOCAL midnight. We store each user's IANA timezone
--     on their profile and compute every check-in deadline in THAT timezone.
--   * v1 is "track-only": no real money is held. The ledger records who owes
--     whom so the app can hand the loser a Venmo/Cash App link. Phase 4 swaps
--     this for real Stripe Connect escrow.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_cron";        -- scheduled deadline engine

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type bet_type       as enum ('daily_habit', 'head_to_head', 'bounty');
create type bet_status      as enum ('draft', 'invited', 'active', 'settled', 'canceled');
create type participant_status as enum ('invited', 'active', 'failed', 'won', 'declined');
create type checkin_status  as enum ('pending', 'submitted', 'verified', 'failed');
create type verified_by     as enum ('health', 'ai', 'friend', 'auto', 'auto_miss');
create type proof_source    as enum ('healthkit', 'photo', 'video', 'manual');
create type ai_verdict      as enum ('pass', 'uncertain', 'fail');
create type friend_confirmation as enum ('none', 'confirmed', 'disputed');
create type friendship_status as enum ('pending', 'accepted', 'blocked');
create type ledger_status   as enum ('unpaid', 'marked_paid');

-- ---------------------------------------------------------------------------
-- profiles  (one row per auth user)
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  phone        text unique,
  display_name text not null default 'New user',
  avatar_url   text,
  timezone     text not null default 'America/Los_Angeles',  -- IANA tz name
  venmo_handle text,
  push_token   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- friendships  (directional rows; we insert both directions on accept)
-- ---------------------------------------------------------------------------
create table friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  friend_id  uuid not null references profiles(id) on delete cascade,
  status     friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------------------------------------------------------------------------
-- bets
-- ---------------------------------------------------------------------------
create table bets (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references profiles(id) on delete cascade,
  type                bet_type not null default 'daily_habit',
  title               text not null,                 -- "200 push-ups"
  metric              text not null default 'reps',  -- reps | pages | miles | minutes
  target              numeric not null default 1,
  start_date          date not null,
  end_date            date not null,
  deadline_local_time time not null default '23:59', -- local wall-clock deadline
  stake_amount        numeric not null default 0,
  currency            text not null default 'USD',
  rest_days_allowed   int not null default 0,        -- streak-freeze allowance
  proof_mode          text not null default 'honor', -- honor | photo | video | health
  status              bet_status not null default 'draft',
  winner_id           uuid references profiles(id),
  created_at          timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- bet_participants
-- ---------------------------------------------------------------------------
create table bet_participants (
  id                 uuid primary key default gen_random_uuid(),
  bet_id             uuid not null references bets(id) on delete cascade,
  user_id            uuid not null references profiles(id) on delete cascade,
  role               text not null default 'opponent',  -- creator | opponent
  status             participant_status not null default 'invited',
  current_streak     int not null default 0,
  missed_count       int not null default 0,
  accepted_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (bet_id, user_id)
);

-- ---------------------------------------------------------------------------
-- checkins  (one required proof window per participant per day)
-- ---------------------------------------------------------------------------
create table checkins (
  id           uuid primary key default gen_random_uuid(),
  bet_id       uuid not null references bets(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  due_at       timestamptz not null,     -- resolved to the user's local midnight/deadline
  local_date   date not null,            -- the calendar day this covers
  status       checkin_status not null default 'pending',
  verified_by  verified_by,
  created_at   timestamptz not null default now(),
  unique (bet_id, user_id, local_date)
);
create index checkins_due_idx on checkins (due_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- proofs
-- ---------------------------------------------------------------------------
create table proofs (
  id                 uuid primary key default gen_random_uuid(),
  checkin_id         uuid not null references checkins(id) on delete cascade,
  user_id            uuid not null references profiles(id) on delete cascade,
  media_url          text,
  source             proof_source not null default 'manual',
  reported_value     numeric,               -- e.g. 205 push-ups (honor-reported)
  ai_result          ai_verdict,
  ai_reason          text,
  friend_confirmation friend_confirmation not null default 'none',
  submitted_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ledger  (v1: informational "who owes whom"; Phase 4: real money)
-- ---------------------------------------------------------------------------
create table ledger (
  id          uuid primary key default gen_random_uuid(),
  bet_id      uuid not null references bets(id) on delete cascade,
  from_user   uuid not null references profiles(id),  -- loser (owes)
  to_user     uuid not null references profiles(id),  -- winner (owed)
  amount      numeric not null,
  currency    text not null default 'USD',
  status      ledger_status not null default 'unpaid',
  created_at  timestamptz not null default now()
);

-- ===========================================================================
-- FUNCTIONS
-- ===========================================================================

-- Resolve a local calendar date + wall-clock time into an absolute instant in
-- the given IANA timezone. This is the heart of "your local midnight".
create or replace function local_deadline(d date, t time, tz text)
returns timestamptz
language sql immutable as $$
  select ((d + t) at time zone tz);
$$;

-- Activate a bet once all opponents have accepted: flip statuses and generate
-- one check-in per participant per day, each due at that participant's LOCAL
-- deadline. Runs as SECURITY DEFINER so it can write across participant rows.
create or replace function activate_bet(p_bet_id uuid)
returns void
language plpgsql security definer as $$
declare
  b            bets%rowtype;
  part         record;
  d            date;
begin
  select * into b from bets where id = p_bet_id;
  if b.id is null then raise exception 'bet not found'; end if;
  if b.status = 'active' then return; end if;

  update bets set status = 'active' where id = p_bet_id;
  update bet_participants set status = 'active' where bet_id = p_bet_id;

  -- Only daily_habit generates a per-day check-in grid in v1.
  if b.type = 'daily_habit' then
    for part in
      select bp.user_id, p.timezone
      from bet_participants bp
      join profiles p on p.id = bp.user_id
      where bp.bet_id = p_bet_id
    loop
      d := b.start_date;
      while d <= b.end_date loop
        insert into checkins (bet_id, user_id, due_at, local_date)
        values (p_bet_id, part.user_id, local_deadline(d, b.deadline_local_time, part.timezone), d)
        on conflict (bet_id, user_id, local_date) do nothing;
        d := d + 1;
      end loop;
    end loop;
  end if;
end;
$$;

-- THE DEADLINE ENGINE.
-- Called every minute by pg_cron. Finds check-ins whose deadline has passed
-- with no verified proof, marks them failed, and settles the bet: the
-- participant who missed loses; the other participant wins; a ledger row is
-- written. (v1 rule: a single miss loses the whole bet, minus any allowed
-- rest days.)
create or replace function settle_deadlines()
returns int
language plpgsql security definer as $$
declare
  c            record;
  b            bets%rowtype;
  loser        bet_participants%rowtype;
  winner       bet_participants%rowtype;
  n            int := 0;
begin
  for c in
    select * from checkins
    where status = 'pending' and due_at <= now()
    for update skip locked
  loop
    -- Mark the missed window.
    update checkins set status = 'failed', verified_by = 'auto_miss' where id = c.id;

    select * into b from bets where id = c.bet_id;
    if b.status <> 'active' then continue; end if;   -- already settled

    -- Count this participant's misses against their rest-day allowance.
    update bet_participants
       set missed_count = missed_count + 1
     where bet_id = c.bet_id and user_id = c.user_id
     returning * into loser;

    if loser.missed_count <= b.rest_days_allowed then
      continue;  -- used a rest day; bet stays alive
    end if;

    -- This participant is out. Find the other participant as the winner.
    select * into winner
      from bet_participants
     where bet_id = c.bet_id and user_id <> c.user_id
     limit 1;

    update bet_participants set status = 'failed' where id = loser.id;

    if winner.id is not null then
      update bet_participants set status = 'won' where id = winner.id;
      update bets set status = 'settled', winner_id = winner.user_id where id = b.id;
      insert into ledger (bet_id, from_user, to_user, amount, currency)
      values (b.id, loser.user_id, winner.user_id, b.stake_amount, b.currency);
    else
      update bets set status = 'settled' where id = b.id;
    end if;

    n := n + 1;
  end loop;

  return n;  -- number of bets settled this run
end;
$$;

-- When every remaining check-in for an active bet is verified and the end date
-- has passed with no loser, mark it settled as a mutual success (no ledger).
create or replace function finalize_completed_bets()
returns void
language plpgsql security definer as $$
begin
  -- A bet finalizes as a mutual success once its window is over, no check-in is
  -- still awaiting resolution (pending/submitted), and no participant has been
  -- marked failed. Days missed within the rest-day allowance don't block this.
  update bets b set status = 'settled'
  where b.status = 'active'
    and b.type = 'daily_habit'
    and b.end_date < (now() at time zone 'UTC')::date
    and not exists (
      select 1 from checkins c
      where c.bet_id = b.id and c.status in ('pending', 'submitted')
    )
    and not exists (
      select 1 from bet_participants bp
      where bp.bet_id = b.id and bp.status = 'failed'
    );
end;
$$;

-- ===========================================================================
-- pg_cron schedules
-- ===========================================================================
select cron.schedule('settle-deadlines', '* * * * *', $$ select settle_deadlines(); $$);
select cron.schedule('finalize-bets',     '5 * * * *', $$ select finalize_completed_bets(); $$);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
alter table profiles          enable row level security;
alter table friendships       enable row level security;
alter table bets              enable row level security;
alter table bet_participants  enable row level security;
alter table checkins          enable row level security;
alter table proofs            enable row level security;
alter table ledger            enable row level security;

-- Helper: is the current user a participant in a bet?
create or replace function is_bet_participant(p_bet_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from bet_participants
    where bet_id = p_bet_id and user_id = auth.uid()
  );
$$;

-- profiles: everyone can read basic profiles (needed for friend search);
-- you may only edit your own.
create policy "profiles readable" on profiles for select using (true);
create policy "profiles self-insert" on profiles for insert with check (id = auth.uid());
create policy "profiles self-update" on profiles for update using (id = auth.uid());

-- friendships: only rows you're part of.
create policy "friendships mine" on friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy "friendships insert" on friendships for insert
  with check (user_id = auth.uid());
create policy "friendships update" on friendships for update
  using (user_id = auth.uid() or friend_id = auth.uid());

-- bets: participants only.
create policy "bets visible to participants" on bets for select
  using (creator_id = auth.uid() or is_bet_participant(id));
create policy "bets insert by creator" on bets for insert
  with check (creator_id = auth.uid());
create policy "bets update by participants" on bets for update
  using (creator_id = auth.uid() or is_bet_participant(id));

-- bet_participants: rows for bets you're in.
create policy "participants visible" on bet_participants for select
  using (user_id = auth.uid() or is_bet_participant(bet_id));
create policy "participants insert" on bet_participants for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from bets where id = bet_id and creator_id = auth.uid())
  );
create policy "participants update self" on bet_participants for update
  using (user_id = auth.uid());

-- checkins & proofs: bet participants only.
create policy "checkins visible" on checkins for select using (is_bet_participant(bet_id));
create policy "checkins update own" on checkins for update using (user_id = auth.uid());
create policy "proofs visible" on proofs for select
  using (exists (select 1 from checkins c where c.id = checkin_id and is_bet_participant(c.bet_id)));
create policy "proofs insert own" on proofs for insert with check (user_id = auth.uid());
create policy "proofs update participant" on proofs for update
  using (exists (select 1 from checkins c where c.id = checkin_id and is_bet_participant(c.bet_id)));

-- ledger: parties to the entry.
create policy "ledger visible" on ledger for select
  using (from_user = auth.uid() or to_user = auth.uid());
create policy "ledger update parties" on ledger for update
  using (from_user = auth.uid() or to_user = auth.uid());

-- ===========================================================================
-- Auto-create a profile row when a new auth user signs up.
-- ===========================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, phone) values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
