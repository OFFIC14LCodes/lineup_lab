-- H8: Player context and evidence system
-- Apply separately after schema review. Validate tables, indexes, constraints, and RLS
-- before applying. Do not use a full unsafe db push.
--
-- Execution order:
--   1. context_evidence (immutable evidence records)
--   2. player_context_snapshots (versioned player context)
--   3. player_context_fields (individual field values)
--   4. context_evidence_links (field → evidence linkage)
--   5. context_contradictions (contradiction records)
--   6. team_context_snapshots (team-level context)
--   7. player_role_scenarios (per-player role scenarios)
--   8. Indexes and RLS

-- --------------------------------------------------------------------------
-- 1. Immutable evidence records
-- --------------------------------------------------------------------------

create table if not exists public.context_evidence (
  id                 uuid primary key default gen_random_uuid(),
  evidence_id        text unique not null,          -- deterministic hash; dedup key
  source_type        text not null,
  source_name        text,
  source_url         text,
  source_identifier  text,
  author             text,
  organization       text,
  published_at       timestamptz,
  captured_at        timestamptz not null default now(),
  effective_date     date,
  season             int,
  player_id          uuid references public.players(id),
  team_id            text references public.nfl_teams(id),
  evidence_category  text not null,
  normalized_claim   text not null,
  raw_excerpt        text,
  is_observed        boolean not null default true,
  confidence         numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  reliability_tier   int not null check (reliability_tier between 1 and 4),
  expiration_policy  text not null,
  expires_at         timestamptz,
  source_hash        text,
  parser_version     text,
  review_status      text not null default 'pending'
    check (review_status in ('pending','approved','rejected','superseded','needs_more_evidence')),
  created_at         timestamptz not null default now(),

  constraint context_evidence_claim_not_empty check (char_length(trim(normalized_claim)) > 0),
  constraint context_evidence_claim_max_len   check (char_length(normalized_claim) <= 500)
);

-- --------------------------------------------------------------------------
-- 2. Player context snapshots (versioned; never destructively overwritten)
-- --------------------------------------------------------------------------

create table if not exists public.player_context_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  canonical_player_id         uuid not null references public.players(id),
  season                      int not null,
  nfl_team                    text,
  position                    text,
  as_of_date                  date not null,
  context_version             int not null default 1,
  source_coverage_version     text,
  overall_confidence          text not null
    check (overall_confidence in ('verified','high','moderate','low','unresolved')),
  overall_status              text not null
    check (overall_status in ('current','stale','contradicted','unknown','not_applicable')),
  stale_field_count           int not null default 0,
  unresolved_field_count      int not null default 0,
  -- Profile blobs (normalized structure; each sub-profile is a JSONB blob)
  role_profile_json           jsonb,
  competition_profile_json    jsonb,
  team_environment_profile_json jsonb,
  coaching_scheme_json        jsonb,
  injury_availability_json    jsonb,
  transaction_context_json    jsonb,
  qb_environment_json         jsonb,
  ol_context_json             jsonb,
  role_scenarios_json         jsonb,
  derived_context_json        jsonb,
  historical_comparison_json  jsonb,
  -- Review
  manual_review_required      boolean not null default false,
  review_queue_reasons_json   jsonb not null default '[]'::jsonb,
  -- Team context refs
  team_environment_ref        uuid,
  coaching_scheme_ref         uuid,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 3. Individual context field values (granular evidence tracking)
-- --------------------------------------------------------------------------

create table if not exists public.player_context_fields (
  id                  uuid primary key default gen_random_uuid(),
  snapshot_id         uuid not null references public.player_context_snapshots(id) on delete cascade,
  field_path          text not null,       -- e.g. "roleProfile.depthChartPosition"
  value               jsonb,
  value_type          text not null,
  status              text not null
    check (status in ('observed','inferred','unknown','contradicted','stale','not_applicable')),
  confidence          numeric(4,3) check (confidence >= 0 and confidence <= 1),
  observed_at         timestamptz,
  effective_from      timestamptz,
  expires_at          timestamptz,
  last_reviewed_at    timestamptz,
  inference_method    text,
  contradiction_count int not null default 0,
  created_at          timestamptz not null default now(),

  unique (snapshot_id, field_path)
);

-- --------------------------------------------------------------------------
-- 4. Evidence links (field → evidence)
-- --------------------------------------------------------------------------

create table if not exists public.context_evidence_links (
  id           uuid primary key default gen_random_uuid(),
  snapshot_id  uuid not null references public.player_context_snapshots(id) on delete cascade,
  evidence_id  text not null references public.context_evidence(evidence_id),
  field_path   text not null,
  created_at   timestamptz not null default now(),

  unique (snapshot_id, evidence_id, field_path)
);

-- --------------------------------------------------------------------------
-- 5. Contradiction records
-- --------------------------------------------------------------------------

create table if not exists public.context_contradictions (
  id                       uuid primary key default gen_random_uuid(),
  snapshot_id              uuid not null references public.player_context_snapshots(id) on delete cascade,
  field_path               text not null,
  winning_evidence_id      text references public.context_evidence(evidence_id),
  superseded_evidence_ids  text[] not null default '{}',
  contradiction_reason     text,
  resolution_method        text
    check (resolution_method in ('reliability_tier','recency','manual_override','unresolved') or resolution_method is null),
  manual_review_required   boolean not null default false,
  resolved_at              timestamptz,
  created_at               timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 6. Team context snapshots
-- --------------------------------------------------------------------------

create table if not exists public.team_context_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  team_id                   text not null references public.nfl_teams(id),
  season                    int not null,
  as_of_date                date not null,
  context_version           int not null default 1,
  environment_profile_json  jsonb,
  coaching_scheme_json      jsonb,
  ol_context_json           jsonb,
  overall_confidence        text not null
    check (overall_confidence in ('verified','high','moderate','low','unresolved')),
  evidence_ids              text[] not null default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 7. Player role scenarios
-- --------------------------------------------------------------------------

create table if not exists public.player_role_scenarios (
  id            uuid primary key default gen_random_uuid(),
  snapshot_id   uuid not null references public.player_context_snapshots(id) on delete cascade,
  scenario_type text not null
    check (scenario_type in ('downside','median','upside')),
  role_label    text not null,
  probability   numeric(4,3) check (probability >= 0 and probability <= 1),
  triggers      text[] not null default '{}',
  evidence_ids  text[] not null default '{}',
  created_at    timestamptz not null default now(),

  unique (snapshot_id, scenario_type)
);

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_player_context_snapshots_player_season') then
    create index idx_player_context_snapshots_player_season
      on public.player_context_snapshots (canonical_player_id, season, as_of_date desc);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_player_context_snapshots_season_confidence') then
    create index idx_player_context_snapshots_season_confidence
      on public.player_context_snapshots (season, overall_confidence, overall_status);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_player_context_snapshots_team') then
    create index idx_player_context_snapshots_team
      on public.player_context_snapshots (nfl_team, season);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_player_context_snapshots_position') then
    create index idx_player_context_snapshots_position
      on public.player_context_snapshots (position, season);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_player_context_snapshots_review') then
    create index idx_player_context_snapshots_review
      on public.player_context_snapshots (manual_review_required, season)
      where manual_review_required = true;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_context_evidence_player') then
    create index idx_context_evidence_player on public.context_evidence (player_id, season);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_context_evidence_team') then
    create index idx_context_evidence_team on public.context_evidence (team_id, season);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_context_evidence_category') then
    create index idx_context_evidence_category
      on public.context_evidence (evidence_category, reliability_tier, captured_at desc);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_context_evidence_expiry') then
    create index idx_context_evidence_expiry on public.context_evidence (expires_at)
      where expires_at is not null;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_team_context_snapshots_team_season') then
    create index idx_team_context_snapshots_team_season
      on public.team_context_snapshots (team_id, season, as_of_date desc);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_context_contradictions_snapshot') then
    create index idx_context_contradictions_snapshot
      on public.context_contradictions (snapshot_id, manual_review_required);
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------

alter table public.context_evidence enable row level security;
alter table public.player_context_snapshots enable row level security;
alter table public.player_context_fields enable row level security;
alter table public.context_evidence_links enable row level security;
alter table public.context_contradictions enable row level security;
alter table public.team_context_snapshots enable row level security;
alter table public.player_role_scenarios enable row level security;

-- Authenticated users can read
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'context_evidence_select' and tablename = 'context_evidence') then
    create policy context_evidence_select on public.context_evidence
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'player_context_snapshots_select' and tablename = 'player_context_snapshots') then
    create policy player_context_snapshots_select on public.player_context_snapshots
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'player_context_fields_select' and tablename = 'player_context_fields') then
    create policy player_context_fields_select on public.player_context_fields
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'context_evidence_links_select' and tablename = 'context_evidence_links') then
    create policy context_evidence_links_select on public.context_evidence_links
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'context_contradictions_select' and tablename = 'context_contradictions') then
    create policy context_contradictions_select on public.context_contradictions
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'team_context_snapshots_select' and tablename = 'team_context_snapshots') then
    create policy team_context_snapshots_select on public.team_context_snapshots
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'player_role_scenarios_select' and tablename = 'player_role_scenarios') then
    create policy player_role_scenarios_select on public.player_role_scenarios
      for select to authenticated using (true);
  end if;
end $$;
