do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_weekly_derived_stats_fum_ret_td_non_negative_integer'
      and conrelid = 'public.player_weekly_derived_stats'::regclass
  ) then
    alter table public.player_weekly_derived_stats
      add constraint player_weekly_derived_stats_fum_ret_td_non_negative_integer
      check (
        not (stats_json ? 'fum_ret_td')
        or (
          jsonb_typeof(stats_json->'fum_ret_td') = 'number'
          and (stats_json->>'fum_ret_td')::numeric >= 0
          and mod((stats_json->>'fum_ret_td')::numeric, 1) = 0
        )
      );
  end if;
end $$;
