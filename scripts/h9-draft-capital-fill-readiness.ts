import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { generatePriorityFillFiles } from "@/lib/data-acquisition/source-fill-workflow";
import { priorityFillPath, validateSourceFile } from "@/lib/data-acquisition/source-file-validation";
import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const fillFiles = generatePriorityFillFiles(100);
const fillPath = priorityFillPath("draft-capital");
const validation = validateSourceFile("draft-capital", fillPath);
const rows = readCsv(fillPath).slice(0, 100);
const missing = rows.filter((row) => !hasDraftCapital(row));
const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: validation.invalidRows === 0 ? (missing.length ? "needs_source_data" : "passed") : "failed",
  sourceFilePathToEdit: fillPath,
  generatedPriorityFillFiles: fillFiles,
  top100PriorityRookiesMissingDraftCapital: missing.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    priorityTier: row.priorityTier,
    priorityScore: row.priorityScore,
    requiredFields: ["nflDraftRound", "nflDraftPick", "nflDraftOverall", "nflDraftTeam"],
  })),
  counts: {
    priorityRows: rows.length,
    rowsMissingDraftCapital: missing.length,
    rowsNeedNflDraftRound: rows.filter((row) => !String(row.nflDraftRound ?? "").trim()).length,
    rowsNeedNflDraftPick: rows.filter((row) => !String(row.nflDraftPick ?? "").trim()).length,
    rowsNeedNflDraftOverall: rows.filter((row) => !String(row.nflDraftOverall ?? "").trim()).length,
    rowsNeedNflDraftTeam: rows.filter((row) => !String(row.nflDraftTeam ?? "").trim()).length,
    matchedPlayerIds: rows.filter((row) => String(row.playerId ?? "").trim()).length,
    invalidRows: validation.invalidRows,
  },
  nextAction: `Fill nflDraftRound, nflDraftPick, nflDraftOverall, and nflDraftTeam for ${missing.length} rows in ${path.relative(process.cwd(), fillPath)}, then rerun npm run diagnose:h9-rookie-source-population.`,
  safety: {
    noScraping: true,
    noPaidApi: true,
    noFabricatedDraftCapital: true,
    blankFieldsRemainDataGaps: true,
  },
};
writeDiagnostic("h9-draft-capital-fill-readiness", artifact);
console.log(JSON.stringify({
  verdict: artifact.verdict,
  sourceFilePathToEdit: artifact.sourceFilePathToEdit,
  counts: artifact.counts,
  nextAction: artifact.nextAction,
  artifact: "artifacts/projections/h9-draft-capital-fill-readiness.json",
}, null, 2));
if (artifact.verdict === "failed") process.exitCode = 1;

function hasDraftCapital(row: Record<string, unknown>) {
  return Boolean(String(row.nflDraftRound ?? "").trim() || String(row.nflDraftOverall ?? "").trim());
}

function readCsv(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) return [];
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`CSV parse failed for ${filePath}: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}
