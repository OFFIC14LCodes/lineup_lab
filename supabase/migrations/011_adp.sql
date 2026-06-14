-- H7: ADP snapshot storage
-- Immutable once written; deduplication via file_hash unique constraint.

create table if not exists public.adp_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_identifier text not null,
  file_hash text not null,
  source_meta_json jsonb not null,
  source_confidence text not null default 'medium',
  season int not null,
  team_count int not null,
  scoring_format text not null,
  ppr_value numeric(4,2) not null default 1.0,
  te_premium_value numeric(4,2) not null default 0.0,
  is_dynasty boolean not null default false,
  is_best_ball boolean not null default false,
  is_superflex boolean not null default false,
  sample_size int,
  captured_at timestamptz not null,
  effective_date date not null,
  imported_at timestamptz not null default now(),
  total_records int not null default 0,
  resolved_count int not null default 0,
  unresolved_count int not null default 0,
  ambiguous_count int not null default 0,
  rookie_count int not null default 0
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'adp_snapshots_file_hash_unique'
      and conrelid = 'public.adp_snapshots'::regclass
  ) then
    alter table public.adp_snapshots
      add constraint adp_snapshots_file_hash_unique unique (file_hash);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'adp_snapshots_provider_lowercase'
      and conrelid = 'public.adp_snapshots'::regclass
  ) then
    alter table public.adp_snapshots
      add constraint adp_snapshots_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'adp_snapshots_confidence_check'
      and conrelid = 'public.adp_snapshots'::regclass
  ) then
    alter table public.adp_snapshots
      add constraint adp_snapshots_confidence_check
      check (source_confidence in ('high', 'medium', 'low', 'unknown'));
  end if;
end $$;

create index if not exists idx_adp_snapshots_provider_season
  on public.adp_snapshots(provider, season);

create index if not exists idx_adp_snapshots_season_captured
  on public.adp_snapshots(season, captured_at desc);

-- Per-player ADP records, one row per player per snapshot
create table if not exists public.adp_player_records (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.adp_snapshots(id) on delete cascade,
  canonical_player_id uuid references public.players(id),
  sleeper_player_id text,
  raw_name text not null,
  raw_position text,
  raw_team text,
  raw_id text,
  overall_adp numeric(8,3) not null,
  overall_rank int,
  positional_adp numeric(8,3),
  positional_rank int,
  min_pick int,
  max_pick int,
  stddev numeric(6,3),
  sample_size int,
  identity_match_method text,
  identity_match_confidence numeric(5,4),
  is_rookie boolean not null default false,
  has_historical_profile boolean not null default false,
  raw_data_json jsonb
);

create index if not exists idx_adp_player_records_snapshot
  on public.adp_player_records(snapshot_id);

create index if not exists idx_adp_player_records_canonical
  on public.adp_player_records(canonical_player_id)
  where canonical_player_id is not null;

create index if not exists idx_adp_player_records_overall_adp
  on public.adp_player_records(snapshot_id, overall_adp);

-- ADP movement tracking between consecutive snapshots from the same provider+format
create table if not exists public.adp_player_movements (
  id uuid primary key default gen_random_uuid(),
  from_snapshot_id uuid not null references public.adp_snapshots(id),
  to_snapshot_id uuid not null references public.adp_snapshots(id),
  canonical_player_id uuid references public.players(id),
  raw_name text not null,
  from_adp numeric(8,3),
  to_adp numeric(8,3),
  adp_delta numeric(8,3),
  from_rank int,
  to_rank int,
  rank_delta int,
  computed_at timestamptz not null default now()
);

create index if not exists idx_adp_movements_to_snapshot
  on public.adp_player_movements(to_snapshot_id);

create index if not exists idx_adp_movements_canonical
  on public.adp_player_movements(canonical_player_id)
  where canonical_player_id is not null;

-- RLS: service-role writes; authenticated reads
alter table public.adp_snapshots enable row level security;
alter table public.adp_player_records enable row level security;
alter table public.adp_player_movements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'adp_snapshots'
      and policyname = 'adp_snapshots_select_authenticated'
  ) then
    create policy "adp_snapshots_select_authenticated"
      on public.adp_snapshots for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'adp_player_records'
      and policyname = 'adp_player_records_select_authenticated'
  ) then
    create policy "adp_player_records_select_authenticated"
      on public.adp_player_records for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'adp_player_movements'
      and policyname = 'adp_player_movements_select_authenticated'
  ) then
    create policy "adp_player_movements_select_authenticated"
      on public.adp_player_movements for select to authenticated using (true);
  end if;
end $$;
