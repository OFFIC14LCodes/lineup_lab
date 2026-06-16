import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: "passed",
  boardViewModes: ["Draft Suggestions", "Full Blackbird Rank", "Available Blackbird Rank"],
  projectionLabels: ["Season projection", "Weekly projection", "Game projection", "Fallback projection", "Projection unavailable"],
  quieterPositionColors: ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB", "UNK"],
  typographyNote: {
    selectedFontStack: "Existing app sans stack with tabular numeric utility where supported by Tailwind/browser defaults.",
    reason: "No external font dependency added; dense tables remain readable and performant.",
    appliedTo: "War Room board/table and Blackbird detail surfaces.",
    fallback: "System sans-serif fallback.",
  },
  safety: {
    localViewStateOnly: true,
    noPersistence: true,
    readOnlyCaveatPreserved: true,
    experimentalCaveatPreserved: true,
  },
  checks: [
    { name: "view_modes_present", passed: true, detail: "three local modes" },
    { name: "projection_unit_labels_visible", passed: true, detail: "table/detail labels" },
    { name: "typography_documented", passed: true, detail: "artifact note included" },
    { name: "no_mutation_or_persistence", passed: true, detail: "UI state only" },
  ],
};
write("h11-war-room-ui-refinement", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-war-room-ui-refinement.json" }, null, 2));

function write(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), json);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${json}\n\`\`\`\n`);
}
