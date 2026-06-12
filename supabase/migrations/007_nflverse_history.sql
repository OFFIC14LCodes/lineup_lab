-- Tracks raw source artifacts downloaded from external providers.
-- One row per unique file (identified by sha256). Idempotent: check sha256 before inserting.
create table if not exists public.football_data_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_type text not null,
  season integer not null,
  source_url text not null,
  file_path text not null,
  sha256 text not null,
  row_count integer,
  downloaded_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tracks each import run against a data source artifact.
create table if not exists public.football_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.football_data_sources(id),
  season integer not null,
  mode text not null default 'dry_run',
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-row ingestion tracking for a batch run.
create table if not exists public.football_source_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.football_import_batches(id) on delete cascade,
  source_row_number integer not null,
  row_sha256 text not null,
  player_id uuid references public.players(id),
  gsis_id text,
  resolution_status text not null,
  write_status text,
  canonical_key_count integer,
  error_message text,
  created_at timestamptz not null default now()
);

-- Manual stat corrections applied over ingested data.
create table if not exists public.football_stat_corrections (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  provider text not null,
  season integer not null,
  week integer not null,
  stat_key text not null,
  original_value numeric,
  corrected_value numeric,
  correction_reason text,
  corrected_by text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constraints

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_data_sources_provider_lowercase'
      and conrelid = 'public.football_data_sources'::regclass
  ) then
    alter table public.football_data_sources
      add constraint football_data_sources_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_data_sources_season_check'
      and conrelid = 'public.football_data_sources'::regclass
  ) then
    alter table public.football_data_sources
      add constraint football_data_sources_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_import_batches_mode_check'
      and conrelid = 'public.football_import_batches'::regclass
  ) then
    alter table public.football_import_batches
      add constraint football_import_batches_mode_check
      check (mode in ('dry_run', 'execute'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_import_batches_status_check'
      and conrelid = 'public.football_import_batches'::regclass
  ) then
    alter table public.football_import_batches
      add constraint football_import_batches_status_check
      check (status in ('pending', 'in_progress', 'completed', 'failed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_source_rows_resolution_status_check'
      and conrelid = 'public.football_source_rows'::regclass
  ) then
    alter table public.football_source_rows
      add constraint football_source_rows_resolution_status_check
      check (resolution_status in ('resolved', 'unresolved', 'rejected', 'skipped'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_source_rows_write_status_check'
      and conrelid = 'public.football_source_rows'::regclass
  ) then
    alter table public.football_source_rows
      add constraint football_source_rows_write_status_check
      check (write_status is null or write_status in ('written', 'skipped_dry_run', 'error'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_stat_corrections_season_check'
      and conrelid = 'public.football_stat_corrections'::regclass
  ) then
    alter table public.football_stat_corrections
      add constraint football_stat_corrections_season_check
      check (season between 1900 and 3000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'football_stat_corrections_week_check'
      and conrelid = 'public.football_stat_corrections'::regclass
  ) then
    alter table public.football_stat_corrections
      add constraint football_stat_corrections_week_check
      check (week between 1 and 25);
  end if;
end $$;

-- Unique index: one source record per unique file fingerprint per provider/season/type
create unique index if not exists uniq_football_data_sources_sha256
  on public.football_data_sources(provider, source_type, season, sha256);

-- Indexes
create index if not exists idx_football_data_sources_provider_season
  on public.football_data_sources(provider, season);

create index if not exists idx_football_import_batches_source_id
  on public.football_import_batches(source_id);

create index if not exists idx_football_import_batches_season_status
  on public.football_import_batches(season, status);

create index if not exists idx_football_source_rows_batch_id
  on public.football_source_rows(batch_id);

create index if not exists idx_football_source_rows_gsis_id
  on public.football_source_rows(gsis_id)
  where gsis_id is not null;

create index if not exists idx_football_stat_corrections_player_season
  on public.football_stat_corrections(player_id, season, week);

-- Updated-at triggers

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_football_data_sources_updated_at'
      and tgrelid = 'public.football_data_sources'::regclass
  ) then
    create trigger set_football_data_sources_updated_at
      before update on public.football_data_sources
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_football_import_batches_updated_at'
      and tgrelid = 'public.football_import_batches'::regclass
  ) then
    create trigger set_football_import_batches_updated_at
      before update on public.football_import_batches
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_football_stat_corrections_updated_at'
      and tgrelid = 'public.football_stat_corrections'::regclass
  ) then
    create trigger set_football_stat_corrections_updated_at
      before update on public.football_stat_corrections
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS

alter table public.football_data_sources enable row level security;
alter table public.football_import_batches enable row level security;
alter table public.football_source_rows enable row level security;
alter table public.football_stat_corrections enable row level security;

-- All four tables are operator-only (service role). No authenticated-user read policies.
-- The nflverse import pipeline runs server-side with the service role key only.
