-- H8: Add missing unique constraint to player_context_snapshots.
--
-- Without this constraint, upsert with
--   ON CONFLICT (canonical_player_id, season, context_version)
-- fails with PG error 42P10 ("no unique or exclusion constraint matching the
-- ON CONFLICT specification").
--
-- Safety: apply only after verifying no duplicate (player, season, version)
-- rows exist:
--
--   SELECT canonical_player_id, season, context_version, count(*)
--   FROM player_context_snapshots
--   GROUP BY 1, 2, 3
--   HAVING count(*) > 1;
--
-- Expected: 0 rows. If duplicates exist, deduplicate before applying.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_context_snapshots_player_season_version_key'
      AND conrelid = 'public.player_context_snapshots'::regclass
  ) THEN
    ALTER TABLE public.player_context_snapshots
      ADD CONSTRAINT player_context_snapshots_player_season_version_key
      UNIQUE (canonical_player_id, season, context_version);
  END IF;
END $$;
