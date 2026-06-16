# h9-dst-persistence-readiness

```json
{
  "generatedAt": "2026-06-16T14:32:28.953Z",
  "verdict": "passed",
  "defDstProjectionRowsGenerated": 32,
  "defDstScoredOutputsGenerated": 416,
  "defDstPersistedRows": 32,
  "whyDefDstCannotPersist": "DEF/DST persistence is either already allowed or no DEF/DST rows were generated.",
  "affectedConstraintsOrChecks": [
    "projection input/output position checks in migration 014/016 omitted DEF",
    "application persistence filter must include DEF before insert"
  ],
  "safeMigrationNeeded": false,
  "migrationCreated": true,
  "migrationPath": "supabase/migrations/017_def_projection_compat.sql",
  "suggestedMigration": null,
  "existingRowsAffected": false,
  "warRoomReadBeforePersistence": "War Room can read persisted player_projection_outputs; DEF/DST may remain degraded unless artifact/read-model fallback is explicitly wired.",
  "dstEnabledLeaguesDegraded": false,
  "checks": [
    {
      "name": "def_rows_generated",
      "passed": true,
      "detail": "32"
    },
    {
      "name": "def_migration_created",
      "passed": true,
      "detail": "supabase/migrations/017_def_projection_compat.sql"
    },
    {
      "name": "def_persistence_explained",
      "passed": true,
      "detail": "no migration needed"
    }
  ]
}
```
