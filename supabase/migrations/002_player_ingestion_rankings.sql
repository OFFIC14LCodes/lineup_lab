alter table public.players
  add column if not exists search_name text,
  add column if not exists normalized_name text,
  add column if not exists fantasy_positions_json jsonb default '[]'::jsonb,
  add column if not exists active boolean default true;

alter table public.draft_rankings
  add column if not exists normalized_player_name text,
  add column if not exists match_status text default 'unmatched',
  add column if not exists match_confidence numeric,
  add column if not exists matched_player_id uuid references public.players(id),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_draft_rankings_updated_at'
      and tgrelid = 'public.draft_rankings'::regclass
  ) then
    create trigger set_draft_rankings_updated_at
      before update on public.draft_rankings
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists idx_players_sleeper_player_id on public.players(sleeper_player_id);
create index if not exists idx_players_full_name on public.players(full_name);
create index if not exists idx_players_position on public.players(position);
create index if not exists idx_players_team on public.players(team);
create index if not exists idx_players_normalized_name on public.players(normalized_name);
create index if not exists idx_players_active_position on public.players(active, position);
create index if not exists idx_draft_rankings_context on public.draft_rankings(user_id, league_id, source, season, format);
create index if not exists idx_draft_rankings_player on public.draft_rankings(user_id, league_id, sleeper_player_id);
create index if not exists idx_draft_rankings_match_status on public.draft_rankings(user_id, match_status);
create index if not exists idx_draft_room_picks_player on public.draft_room_picks(draft_room_id, sleeper_player_id);

create unique index if not exists uniq_rankings_matched_player
  on public.draft_rankings(
    user_id,
    coalesce(league_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source,
    coalesce(season, ''),
    coalesce(format, ''),
    sleeper_player_id
  )
  where sleeper_player_id is not null;

create unique index if not exists uniq_rankings_unmatched_player
  on public.draft_rankings(
    user_id,
    coalesce(league_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source,
    coalesce(season, ''),
    coalesce(format, ''),
    normalized_player_name,
    coalesce(position, ''),
    coalesce(team, '')
  )
  where sleeper_player_id is null and normalized_player_name is not null;
