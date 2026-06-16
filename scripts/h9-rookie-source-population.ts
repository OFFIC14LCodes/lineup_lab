import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import { coverageSummary } from "@/lib/projections/rookie-enrichment-workflow";
import { generatePriorityFillFiles } from "@/lib/data-acquisition/source-fill-workflow";
import { defaultSourcePath, priorityFillPath, validateSourceFile, type RookieSourceKind } from "@/lib/data-acquisition/source-file-validation";
import { loadLocalEnv, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const kinds: RookieSourceKind[] = ["draft-capital", "college-production", "role-notes"];
const generatedPriorityFillFiles = generatePriorityFillFiles(100);
const sourceValidations = kinds.map((kind) => validateSourceFile(kind, defaultSourcePath(kind)));
const fillValidations = kinds.map((kind) => validateSourceFile(kind, priorityFillPath(kind)));
const loadResult = loadRookieData({ dryRun: true, useExampleWhenMissing: false });
const coverage = coverageSummary(loadResult);
const sourceFiles = sourceValidations.map((validation) => ({
  kind: validation.kind,
  filePath: validation.filePath,
  present: validation.exists,
  headerOnly: validation.headerOnly,
  rowCount: validation.rowCount,
  validRows: validation.validRows,
  invalidRows: validation.invalidRows,
  duplicateRows: validation.duplicateRows,
  conflicts: validation.conflicts,
  rowsWithData: validation.rowsWithData,
}));
const fillFiles = fillValidations.map((validation) => ({
  kind: validation.kind,
  filePath: validation.filePath,
  present: validation.exists,
  rowCount: validation.rowCount,
  rowsWithData: validation.rowsWithData,
  invalidRows: validation.invalidRows,
  duplicateRows: validation.duplicateRows,
  conflicts: validation.conflicts,
}));
const invalidRows = [...sourceValidations, ...fillValidations].reduce((sum, row) => sum + row.invalidRows, 0);
const conflicts = [...sourceValidations, ...fillValidations].reduce((sum, row) => sum + row.conflicts, 0);
const rowsWithData = [...sourceValidations, ...fillValidations].reduce((sum, row) => sum + row.rowsWithData, 0);
const priorityDraft = fillValidations.find((row) => row.kind === "draft-capital");
const priorityCollege = fillValidations.find((row) => row.kind === "college-production");
const priorityRole = fillValidations.find((row) => row.kind === "role-notes");
const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: invalidRows || conflicts ? "failed" : rowsWithData ? "passed" : "needs_source_data",
  sourceFiles,
  priorityFillFiles: fillFiles,
  generatedPriorityFillFiles,
  totals: {
    sourceFilesPresent: sourceFiles.filter((row) => row.present).length,
    sourceFilesHeaderOnly: sourceFiles.filter((row) => row.headerOnly).length,
    sourceRows: sourceFiles.reduce((sum, row) => sum + row.rowCount, 0),
    validRows: sourceFiles.reduce((sum, row) => sum + row.validRows, 0),
    invalidRows,
    duplicateRows: [...sourceValidations, ...fillValidations].reduce((sum, row) => sum + row.duplicateRows, 0),
    conflicts,
    matchedRows: loadResult.matchedRows,
    unmatchedRows: loadResult.unmatchedRows,
    ambiguousRows: loadResult.ambiguousMatches,
    draftCapitalRowsPopulated: sourceValidations.find((row) => row.kind === "draft-capital")?.rowsWithData ?? 0,
    collegeProductionRowsPopulated: sourceValidations.find((row) => row.kind === "college-production")?.rowsWithData ?? 0,
    roleNotesRowsPopulated: sourceValidations.find((row) => row.kind === "role-notes")?.rowsWithData ?? 0,
    priorityRookiesWithDraftCapital: priorityDraft?.rowsWithData ?? 0,
    priorityRookiesWithCollegeProduction: priorityCollege?.rowsWithData ?? 0,
    priorityRookiesWithRoleNotes: priorityRole?.rowsWithData ?? 0,
  },
  enrichmentCoverage: {
    totalRookies: coverage.totalRookies,
    rowsWithDraftCapital: coverage.rowsWithDraftCapital,
    rowsWithCollegeProduction: coverage.rowsWithCollegeProduction,
    rowsWithLandingSpotRole: coverage.rowsWithLandingSpotRole,
  },
  topRemainingMissingFields: topEntries(loadResult.rows.flatMap((row) => row.profile.dataGaps).reduce((acc, gap) => {
    acc[gap] = (acc[gap] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>)),
  issues: [...sourceValidations, ...fillValidations].flatMap((row) => row.issues).slice(0, 100),
  nextAction: nextAction(rowsWithData, priorityFillPath("draft-capital")),
  safety: {
    noAi: true,
    noScraping: true,
    noPaidApi: true,
    noAdpFallback: true,
    noFabricatedValues: true,
    blankFieldsRemainDataGaps: true,
    noDraftStateMutation: true,
  },
};

writeDiagnostic("h9-rookie-source-population", artifact);
console.log(JSON.stringify({
  verdict: artifact.verdict,
  totals: artifact.totals,
  nextAction: artifact.nextAction,
  artifact: "artifacts/projections/h9-rookie-source-population.json",
}, null, 2));
if (artifact.verdict === "failed") process.exitCode = 1;

function nextAction(rowsWithData: number, draftCapitalFillPath: string) {
  if (!rowsWithData) return `Fill nflDraftRound, nflDraftPick, nflDraftOverall, and nflDraftTeam for 100 rows in ${draftCapitalFillPath}, then rerun npm run diagnose:h9-rookie-source-population.`;
  return "Run npm run build:h9-rookie-source-files -- --dry-run, resolve any conflicts, then rerun with -- --apply.";
}
