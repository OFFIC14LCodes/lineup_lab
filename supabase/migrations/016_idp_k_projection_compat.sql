-- H9.11: Extend existing projection tables for IDP/K baseline persistence.
--
-- This keeps H9.10/H9.11 in the existing projection_runs /
-- player_projection_inputs / player_projection_outputs / projection_reasons
-- table family, while removing offensive-only constraints that block IDP/K.

alter table public.player_projection_inputs
  add column if not exists position_group text;

alter table public.player_projection_outputs
  add column if not exists semantic_input_hash text;

alter table public.player_projection_inputs
  drop constraint if exists ppi_position_check;

alter table public.player_projection_inputs
  add constraint ppi_position_check
    check (position in ('QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'K'));

alter table public.player_projection_inputs
  drop constraint if exists ppi_role_sample_class_check;

alter table public.player_projection_inputs
  add constraint ppi_role_sample_class_check
    check (role_sample_class in (
      'ESTABLISHED_FULL_SEASON', 'ESTABLISHED_PARTIAL_SEASON',
      'PART_TIME_CONTRIBUTOR', 'BACKUP_OR_SPOT_STARTER',
      'MINIMAL_SAMPLE', 'ROLE_UNKNOWN',
      'IDP_ESTABLISHED_FULL_SEASON', 'IDP_ESTABLISHED_PARTIAL_SEASON',
      'IDP_ROTATIONAL', 'IDP_BIG_PLAY_ONLY', 'IDP_MINIMAL_SAMPLE',
      'IDP_ROLE_UNKNOWN',
      'K_ESTABLISHED_FULL_SEASON', 'K_ESTABLISHED_PARTIAL_SEASON',
      'K_LOW_SAMPLE', 'K_ROLE_UNKNOWN'
    ));

alter table public.player_projection_outputs
  drop constraint if exists ppo_position_check;

alter table public.player_projection_outputs
  add constraint ppo_position_check
    check (position in ('QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'K'));

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppi_run_position_group') then
    create index idx_ppi_run_position_group
      on public.player_projection_inputs (projection_run_id, position_group);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_ppo_semantic_input_hash') then
    create index idx_ppo_semantic_input_hash
      on public.player_projection_outputs (semantic_input_hash)
      where semantic_input_hash is not null;
  end if;
end $$;
