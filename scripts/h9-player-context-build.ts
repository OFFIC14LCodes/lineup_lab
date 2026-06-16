import { buildPlayerContext } from "@/lib/player-context/player-context-builder";
import { arg, loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const draftRoomId = arg("--draft-room-id");
const { report } = buildPlayerContext({ draftRoomId, writeOutput: true });
writeDiagnostic("h9-player-context-build", report);
console.log(JSON.stringify({
  verdict: report.verdict,
  profiles: report.profiles,
  sourceRows: report.sourceRows,
  coverage: report.coverage,
  outputPath: report.outputPath,
  artifact: "artifacts/projections/h9-player-context-build.json",
}, null, 2));
if (report.verdict === "failed") process.exitCode = 1;
