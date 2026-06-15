-- H9.6: Projection market comparison lineage.
--
-- Stores ADP/market comparison outputs separately from immutable projection
-- points. Projection outputs may still mirror the compact agreement fields,
-- but source lineage, warnings, and semantic market hashes live here.

create table if not exists public.player_projection_market_comparisons (
  comparison_id              uuid          primary key default gen_random_uuid(),
  projection_run_id          uuid          not null references public.projection_runs(projection_run_id) on delete cascade,
  canonical_player_id        uuid          not null references public.players(id),
  league_id                  uuid          not null references public.leagues(id),
  market_overall_adp         numeric(8,3),
  market_position_adp        numeric(8,3),
  market_position_rank       int,
  projected_position_rank    int           not null,
  rank_delta                 int,
  absolute_rank_delta        int,
  market_agreement_score     numeric(7,6),
  market_discrepancy_label   text          not null,
  compatibility_label        text          not null,
  market_confidence_label    text          not null,
  provider_count             int           not null default 0,
  provider_disagreement      numeric(8,3),
  source_contributions_json  jsonb         not null default '[]',
  format_warnings_json       jsonb         not null default '[]',
  reason_codes               text[]        not null default '{}',
  semantic_market_hash       text          not null,
  created_at                 timestamptz   not null default now(),
  updated_at                 timestamptz   not null default now(),

  constraint ppmc_unique_projection_player_league
    unique (projection_run_id, canonical_player_id, league_id),

  constraint ppmc_market_discrepancy_label_check
    check (market_discrepancy_label in (
      'aligned', 'slight_disagreement', 'moderate_disagreement',
      'strong_disagreement', 'no_compatible_market'
    )),

  constraint ppmc_compatibility_label_check
    check (compatibility_label in (
      'EXACT_MATCH', 'STRONG_MATCH', 'PARTIAL_MATCH', 'WEAK_MATCH',
      'INCOMPATIBLE', 'NO_MARKET_DATA'
    )),

  constraint ppmc_market_confidence_label_check
    check (market_confidence_label in ('high', 'medium', 'low', 'none')),

  constraint ppmc_provider_count_range
    check (provider_count >= 0),

  constraint ppmc_rank_delta_consistency
    check (
      (rank_delta is null and absolute_rank_delta is null)
      or (rank_delta is not null and absolute_rank_delta = abs(rank_delta))
    ),

  constraint ppmc_market_agreement_score_range
    check (
      market_agreement_score is null
      or (market_agreement_score >= 0 and market_agreement_score <= 1)
    )
);

create index if not exists idx_ppmc_run_league_rank_delta
  on public.player_projection_market_comparisons (projection_run_id, league_id, rank_delta desc);

create index if not exists idx_ppmc_run_discrepancy
  on public.player_projection_market_comparisons (projection_run_id, market_discrepancy_label);

create index if not exists idx_ppmc_market_hash
  on public.player_projection_market_comparisons (semantic_market_hash);

alter table public.player_projection_market_comparisons enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_projection_market_comparisons'
      and policyname = 'player_projection_market_comparisons_select_own_leagues'
  ) then
    create policy "player_projection_market_comparisons_select_own_leagues"
      on public.player_projection_market_comparisons for select to authenticated
      using (
        exists (
          select 1 from public.leagues l
          where l.id = player_projection_market_comparisons.league_id
            and l.user_id = auth.uid()
        )
      );
  end if;
end $$;
