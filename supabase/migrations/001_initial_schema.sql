create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.fantasy_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null default 'sleeper',
  platform_user_id text not null,
  platform_username text not null,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, platform_user_id)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null default 'sleeper',
  platform_league_id text not null,
  name text not null,
  season text,
  sport text default 'nfl',
  total_teams int,
  status text,
  is_dynasty boolean default false,
  is_best_ball boolean default false,
  is_superflex boolean default false,
  is_two_qb boolean default false,
  te_premium numeric default 0,
  settings_json jsonb default '{}'::jsonb,
  scoring_settings_json jsonb default '{}'::jsonb,
  roster_positions_json jsonb default '[]'::jsonb,
  metadata_json jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, platform_league_id)
);

create table public.league_users (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade not null,
  platform_user_id text,
  display_name text,
  team_name text,
  avatar text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table public.league_rosters (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade not null,
  platform_roster_id text not null,
  owner_platform_user_id text,
  owner_display_name text,
  starters_json jsonb default '[]'::jsonb,
  players_json jsonb default '[]'::jsonb,
  settings_json jsonb default '{}'::jsonb,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(league_id, platform_roster_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  sleeper_player_id text unique,
  full_name text,
  first_name text,
  last_name text,
  position text,
  team text,
  age numeric,
  years_exp int,
  status text,
  metadata_json jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table public.draft_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  league_id uuid references public.leagues(id) on delete cascade not null,
  platform text not null default 'sleeper',
  platform_draft_id text not null,
  status text,
  draft_type text,
  season text,
  settings_json jsonb default '{}'::jsonb,
  metadata_json jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, platform_draft_id)
);

create table public.draft_room_picks (
  id uuid primary key default gen_random_uuid(),
  draft_room_id uuid references public.draft_rooms(id) on delete cascade not null,
  platform_pick_id text,
  pick_no int not null,
  round int,
  pick_in_round int,
  platform_roster_id text,
  picked_by_platform_user_id text,
  sleeper_player_id text,
  player_name text,
  position text,
  team text,
  metadata_json jsonb default '{}'::jsonb,
  picked_at timestamptz,
  created_at timestamptz default now(),
  unique(draft_room_id, pick_no)
);

create table public.draft_rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  league_id uuid references public.leagues(id) on delete cascade,
  source text default 'manual',
  season text,
  format text,
  sleeper_player_id text,
  player_name text not null,
  position text,
  team text,
  rank int,
  adp numeric,
  projected_points numeric,
  dynasty_value numeric,
  best_ball_value numeric,
  superflex_value numeric,
  te_premium_value numeric,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table public.draft_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  draft_room_id uuid references public.draft_rooms(id) on delete cascade not null,
  pick_no_context int,
  user_next_pick_no int,
  recommendations_json jsonb default '{}'::jsonb,
  roster_state_json jsonb default '{}'::jsonb,
  available_players_json jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  league_id uuid references public.leagues(id),
  draft_room_id uuid references public.draft_rooms(id),
  sync_type text not null,
  status text not null,
  message text,
  metadata_json jsonb default '{}'::jsonb,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_fantasy_accounts_updated_at before update on public.fantasy_accounts for each row execute function public.set_updated_at();
create trigger set_leagues_updated_at before update on public.leagues for each row execute function public.set_updated_at();
create trigger set_league_rosters_updated_at before update on public.league_rosters for each row execute function public.set_updated_at();
create trigger set_draft_rooms_updated_at before update on public.draft_rooms for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.fantasy_accounts enable row level security;
alter table public.leagues enable row level security;
alter table public.league_users enable row level security;
alter table public.league_rosters enable row level security;
alter table public.players enable row level security;
alter table public.draft_rooms enable row level security;
alter table public.draft_room_picks enable row level security;
alter table public.draft_rankings enable row level security;
alter table public.draft_recommendation_snapshots enable row level security;
alter table public.sync_runs enable row level security;

create policy "Profiles are owned by users" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Fantasy accounts are owned by users" on public.fantasy_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Leagues are owned by users" on public.leagues for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Draft rooms are owned by users" on public.draft_rooms for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Draft rankings are owned by users" on public.draft_rankings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Sync runs are owned by users" on public.sync_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Child table access is granted through parent league ownership.
create policy "League users follow league ownership" on public.league_users for all
  using (exists (select 1 from public.leagues l where l.id = league_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.leagues l where l.id = league_id and l.user_id = auth.uid()));

-- Child table access is granted through parent league ownership.
create policy "League rosters follow league ownership" on public.league_rosters for all
  using (exists (select 1 from public.leagues l where l.id = league_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.leagues l where l.id = league_id and l.user_id = auth.uid()));

-- Child table access is granted through parent draft room ownership.
create policy "Draft picks follow draft room ownership" on public.draft_room_picks for all
  using (exists (select 1 from public.draft_rooms d where d.id = draft_room_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.draft_rooms d where d.id = draft_room_id and d.user_id = auth.uid()));

-- Child table access is granted through parent draft room ownership.
create policy "Recommendation snapshots follow draft room ownership" on public.draft_recommendation_snapshots for all
  using (exists (select 1 from public.draft_rooms d where d.id = draft_room_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.draft_rooms d where d.id = draft_room_id and d.user_id = auth.uid()));

create policy "Players are readable to authenticated users" on public.players for select to authenticated using (true);
