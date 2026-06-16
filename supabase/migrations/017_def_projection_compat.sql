-- H9.15.1: Allow generated DEF/DST projection rows to use the shared
-- projection persistence tables.
--
-- DST is normalized to DEF in player and draft models. This migration only
-- expands existing check constraints; it does not create fake team-defense
-- players or mutate existing projection rows.

alter table public.player_projection_inputs
  drop constraint if exists ppi_position_check;

alter table public.player_projection_inputs
  add constraint ppi_position_check
    check (position in ('QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'K', 'DEF'));

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
      'K_LOW_SAMPLE', 'K_ROLE_UNKNOWN',
      'DST_ESTABLISHED_FULL_SEASON', 'DST_ESTABLISHED_PARTIAL_SEASON',
      'DST_LOW_SAMPLE', 'DST_ROLE_UNKNOWN'
    ));

alter table public.player_projection_outputs
  drop constraint if exists ppo_position_check;

alter table public.player_projection_outputs
  add constraint ppo_position_check
    check (position in ('QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'K', 'DEF'));
