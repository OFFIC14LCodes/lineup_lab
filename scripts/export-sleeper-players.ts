import { exportSleeperPlayers } from "@/lib/data-acquisition/sleeper";

import { loadLocalEnv } from "./h9-projection-hardening-utils";

loadLocalEnv();

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const result = await exportSleeperPlayers();

  console.log("Sleeper NFL Players Export");
  console.log(`  players: ${result.playerCount}`);
  console.log(`  path: ${result.filePath}`);
  console.log(`  exportedAt: ${result.exportedAt}`);
}
