-- H9-lite: Projection engine tables.
--
-- Schema compatibility verified against prior migrations before writing:
--   leagues.id            → uuid PRIMARY KEY        (001_initial_schema.sql)
--   players.id            → uuid PRIMARY KEY        (001_initial_schema.sql)
--   adp_player_records.id → uuid PRIMARY KEY        (011_adp.sql)
--   player_context_snapshots.id → uuid PRIMARY KEY  (012_player_context.sql)
--   context_evidence.evidence_id → text (not uuid)  (012_player_context.sql)
--
-- All foreign-key types match verified source columns.
-- adp_record_ids is uuid[] without a FK constraint (arrays cannot carry FKs).
-- source_evidence_ids is text[] to match context_evidence.evidence_id.
--
-- Execution order:
--   1. projection_runs
--   2. player_projection_inputs   (references projection_runs, players, player_context_snapshots)
--   3. player_projection_outputs  (references projection_runs, players, leagues)
--   4. projection_reasons         (references projection_runs, players, leagues)
--   5. Indexes
--   6. RLS

-- --------------------------------------------------------------------------
-- 1. projection_runs
-- --------------------------------------------------------------------------

create table if not exists public.projection_runs (
  projection_run_id    uuid          primary key default gen_random_uuid(),
  projection_version   int           not null default 1,
  historical_season    int           not null,
  projection_season    int           not null,
  league_config_season int           not null,
  context_version      int           not null,
  as_of_date           date          not null,
  method               text          not null default 'blackbird_baseline_v1',
  code_version         text          not null,
  model_config_json    jsonb         not null,
  semantic_input_hash  text          not null,
  selection_scope      text          not null,
  run_status           text          not null default 'pending',
  started_at           timestamptz,
  completed_at         timestamptz,
  failed_at            timestamptz,
  failure_code         text,
  failure_message      text,
  population_count     int,
  league_count         int,
  input_count          int,
  output_count         int,
  reason_count         int,
  created_at           timestamptz   not null default now(),

  constraint projection_runs_status_check
    check (run_status in (
      'pending', 'computing', 'ready_to_persist', 'persisting',
      'complete', 'interrupted', 'failed'
    )),
  constraint projection_runs_semantic_hash_unique
    unique (semantic_input_hash)
);

-- --------------------------------------------------------------------------
-- 2. player_projection_inputs — one row per player per run
-- --------------------------------------------------------------------------

create table if not exists public.player_projection_inputs (
  input_id                        uuid          primary key default gen_random_uuid(),
  projection_run_id               uuid          not null references public.projection_runs(projection_run_id) on delete cascade,
  canonical_player_id             uuid          not null references public.players(id),
  position                        text          not null,
  role_sample_class               text          not null,
  role_sample_confidence          text          not null,
  games_confidence                text          not null,
  historical_active_weeks         int           not null,
  historical_role_weeks           int           not null,
  role_participation_factor       numeric(7,6)  not null,
  projected_active_games_floor    int           not null,
  projected_active_games_median   int           not null,
  projected_active_games_ceiling  int           not null,
  projected_role_games_floor      int           not null,
  projected_role_games_median     int           not null,
  projected_role_games_ceiling    int           not null,
  model_uncertainty               numeric(7,6)  not null,
  player_volatility               numeric(7,6)  not null,
  total_range_width               numeric(7,6)  not null,
  projection_confidence_score     numeric(7,6)  not null,
  projection_confidence_label     text          not null,
  h8_snapshot_id                  uuid          references public.player_context_snapshots(id),
  adp_record_ids                  uuid[]        not null default '{}',
  player_data_hash                text          not null,
  player_projection_input_hash    text          not null,
  created_at                      timestamptz   not null default now(),

  -- Position must be a valid fantasy projection position
  constraint ppi_position_check
    check (position in ('QB', 'RB', 'WR', 'TE')),

  -- Role sample class values from constants
  constraint ppi_role_sample_class_check
    check (role_sample_class in (
      'ESTABLISHED_FULL_SEASON', 'ESTABLISHED_PARTIAL_SEASON',
      'PART_TIME_CONTRIBUTOR', 'BACKUP_OR_SPOT_STARTER',
      'MINIMAL_SAMPLE', 'ROLE_UNKNOWN'
    )),

  -- Confidence labels
  constraint ppi_role_sample_confidence_check
    check (role_sample_confidence in ('high', 'medium', 'low', 'very_low')),

  constraint ppi_games_confidence_check
    check (games_confidence in ('high', 'medium', 'low', 'very_low')),

  constraint ppi_projection_confidence_label_check
    check (projection_confidence_label in ('high', 'medium', 'low', 'very_low')),

  -- Numeric range invariants
  constraint ppi_role_participation_factor_range
    check (role_participation_factor >= 0 and role_participation_factor <= 1),

  constraint ppi_projection_confidence_score_range
    check (projection_confidence_score >= 0 and projection_confidence_score <= 1),

  constraint ppi_model_uncertainty_range
    check (model_uncertainty >= 0),

  constraint ppi_player_volatility_range
    check (player_volatility >= 0),

  constraint ppi_total_range_width_range
    check (total_range_width >= 0 and total_range_width <= 1),

  -- Historical weeks ordering
  constraint ppi_historical_weeks_ordering
    check (historical_role_weeks >= 0 and historical_role_weeks <= historical_active_weeks),

  -- Games projection ordering: floor ≤ median ≤ ceiling
  constraint ppi_active_games_ordering
    check (
      projected_active_games_floor >= 0
      and projected_active_games_floor <= projected_active_games_median
      and projected_active_games_median <= projected_active_games_ceiling
    ),

  constraint ppi_role_games_ordering
    check (
      projected_role_games_floor >= 0
      and projected_role_games_floor <= projected_role_games_median
      and projected_role_games_median <= projected_role_games_ceiling
    ),

  -- Role games cannot exceed active games (median and ceiling independently enforced)
  constraint ppi_role_not_exceed_active_median
    check (projected_role_games_median <= projected_active_games_median),

  constraint ppi_role_not_exceed_active_ceiling
    check (projected_role_games_ceiling <= projected_active_games_ceiling),

  -- One row per player per run
  constraint ppi_unique_player_run
    unique (projection_run_id, canonical_player_id)
);

-- --------------------------------------------------------------------------
-- 3. player_projection_outputs — one row per player per league per run
-- --------------------------------------------------------------------------

create table if not exists public.player_projection_outputs (
  output_id                    uuid          primary key default gen_random_uuid(),
  projection_run_id            uuid          not null references public.projection_runs(projection_run_id) on delete cascade,
  canonical_player_id          uuid          not null references public.players(id),
  league_id                    uuid          not null references public.leagues(id),
  position                     text          not null,
  projected_ppg_when_in_role   numeric(10,4) not null,
  floor_ppg                    numeric(10,4) not null,
  ceiling_ppg                  numeric(10,4) not null,
  downside_points              numeric(12,4) not null,
  floor_points                 numeric(12,4) not null,
  median_points                numeric(12,4) not null,
  ceiling_points               numeric(12,4) not null,
  upside_points                numeric(12,4) not null,
  model_uncertainty            numeric(7,6)  not null,
  player_volatility            numeric(7,6)  not null,
  total_range_width            numeric(7,6)  not null,
  projection_confidence_score  numeric(7,6)  not null,
  projection_confidence_label  text          not null,
  market_agreement_score       numeric(7,6),            -- null if no compatible ADP
  market_discrepancy           int,                     -- signed; positive = Blackbird ranks player higher
  market_discrepancy_label     text,                    -- null if no compatible ADP
  projected_position_rank      int,                     -- null until Pass 6 ranking completes
  projected_components_json    jsonb,                   -- full stat component breakdown per scenario
  projection_method            text          not null,
  player_projection_input_hash text          not null,  -- traceability to input
  created_at                   timestamptz   not null default now(),

  -- Position
  constraint ppo_position_check
    check (position in ('QB', 'RB', 'WR', 'TE')),

  -- Confidence labels
  constraint ppo_projection_confidence_label_check
    check (projection_confidence_label in ('high', 'medium', 'low', 'very_low')),

  -- Market discrepancy label (nullable but constrained when present)
  constraint ppo_market_discrepancy_label_check
    check (
      market_discrepancy_label is null
      or market_discrepancy_label in (
        'aligned', 'slight_disagreement', 'moderate_disagreement',
        'strong_disagreement', 'no_compatible_adp'
      )
    ),

  -- Numeric ranges
  constraint ppo_projection_confidence_score_range
    check (projection_confidence_score >= 0 and projection_confidence_score <= 1),

  constraint ppo_model_uncertainty_range
    check (model_uncertainty >= 0),

  constraint ppo_player_volatility_range
    check (player_volatility >= 0),

  constraint ppo_total_range_width_range
    check (total_range_width >= 0 and total_range_width <= 1),

  constraint ppo_market_agreement_score_range
    check (
      market_agreement_score is null
      or (market_agreement_score >= 0 and market_agreement_score <= 1)
    ),

  -- Scenario ordering invariants
  -- Note: downside ≤ floor and ceiling ≤ upside use separate constraints because
  -- floor_points may be negative in penalty-heavy scoring configurations.
  constraint ppo_floor_median_ceiling_ordering
    check (floor_points <= median_points and median_points <= ceiling_points),

  constraint ppo_downside_lte_floor
    check (downside_points <= floor_points),

  constraint ppo_ceiling_lte_upside
    check (ceiling_points <= upside_points),

  -- Projected rank must be positive when set
  constraint ppo_position_rank_positive
    check (projected_position_rank is null or projected_position_rank >= 1),

  -- One row per player per league per run
  constraint ppo_unique_player_league_run
    unique (projection_run_id, canonical_player_id, league_id)
);

-- --------------------------------------------------------------------------
-- 4. projection_reasons — one row per reason per player (per league or global)
-- --------------------------------------------------------------------------

create table if not exists public.projection_reasons (
  reason_id            uuid          primary key default gen_random_uuid(),
  projection_run_id    uuid          not null references public.projection_runs(projection_run_id) on delete cascade,
  canonical_player_id  uuid          not null references public.players(id),
  league_id            uuid          references public.leagues(id),  -- null for global reasons
  reason_code          text          not null,
  reason_scope         text          not null,
  direction            text          not null,
  magnitude            numeric(12,4),
  explanation          text          not null,
  source_evidence_ids  text[]        not null default '{}',          -- context_evidence.evidence_id (text)
  reason_key           text          not null,
  created_at           timestamptz   not null default now(),

  -- Direction values
  constraint pr_direction_check
    check (direction in ('up', 'down', 'neutral', 'widened', 'narrowed', 'excluded')),

  -- Explanation must not be empty
  constraint pr_explanation_not_empty
    check (char_length(trim(explanation)) > 0),

  -- Reason code must not be empty
  constraint pr_reason_code_not_empty
    check (char_length(trim(reason_code)) > 0),

  -- Reason scope must not be empty
  constraint pr_reason_scope_not_empty
    check (char_length(trim(reason_scope)) > 0),

  -- Global uniqueness via reason_key — safe for ON CONFLICT (reason_key) DO NOTHING
  constraint pr_reason_key_unique
    unique (reason_key)
);

-- --------------------------------------------------------------------------
-- 5. Indexes
-- --------------------------------------------------------------------------

-- projection_runs
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_projection_runs_status_season') then
    create index idx_projection_runs_status_season
      on public.projection_runs (run_status, historical_season, projection_season);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_projection_runs_method') then
    create index idx_projection_runs_method
      on public.projection_runs (method, projection_version);
  end if;
end $$;

-- player_projection_inputs
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppi_player') then
    create index idx_ppi_player
      on public.player_projection_inputs (canonical_player_id, projection_run_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppi_run_position') then
    create index idx_ppi_run_position
      on public.player_projection_inputs (projection_run_id, position, role_sample_class);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppi_h8_snapshot') then
    create index idx_ppi_h8_snapshot
      on public.player_projection_inputs (h8_snapshot_id)
      where h8_snapshot_id is not null;
  end if;
end $$;

-- player_projection_outputs
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppo_player_league') then
    create index idx_ppo_player_league
      on public.player_projection_outputs (canonical_player_id, league_id, projection_run_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppo_run_position_rank') then
    create index idx_ppo_run_position_rank
      on public.player_projection_outputs (projection_run_id, league_id, position, projected_position_rank);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppo_run_median_points') then
    create index idx_ppo_run_median_points
      on public.player_projection_outputs (projection_run_id, league_id, median_points desc);
  end if;
end $$;

-- projection_reasons
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_pr_player_run') then
    create index idx_pr_player_run
      on public.projection_reasons (projection_run_id, canonical_player_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_pr_code') then
    create index idx_pr_code
      on public.projection_reasons (reason_code, reason_scope);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_pr_league') then
    create index idx_pr_league
      on public.projection_reasons (league_id, projection_run_id)
      where league_id is not null;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 6. Row-level security
-- --------------------------------------------------------------------------

alter table public.projection_runs         enable row level security;
alter table public.player_projection_inputs enable row level security;
alter table public.player_projection_outputs enable row level security;
alter table public.projection_reasons      enable row level security;

-- projection_runs: readable by all authenticated users (shared reference data)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projection_runs'
      and policyname = 'projection_runs_select_authenticated'
  ) then
    create policy "projection_runs_select_authenticated"
      on public.projection_runs for select to authenticated using (true);
  end if;
end $$;

-- player_projection_inputs: readable by all authenticated users
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_projection_inputs'
      and policyname = 'player_projection_inputs_select_authenticated'
  ) then
    create policy "player_projection_inputs_select_authenticated"
      on public.player_projection_inputs for select to authenticated using (true);
  end if;
end $$;

-- player_projection_outputs: readable for leagues the user owns
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_projection_outputs'
      and policyname = 'player_projection_outputs_select_own_leagues'
  ) then
    create policy "player_projection_outputs_select_own_leagues"
      on public.player_projection_outputs for select to authenticated
      using (
        exists (
          select 1 from public.leagues l
          where l.id = league_id
            and l.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- projection_reasons: global reasons (no league) are public; league-scoped reasons
-- follow league ownership.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projection_reasons'
      and policyname = 'projection_reasons_select_authenticated'
  ) then
    create policy "projection_reasons_select_authenticated"
      on public.projection_reasons for select to authenticated
      using (
        league_id is null
        or exists (
          select 1 from public.leagues l
          where l.id = league_id
            and l.user_id = auth.uid()
        )
      );
  end if;
end $$;
