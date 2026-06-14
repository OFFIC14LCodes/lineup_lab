import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCHEDULES_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";

export type SchedulesDownloadResult = {
  filePath: string;
  sha256: string;
  sourceUrl: string;
  byteLength: number;
  alreadyArchived: boolean;
};

export function buildSchedulesArchivePath(projectRoot: string): string {
  return path.join(projectRoot, "data", "raw", "nflverse", "schedules");
}

export function buildSchedulesFilePath(projectRoot: string): string {
  const dir = buildSchedulesArchivePath(projectRoot);
  return path.join(dir, "games.csv");
}

export async function downloadAndArchiveSchedules(
  projectRoot: string
): Promise<SchedulesDownloadResult> {
  const filePath = buildSchedulesFilePath(projectRoot);
  const dir = buildSchedulesArchivePath(projectRoot);

  // Always re-download schedules — the file is updated throughout the season.
  // If offline / CI needs stable data, pass forceCache=true via env convention.
  const forceCache = process.env["NFLVERSE_SCHEDULES_CACHE"] === "1";

  if (forceCache && existsSync(filePath)) {
    const existing = readFileSync(filePath);
    const sha256 = createHash("sha256").update(existing).digest("hex");
    return {
      filePath,
      sha256,
      sourceUrl: SCHEDULES_URL,
      byteLength: existing.byteLength,
      alreadyArchived: true,
    };
  }

  const response = await fetch(SCHEDULES_URL, {
    headers: { Accept: "text/csv,*/*" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download nflverse schedules: HTTP ${response.status} ${response.statusText} — ${SCHEDULES_URL}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, buffer);

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return {
    filePath,
    sha256,
    sourceUrl: SCHEDULES_URL,
    byteLength: buffer.byteLength,
    alreadyArchived: false,
  };
}

// Read an already-archived schedules CSV as a UTF-8 string.
export function readSchedulesFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}
