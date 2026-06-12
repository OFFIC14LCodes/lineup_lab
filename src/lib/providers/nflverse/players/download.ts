import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const NFLVERSE_PLAYERS_SOURCE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";

export type PlayersDownloadResult = {
  sourceUrl: string;
  filePath: string;
  sha256: string;
  alreadyArchived: boolean;
};

export async function downloadNflversePlayers(projectRoot: string): Promise<PlayersDownloadResult> {
  const archiveDir = path.join(projectRoot, "data", "raw", "nflverse", "players");
  const filePath = path.join(archiveDir, "players.csv");

  if (existsSync(filePath)) {
    const content = readFileSync(filePath);
    const sha256 = createHash("sha256").update(content).digest("hex");
    return { sourceUrl: NFLVERSE_PLAYERS_SOURCE_URL, filePath, sha256, alreadyArchived: true };
  }

  const response = await fetch(NFLVERSE_PLAYERS_SOURCE_URL, {
    headers: { "User-Agent": "blackbird-gm/1.0" },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download nflverse players: HTTP ${response.status} from ${NFLVERSE_PLAYERS_SOURCE_URL}`
    );
  }

  const content = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(content).digest("hex");

  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(filePath, content);

  return { sourceUrl: NFLVERSE_PLAYERS_SOURCE_URL, filePath, sha256, alreadyArchived: false };
}
