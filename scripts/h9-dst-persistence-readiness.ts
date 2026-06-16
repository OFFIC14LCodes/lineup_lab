import { existsSync } from "node:fs";
import path from "node:path";

import { readHardeningArtifacts, writeDiagnostic } from "./h9-projection-hardening-utils";

const artifacts = readHardeningArtifacts();
const defProjectionRows = (artifacts.projections?.projections ?? []).filter((row) => row.position === "DEF");
const defScoredRows = (artifacts.scoring?.scored ?? []).filter((row) => row.projection.position === "DEF");
const persistedPositionDistribution = artifacts.projections?.persistenceInspection?.positionDistribution as Record<string, number> | undefined;
const persistedDefCount = persistedPositionDistribution?.DEF ?? 0;
const migrationPath = "supabase/migrations/017_def_projection_compat.sql";
const migrationCreated = existsSync(path.join(process.cwd(), migrationPath));
const needsMigration = defProjectionRows.length > 0 && persistedDefCount === 0;
const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: needsMigration ? (migrationCreated ? "migration_created_not_applied" : "needs_migration") : "passed",
  defDstProjectionRowsGenerated: defProjectionRows.length,
  defDstScoredOutputsGenerated: defScoredRows.length,
  defDstPersistedRows: persistedDefCount,
  whyDefDstCannotPersist: needsMigration
    ? "Generated DEF rows are absent from persisted outputs. A targeted migration and writer update are required before the next persisted comprehensive run can include DEF."
    : "DEF/DST persistence is either already allowed or no DEF/DST rows were generated.",
  affectedConstraintsOrChecks: [
    "projection input/output position checks in migration 014/016 omitted DEF",
    "application persistence filter must include DEF before insert",
  ],
  safeMigrationNeeded: needsMigration,
  migrationCreated,
  migrationPath: migrationCreated ? migrationPath : null,
  suggestedMigration: needsMigration ? "Apply 017_def_projection_compat.sql, then rerun comprehensive projection persistence with --persist --inspect-persistence." : null,
  existingRowsAffected: false,
  warRoomReadBeforePersistence: "War Room can read persisted player_projection_outputs; DEF/DST may remain degraded unless artifact/read-model fallback is explicitly wired.",
  dstEnabledLeaguesDegraded: needsMigration,
  checks: [
    { name: "def_rows_generated", passed: defProjectionRows.length > 0, detail: String(defProjectionRows.length) },
    { name: "def_migration_created", passed: !needsMigration || migrationCreated, detail: migrationCreated ? migrationPath : "not created" },
    { name: "def_persistence_explained", passed: true, detail: needsMigration ? "migration/update needed before next persist" : "no migration needed" },
  ],
};

writeDiagnostic("h9-dst-persistence-readiness", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-dst-persistence-readiness.json" }, null, 2));
