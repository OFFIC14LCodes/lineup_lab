alter table public.players
  add column if not exists raw_position text,
  add column if not exists primary_position text,
  add column if not exists position_group text,
  add column if not exists eligible_positions_json jsonb default '[]'::jsonb,
  add column if not exists side_of_ball text;

update public.players
set
  raw_position = coalesce(raw_position, upper(nullif(trim(position), ''))),
  primary_position = coalesce(
    primary_position,
    case upper(coalesce(raw_position, position, ''))
      when 'QB' then 'QB'
      when 'RB' then 'RB'
      when 'FB' then 'RB'
      when 'WR' then 'WR'
      when 'TE' then 'TE'
      when 'K' then 'K'
      when 'PK' then 'K'
      when 'DEF' then 'DEF'
      when 'DST' then 'DEF'
      when 'D/ST' then 'DEF'
      when 'DL' then 'DL'
      when 'DE' then 'DL'
      when 'DT' then 'DL'
      when 'EDGE' then 'DL'
      when 'NT' then 'DL'
      when 'LB' then 'LB'
      when 'ILB' then 'LB'
      when 'OLB' then 'LB'
      when 'MLB' then 'LB'
      when 'DB' then 'DB'
      when 'CB' then 'DB'
      when 'S' then 'DB'
      when 'FS' then 'DB'
      when 'SS' then 'DB'
      else null
    end
  ),
  position_group = coalesce(
    position_group,
    case upper(coalesce(raw_position, position, ''))
      when 'QB' then 'QB'
      when 'RB' then 'RB'
      when 'FB' then 'RB'
      when 'WR' then 'WR'
      when 'TE' then 'TE'
      when 'K' then 'K'
      when 'PK' then 'K'
      when 'DEF' then 'DEF'
      when 'DST' then 'DEF'
      when 'D/ST' then 'DEF'
      when 'DL' then 'DL'
      when 'DE' then 'DL'
      when 'DT' then 'DL'
      when 'EDGE' then 'DL'
      when 'NT' then 'DL'
      when 'LB' then 'LB'
      when 'ILB' then 'LB'
      when 'OLB' then 'LB'
      when 'MLB' then 'LB'
      when 'DB' then 'DB'
      when 'CB' then 'DB'
      when 'S' then 'DB'
      when 'FS' then 'DB'
      when 'SS' then 'DB'
      else null
    end
  ),
  side_of_ball = coalesce(
    side_of_ball,
    case
      when upper(coalesce(raw_position, position, '')) in ('QB', 'RB', 'FB', 'WR', 'TE') then 'offense'
      when upper(coalesce(raw_position, position, '')) in ('K', 'PK') then 'special_teams'
      when upper(coalesce(raw_position, position, '')) in ('DEF', 'DST', 'D/ST') then 'team_defense'
      when upper(coalesce(raw_position, position, '')) in ('DL', 'DE', 'DT', 'EDGE', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'DB', 'CB', 'S', 'FS', 'SS') then 'defense'
      else null
    end
  ),
  eligible_positions_json = case
    when coalesce(jsonb_array_length(eligible_positions_json), 0) > 0 then eligible_positions_json
    when primary_position is not null then jsonb_build_array(primary_position)
    else coalesce(eligible_positions_json, '[]'::jsonb)
  end,
  active = case
    when coalesce(lower(status), '') = 'inactive' then false
    when coalesce(
      position_group,
      case upper(coalesce(raw_position, position, ''))
        when 'QB' then 'QB'
        when 'RB' then 'RB'
        when 'FB' then 'RB'
        when 'WR' then 'WR'
        when 'TE' then 'TE'
        when 'K' then 'K'
        when 'PK' then 'K'
        when 'DEF' then 'DEF'
        when 'DST' then 'DEF'
        when 'D/ST' then 'DEF'
        when 'DL' then 'DL'
        when 'DE' then 'DL'
        when 'DT' then 'DL'
        when 'EDGE' then 'DL'
        when 'NT' then 'DL'
        when 'LB' then 'LB'
        when 'ILB' then 'LB'
        when 'OLB' then 'LB'
        when 'MLB' then 'LB'
        when 'DB' then 'DB'
        when 'CB' then 'DB'
        when 'S' then 'DB'
        when 'FS' then 'DB'
        when 'SS' then 'DB'
        else null
      end
    ) in ('QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB') then true
    else active
  end;

create index if not exists idx_players_primary_position on public.players(primary_position);
create index if not exists idx_players_position_group on public.players(position_group);
create index if not exists idx_players_side_of_ball on public.players(side_of_ball);
create index if not exists idx_players_active_position_group on public.players(active, position_group);
