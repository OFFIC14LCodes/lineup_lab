-- Canonical NFL team identities.
-- One row per franchise; abbreviation is the nflverse canonical form (e.g. 'LA', 'WAS', 'JAX', 'LV').
create table if not exists public.nfl_teams (
  id          text primary key,
  full_name   text not null,
  conference  text not null,
  division    text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Seed the 32 current franchises.
insert into public.nfl_teams (id, full_name, conference, division) values
  ('ARI', 'Arizona Cardinals',      'NFC', 'NFC West'),
  ('ATL', 'Atlanta Falcons',        'NFC', 'NFC South'),
  ('BAL', 'Baltimore Ravens',       'AFC', 'AFC North'),
  ('BUF', 'Buffalo Bills',          'AFC', 'AFC East'),
  ('CAR', 'Carolina Panthers',      'NFC', 'NFC South'),
  ('CHI', 'Chicago Bears',          'NFC', 'NFC North'),
  ('CIN', 'Cincinnati Bengals',     'AFC', 'AFC North'),
  ('CLE', 'Cleveland Browns',       'AFC', 'AFC North'),
  ('DAL', 'Dallas Cowboys',         'NFC', 'NFC East'),
  ('DEN', 'Denver Broncos',         'AFC', 'AFC West'),
  ('DET', 'Detroit Lions',          'NFC', 'NFC North'),
  ('GB',  'Green Bay Packers',      'NFC', 'NFC North'),
  ('HOU', 'Houston Texans',         'AFC', 'AFC South'),
  ('IND', 'Indianapolis Colts',     'AFC', 'AFC South'),
  ('JAX', 'Jacksonville Jaguars',   'AFC', 'AFC South'),
  ('KC',  'Kansas City Chiefs',     'AFC', 'AFC West'),
  ('LA',  'Los Angeles Rams',       'NFC', 'NFC West'),
  ('LAC', 'Los Angeles Chargers',   'AFC', 'AFC West'),
  ('LV',  'Las Vegas Raiders',      'AFC', 'AFC West'),
  ('MIA', 'Miami Dolphins',         'AFC', 'AFC East'),
  ('MIN', 'Minnesota Vikings',      'NFC', 'NFC North'),
  ('NE',  'New England Patriots',   'AFC', 'AFC East'),
  ('NO',  'New Orleans Saints',     'NFC', 'NFC South'),
  ('NYG', 'New York Giants',        'NFC', 'NFC East'),
  ('NYJ', 'New York Jets',          'AFC', 'AFC East'),
  ('PHI', 'Philadelphia Eagles',    'NFC', 'NFC East'),
  ('PIT', 'Pittsburgh Steelers',    'AFC', 'AFC North'),
  ('SF',  'San Francisco 49ers',    'NFC', 'NFC West'),
  ('SEA', 'Seattle Seahawks',       'NFC', 'NFC West'),
  ('TB',  'Tampa Bay Buccaneers',   'NFC', 'NFC South'),
  ('TEN', 'Tennessee Titans',       'AFC', 'AFC South'),
  ('WAS', 'Washington Commanders',  'NFC', 'NFC East')
on conflict (id) do nothing;

-- Constraints.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nfl_teams_conference_check'
      and conrelid = 'public.nfl_teams'::regclass
  ) then
    alter table public.nfl_teams
      add constraint nfl_teams_conference_check
      check (conference in ('AFC', 'NFC'));
  end if;
end $$;

-- RLS: read-only for authenticated users; no write policy (seeded via migration only).
alter table public.nfl_teams enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename   = 'nfl_teams'
      and policyname  = 'nfl_teams are readable to authenticated users'
  ) then
    create policy "nfl_teams are readable to authenticated users"
      on public.nfl_teams
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- ---------------------------------------------------------------------------

-- Team-game statistics: one row per (team, game). Two rows per game total.
-- Points and yards are always stored from the perspective of the row's team:
--   points_scored  = points this team put on the board
--   points_allowed = points the opponent put on the board (= opponent's points_scored)
--   offensive_yards = net offensive yards gained by this team
--   yards_allowed   = net offensive yards gained by the opponent
create table if not exists public.team_game_stats (
  id                   uuid    primary key default gen_random_uuid(),
  game_id              text    not null,
  season               integer not null,
  week                 integer not null,
  season_type          text    not null,
  team_id              text    not null references public.nfl_teams(id),
  opponent_id          text    not null references public.nfl_teams(id),
  is_home              boolean not null,
  -- Scores sourced from nflverse schedules CSV.
  points_scored        integer,
  points_allowed       integer,
  -- Yards sourced from nflverse PBP CSV aggregation.
  offensive_yards      integer,
  yards_allowed        integer,
  -- Whether the game has reached a final score state.
  is_final             boolean not null default false,
  -- 'pending' | 'verified' | 'conflict' | 'incomplete'
  reconciliation_status text   not null default 'pending',
  -- Provenance.
  source_provider      text    not null default 'nflverse',
  source_batch_id      uuid    references public.football_import_batches(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Natural key: one row per team per game.
create unique index if not exists uniq_team_game_stats_game_team
  on public.team_game_stats(game_id, team_id);

-- Supporting indexes.
create index if not exists idx_team_game_stats_season_week
  on public.team_game_stats(season, week, season_type);

create index if not exists idx_team_game_stats_team_season
  on public.team_game_stats(team_id, season, week);

create index if not exists idx_team_game_stats_batch
  on public.team_game_stats(source_batch_id)
  where source_batch_id is not null;

-- Constraints.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_game_stats_season_check'
      and conrelid = 'public.team_game_stats'::regclass
  ) then
    alter table public.team_game_stats
      add constraint team_game_stats_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_game_stats_week_check'
      and conrelid = 'public.team_game_stats'::regclass
  ) then
    alter table public.team_game_stats
      add constraint team_game_stats_week_check
      check (week between 1 and 25);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_game_stats_season_type_check'
      and conrelid = 'public.team_game_stats'::regclass
  ) then
    alter table public.team_game_stats
      add constraint team_game_stats_season_type_check
      check (season_type in ('REG', 'POST'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_game_stats_reconciliation_status_check'
      and conrelid = 'public.team_game_stats'::regclass
  ) then
    alter table public.team_game_stats
      add constraint team_game_stats_reconciliation_status_check
      check (reconciliation_status in ('pending', 'verified', 'conflict', 'incomplete'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_game_stats_team_not_self'
      and conrelid = 'public.team_game_stats'::regclass
  ) then
    alter table public.team_game_stats
      add constraint team_game_stats_team_not_self
      check (team_id <> opponent_id);
  end if;
end $$;

-- Updated-at trigger.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname   = 'set_team_game_stats_updated_at'
      and tgrelid  = 'public.team_game_stats'::regclass
  ) then
    create trigger set_team_game_stats_updated_at
      before update on public.team_game_stats
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS: operator writes; authenticated reads.
alter table public.team_game_stats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename   = 'team_game_stats'
      and policyname  = 'team_game_stats are readable to authenticated users'
  ) then
    create policy "team_game_stats are readable to authenticated users"
      on public.team_game_stats
      for select
      to authenticated
      using (true);
  end if;
end $$;
