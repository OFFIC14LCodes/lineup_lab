import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const NFLVERSE_BASE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/stats_player";

export type DownloadResult = {
  filePath: string;
  sha256: string;
  sourceUrl: string;
  byteLength: number;
  alreadyArchived: boolean;
};

export function buildNflverseSourceUrl(season: number): string {
  return `${NFLVERSE_BASE_URL}/stats_player_week_${season}.csv`;
}

export function buildArchivePath(season: number, projectRoot: string): string {
  return path.join(projectRoot, "data", "raw", "nflverse", "player_stats", String(season));
}

export async function downloadAndArchive(
  season: number,
  projectRoot: string
): Promise<DownloadResult> {
  const sourceUrl = buildNflverseSourceUrl(season);
  const dir = buildArchivePath(season, projectRoot);
  const filename = `stats_player_week_${season}.csv`;
  const filePath = path.join(dir, filename);

  // If already downloaded, return existing fingerprint without re-downloading.
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath);
    const sha256 = createHash("sha256").update(existing).digest("hex");
    return {
      filePath,
      sha256,
      sourceUrl,
      byteLength: existing.byteLength,
      alreadyArchived: true
    };
  }

  const response = await fetch(sourceUrl, {
    headers: { Accept: "text/csv,application/octet-stream,*/*" }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download nflverse player_stats for season ${season}: HTTP ${response.status} ${response.statusText} — ${sourceUrl}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, buffer);

  return {
    filePath,
    sha256,
    sourceUrl,
    byteLength: buffer.byteLength,
    alreadyArchived: false
  };
}
