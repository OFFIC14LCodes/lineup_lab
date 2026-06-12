create table if not exists public.player_weekly_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  provider text not null,
  provider_external_id text,
  season integer not null,
  week integer not null,
  season_type text not null default 'regular',
  game_id text,
  team text,
  opponent text,
  position_group text,
  home_away text,
  game_date timestamptz,
  stats_json jsonb not null default '{}'::jsonb,
  provider_fantasy_points numeric,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  data_version text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  provider text not null,
  provider_external_id text,
  season integer not null,
  season_type text not null default 'regular',
  team text,
  position_group text,
  games_played integer,
  games_started integer,
  stats_json jsonb not null default '{}'::jsonb,
  provider_fantasy_points numeric,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  data_version text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_projections (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  provider text not null,
  provider_external_id text,
  season integer not null,
  week integer,
  season_type text not null default 'regular',
  projection_type text not null,
  scoring_format text,
  position_group text,
  team text,
  opponent text,
  stats_json jsonb not null default '{}'::jsonb,
  provider_fantasy_points numeric,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  version text not null default 'current',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_injuries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  provider text not null,
  provider_external_id text,
  season integer,
  week integer,
  team text,
  status text,
  practice_status text,
  game_status text,
  body_part text,
  injury_type text,
  description text,
  expected_return text,
  source_updated_at timestamptz,
  observed_at timestamptz not null default now(),
  ingested_at timestamptz not null default now(),
  is_current boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_stats_provider_lowercase'
      and conrelid = 'public.player_weekly_stats'::regclass
  ) then
    alter table public.player_weekly_stats
      add constraint player_weekly_stats_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_stats_season_check'
      and conrelid = 'public.player_weekly_stats'::regclass
  ) then
    alter table public.player_weekly_stats
      add constraint player_weekly_stats_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_stats_week_check'
      and conrelid = 'public.player_weekly_stats'::regclass
  ) then
    alter table public.player_weekly_stats
      add constraint player_weekly_stats_week_check
      check (week between 1 and 25);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_stats_season_type_check'
      and conrelid = 'public.player_weekly_stats'::regclass
  ) then
    alter table public.player_weekly_stats
      add constraint player_weekly_stats_season_type_check
      check (season_type in ('preseason', 'regular', 'postseason'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_stats_home_away_check'
      and conrelid = 'public.player_weekly_stats'::regclass
  ) then
    alter table public.player_weekly_stats
      add constraint player_weekly_stats_home_away_check
      check (home_away is null or home_away in ('home', 'away'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_season_stats_provider_lowercase'
      and conrelid = 'public.player_season_stats'::regclass
  ) then
    alter table public.player_season_stats
      add constraint player_season_stats_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_season_stats_season_check'
      and conrelid = 'public.player_season_stats'::regclass
  ) then
    alter table public.player_season_stats
      add constraint player_season_stats_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_season_stats_season_type_check'
      and conrelid = 'public.player_season_stats'::regclass
  ) then
    alter table public.player_season_stats
      add constraint player_season_stats_season_type_check
      check (season_type in ('preseason', 'regular', 'postseason'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_season_stats_games_played_check'
      and conrelid = 'public.player_season_stats'::regclass
  ) then
    alter table public.player_season_stats
      add constraint player_season_stats_games_played_check
      check (games_played is null or games_played >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_season_stats_games_started_check'
      and conrelid = 'public.player_season_stats'::regclass
  ) then
    alter table public.player_season_stats
      add constraint player_season_stats_games_started_check
      check (games_started is null or games_started >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_projections_provider_lowercase'
      and conrelid = 'public.player_projections'::regclass
  ) then
    alter table public.player_projections
      add constraint player_projections_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_projections_season_check'
      and conrelid = 'public.player_projections'::regclass
  ) then
    alter table public.player_projections
      add constraint player_projections_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_projections_week_check'
      and conrelid = 'public.player_projections'::regclass
  ) then
    alter table public.player_projections
      add constraint player_projections_week_check
      check (week is null or week between 1 and 25);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_projections_season_type_check'
      and conrelid = 'public.player_projections'::regclass
  ) then
    alter table public.player_projections
      add constraint player_projections_season_type_check
      check (season_type in ('preseason', 'regular', 'postseason'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_projections_projection_type_check'
      and conrelid = 'public.player_projections'::regclass
  ) then
    alter table public.player_projections
      add constraint player_projections_projection_type_check
      check (projection_type in ('preseason', 'season', 'weekly', 'rest_of_season'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_projections_week_projection_alignment'
      and conrelid = 'public.player_projections'::regclass
  ) then
    alter table public.player_projections
      add constraint player_projections_week_projection_alignment
      check (
        (projection_type = 'weekly' and week is not null)
        or (projection_type <> 'weekly' and week is null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_injuries_provider_lowercase'
      and conrelid = 'public.player_injuries'::regclass
  ) then
    alter table public.player_injuries
      add constraint player_injuries_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_injuries_season_check'
      and conrelid = 'public.player_injuries'::regclass
  ) then
    alter table public.player_injuries
      add constraint player_injuries_season_check
      check (season is null or season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_injuries_week_check'
      and conrelid = 'public.player_injuries'::regclass
  ) then
    alter table public.player_injuries
      add constraint player_injuries_week_check
      check (week is null or week between 1 and 25);
  end if;
end $$;

create unique index if not exists uniq_player_weekly_stats_with_game
  on public.player_weekly_stats(
    player_id,
    provider,
    season,
    week,
    season_type,
    game_id,
    coalesce(data_version, 'current')
  )
  where game_id is not null;

create unique index if not exists uniq_player_weekly_stats_without_game
  on public.player_weekly_stats(
    player_id,
    provider,
    season,
    week,
    season_type,
    coalesce(data_version, 'current')
  )
  where game_id is null;

create unique index if not exists uniq_player_season_stats_scope
  on public.player_season_stats(
    player_id,
    provider,
    season,
    season_type
  );

create unique index if not exists uniq_player_projections_weekly
  on public.player_projections(
    player_id,
    provider,
    season,
    week,
    season_type,
    projection_type,
    coalesce(scoring_format, ''),
    version
  )
  where week is not null;

create unique index if not exists uniq_player_projections_nonweekly
  on public.player_projections(
    player_id,
    provider,
    season,
    season_type,
    projection_type,
    coalesce(scoring_format, ''),
    version
  )
  where week is null;

create unique index if not exists uniq_player_injuries_source_observation
  on public.player_injuries(
    player_id,
    provider,
    source_updated_at,
    coalesce(team, ''),
    coalesce(status, ''),
    coalesce(practice_status, ''),
    coalesce(game_status, ''),
    coalesce(body_part, ''),
    coalesce(injury_type, '')
  )
  where source_updated_at is not null;

create index if not exists idx_player_weekly_stats_player_season_week
  on public.player_weekly_stats(player_id, season, week);

create index if not exists idx_player_weekly_stats_provider_season_week
  on public.player_weekly_stats(provider, season, week);

create index if not exists idx_player_weekly_stats_season_week_position_group
  on public.player_weekly_stats(season, week, position_group);

create index if not exists idx_player_weekly_stats_game_id
  on public.player_weekly_stats(game_id)
  where game_id is not null;

create index if not exists idx_player_weekly_stats_source_updated_at
  on public.player_weekly_stats(source_updated_at);

create index if not exists idx_player_season_stats_player_season
  on public.player_season_stats(player_id, season);

create index if not exists idx_player_season_stats_provider_season
  on public.player_season_stats(provider, season);

create index if not exists idx_player_season_stats_season_position_group
  on public.player_season_stats(season, position_group);

create index if not exists idx_player_projections_player_season_week
  on public.player_projections(player_id, season, week);

create index if not exists idx_player_projections_provider_season_projection_type
  on public.player_projections(provider, season, projection_type);

create index if not exists idx_player_projections_season_week_position_group
  on public.player_projections(season, week, position_group);

create index if not exists idx_player_projections_source_updated_at
  on public.player_projections(source_updated_at);

create index if not exists idx_player_injuries_player_id
  on public.player_injuries(player_id);

create index if not exists idx_player_injuries_provider_is_current
  on public.player_injuries(provider, is_current);

create index if not exists idx_player_injuries_player_is_current_latest
  on public.player_injuries(player_id, is_current, source_updated_at desc, observed_at desc);

create index if not exists idx_player_injuries_source_updated_at
  on public.player_injuries(source_updated_at);

create index if not exists idx_player_injuries_season_week
  on public.player_injuries(season, week)
  where season is not null or week is not null;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_player_weekly_stats_updated_at'
      and tgrelid = 'public.player_weekly_stats'::regclass
  ) then
    create trigger set_player_weekly_stats_updated_at
      before update on public.player_weekly_stats
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_player_season_stats_updated_at'
      and tgrelid = 'public.player_season_stats'::regclass
  ) then
    create trigger set_player_season_stats_updated_at
      before update on public.player_season_stats
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_player_projections_updated_at'
      and tgrelid = 'public.player_projections'::regclass
  ) then
    create trigger set_player_projections_updated_at
      before update on public.player_projections
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_player_injuries_updated_at'
      and tgrelid = 'public.player_injuries'::regclass
  ) then
    create trigger set_player_injuries_updated_at
      before update on public.player_injuries
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.player_weekly_stats enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.player_projections enable row level security;
alter table public.player_injuries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_weekly_stats'
      and policyname = 'Player weekly stats are readable to authenticated users'
  ) then
    create policy "Player weekly stats are readable to authenticated users"
      on public.player_weekly_stats
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_season_stats'
      and policyname = 'Player season stats are readable to authenticated users'
  ) then
    create policy "Player season stats are readable to authenticated users"
      on public.player_season_stats
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_projections'
      and policyname = 'Player projections are readable to authenticated users'
  ) then
    create policy "Player projections are readable to authenticated users"
      on public.player_projections
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_injuries'
      and policyname = 'Player injuries are readable to authenticated users'
  ) then
    create policy "Player injuries are readable to authenticated users"
      on public.player_injuries
      for select
      to authenticated
      using (true);
  end if;
end $$;
