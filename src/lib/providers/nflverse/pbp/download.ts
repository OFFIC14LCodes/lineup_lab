import "server-only";

import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import zlib from "node:zlib";

// nflverse PBP data is released as a gzipped CSV under the "pbp" release tag.
const PBP_BASE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/pbp";

export type PbpDownloadResult = {
  filePath: string;
  sha256: string;
  sourceUrl: string;
  byteLength: number;
  alreadyArchived: boolean;
};

export function buildPbpSourceUrl(season: number): string {
  return `${PBP_BASE_URL}/play_by_play_${season}.csv.gz`;
}

export function buildPbpArchivePath(season: number, projectRoot: string): string {
  return path.join(projectRoot, "data", "raw", "nflverse", "pbp", String(season));
}

export function buildPbpFilePath(season: number, projectRoot: string): string {
  const dir = buildPbpArchivePath(season, projectRoot);
  return path.join(dir, `play_by_play_${season}.csv.gz`);
}

export async function downloadAndArchivePbp(
  season: number,
  projectRoot: string
): Promise<PbpDownloadResult> {
  const sourceUrl = buildPbpSourceUrl(season);
  const filePath = buildPbpFilePath(season, projectRoot);
  const dir = buildPbpArchivePath(season, projectRoot);

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
    headers: { Accept: "application/octet-stream,*/*" }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download nflverse PBP for season ${season}: HTTP ${response.status} ${response.statusText} — ${sourceUrl}`
    );
  }

  mkdirSync(dir, { recursive: true });

  // Stream the response body directly to disk (avoids loading into memory).
  // The file is kept as .csv.gz on disk — decompression is done at read time.
  if (!response.body) {
    throw new Error("Response body was null; cannot stream PBP file to disk.");
  }

  const { Readable } = await import("node:stream");
  const nodeStream = Readable.fromWeb(response.body as import("stream/web").ReadableStream);
  const fileStream = createWriteStream(filePath);
  await pipeline(nodeStream, fileStream);

  const diskContent = readFileSync(filePath);
  const sha256 = createHash("sha256").update(diskContent).digest("hex");

  return {
    filePath,
    sha256,
    sourceUrl,
    byteLength: diskContent.byteLength,
    alreadyArchived: false
  };
}

// Read and decompress the archived .csv.gz to a UTF-8 string.
// The decompressed file is NOT written to disk — used only for in-memory parsing.
export function decompressPbpFile(filePath: string): string {
  const compressed = readFileSync(filePath);
  const decompressed = zlib.gunzipSync(compressed);
  return decompressed.toString("utf8");
}
