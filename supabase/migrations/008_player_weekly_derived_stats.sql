-- Provider-neutral event-derived weekly stats.
-- One row per player / season / week / stat_scope.
-- The scoring engine merges these keys onto aggregate weekly stats without
-- overwriting base stats (rec_td, rush_td, pass_int, etc.).
create table if not exists public.player_weekly_derived_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season integer not null,
  week integer not null,
  season_type text not null default 'regular',
  -- Identifies the derivation algorithm / source scope.
  stat_scope text not null default 'event_derived',
  -- Derived canonical stats (rec_td_40p, rec_td_50p, rush_td_40p, rush_td_50p, pass_pick6).
  -- Known-zero fields are always present after a complete derivation run for the player/week.
  -- Absent keys indicate the derivation has not yet been run for this player/week.
  stats_json jsonb not null default '{}'::jsonb,
  -- Completeness of the derivation run for this row.
  --   complete: all qualifying plays for this player/week have been processed
  --   partial:  derivation run was interrupted before finishing this player/week
  completeness text not null default 'complete',
  -- Provenance links back to the source artifact and import batch.
  source_artifact_id uuid references public.football_data_sources(id),
  import_batch_id uuid references public.football_import_batches(id),
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Natural key: one derived row per player / season / week / season_type / stat_scope.
create unique index if not exists uniq_player_weekly_derived_stats_scope
  on public.player_weekly_derived_stats(player_id, season, week, season_type, stat_scope);

-- Supporting indexes.
create index if not exists idx_player_weekly_derived_stats_player_season_week
  on public.player_weekly_derived_stats(player_id, season, week);

create index if not exists idx_player_weekly_derived_stats_season_week
  on public.player_weekly_derived_stats(season, week, season_type);

create index if not exists idx_player_weekly_derived_stats_import_batch
  on public.player_weekly_derived_stats(import_batch_id)
  where import_batch_id is not null;

-- Constraints.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_derived_stats_season_check'
      and conrelid = 'public.player_weekly_derived_stats'::regclass
  ) then
    alter table public.player_weekly_derived_stats
      add constraint player_weekly_derived_stats_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_derived_stats_week_check'
      and conrelid = 'public.player_weekly_derived_stats'::regclass
  ) then
    alter table public.player_weekly_derived_stats
      add constraint player_weekly_derived_stats_week_check
      check (week between 1 and 25);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_derived_stats_season_type_check'
      and conrelid = 'public.player_weekly_derived_stats'::regclass
  ) then
    alter table public.player_weekly_derived_stats
      add constraint player_weekly_derived_stats_season_type_check
      check (season_type in ('preseason', 'regular', 'postseason'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_derived_stats_completeness_check'
      and conrelid = 'public.player_weekly_derived_stats'::regclass
  ) then
    alter table public.player_weekly_derived_stats
      add constraint player_weekly_derived_stats_completeness_check
      check (completeness in ('complete', 'partial'));
  end if;
end $$;

-- Updated-at trigger.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_player_weekly_derived_stats_updated_at'
      and tgrelid = 'public.player_weekly_derived_stats'::regclass
  ) then
    create trigger set_player_weekly_derived_stats_updated_at
      before update on public.player_weekly_derived_stats
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS: operator-only write access; authenticated users may read.
alter table public.player_weekly_derived_stats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_weekly_derived_stats'
      and policyname = 'Player weekly derived stats are readable to authenticated users'
  ) then
    create policy "Player weekly derived stats are readable to authenticated users"
      on public.player_weekly_derived_stats
      for select
      to authenticated
      using (true);
  end if;
end $$;
