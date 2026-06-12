create table if not exists public.player_external_ids (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  provider text not null,
  external_id text not null,
  external_type text not null default 'player',
  season integer,
  team text,
  position_group text,
  mapping_status text not null default 'unverified',
  mapping_method text,
  confidence numeric,
  metadata_json jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_external_ids_provider_lowercase'
      and conrelid = 'public.player_external_ids'::regclass
  ) then
    alter table public.player_external_ids
      add constraint player_external_ids_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_external_ids_external_id_not_blank'
      and conrelid = 'public.player_external_ids'::regclass
  ) then
    alter table public.player_external_ids
      add constraint player_external_ids_external_id_not_blank
      check (length(btrim(external_id)) > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_external_ids_external_type_check'
      and conrelid = 'public.player_external_ids'::regclass
  ) then
    alter table public.player_external_ids
      add constraint player_external_ids_external_type_check
      check (external_type in ('player', 'team_defense', 'team', 'gsis', 'provider_player'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_external_ids_mapping_status_check'
      and conrelid = 'public.player_external_ids'::regclass
  ) then
    alter table public.player_external_ids
      add constraint player_external_ids_mapping_status_check
      check (mapping_status in ('verified', 'auto_matched', 'manual_review', 'rejected', 'unverified'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_external_ids_confidence_check'
      and conrelid = 'public.player_external_ids'::regclass
  ) then
    alter table public.player_external_ids
      add constraint player_external_ids_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

create unique index if not exists uniq_player_external_ids_provider_external
  on public.player_external_ids(provider, external_id, external_type);

create unique index if not exists uniq_player_external_ids_player_current
  on public.player_external_ids(player_id, provider, external_type)
  where season is null;

create unique index if not exists uniq_player_external_ids_player_season
  on public.player_external_ids(player_id, provider, external_type, season)
  where season is not null;

create index if not exists idx_player_external_ids_player_id
  on public.player_external_ids(player_id);

create index if not exists idx_player_external_ids_provider_external_id
  on public.player_external_ids(provider, external_id);

create index if not exists idx_player_external_ids_provider_mapping_status
  on public.player_external_ids(provider, mapping_status);

create index if not exists idx_player_external_ids_player_provider
  on public.player_external_ids(player_id, provider);

create index if not exists idx_player_external_ids_season
  on public.player_external_ids(season)
  where season is not null;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_player_external_ids_updated_at'
      and tgrelid = 'public.player_external_ids'::regclass
  ) then
    create trigger set_player_external_ids_updated_at
      before update on public.player_external_ids
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.player_external_ids enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_external_ids'
      and policyname = 'Player external ids are readable to authenticated users'
  ) then
    create policy "Player external ids are readable to authenticated users"
      on public.player_external_ids
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.players p
          where p.id = player_id
        )
      );
  end if;
end $$;
