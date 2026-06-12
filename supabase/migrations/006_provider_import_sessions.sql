create table if not exists public.provider_import_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  dataset_kind text not null,
  filename text not null,
  source_hash text not null,
  session_payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'previewed',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_import_sessions_provider_lowercase'
      and conrelid = 'public.provider_import_sessions'::regclass
  ) then
    alter table public.provider_import_sessions
      add constraint provider_import_sessions_provider_lowercase
      check (provider = lower(provider));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_import_sessions_dataset_kind_check'
      and conrelid = 'public.provider_import_sessions'::regclass
  ) then
    alter table public.provider_import_sessions
      add constraint provider_import_sessions_dataset_kind_check
      check (dataset_kind in ('weekly_stats', 'season_stats', 'projection', 'injury'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_import_sessions_status_check'
      and conrelid = 'public.provider_import_sessions'::regclass
  ) then
    alter table public.provider_import_sessions
      add constraint provider_import_sessions_status_check
      check (status in ('previewed', 'mapping_review', 'ready', 'executing', 'completed', 'partially_failed', 'failed', 'expired', 'cancelled'));
  end if;
end $$;

create index if not exists idx_provider_import_sessions_user_created_at
  on public.provider_import_sessions(user_id, created_at desc);

create index if not exists idx_provider_import_sessions_user_status_created_at
  on public.provider_import_sessions(user_id, status, created_at desc);

create index if not exists idx_provider_import_sessions_status_expires_at
  on public.provider_import_sessions(status, expires_at);

create index if not exists idx_provider_import_sessions_expires_at
  on public.provider_import_sessions(expires_at);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_provider_import_sessions_updated_at'
      and tgrelid = 'public.provider_import_sessions'::regclass
  ) then
    create trigger set_provider_import_sessions_updated_at
      before update on public.provider_import_sessions
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.provider_import_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_import_sessions'
      and policyname = 'Provider import sessions are readable to owners'
  ) then
    create policy "Provider import sessions are readable to owners"
      on public.provider_import_sessions
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;
