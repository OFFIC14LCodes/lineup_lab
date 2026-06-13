export const DEFAULT_SEASON = 2025;

const MIN_SEASON = 2000;
const MAX_SEASON = 2100;

function parseSeasonInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < MIN_SEASON || n > MAX_SEASON) return null;
  return n;
}

export function parseSeason(argv: string[], env: Record<string, string | undefined>): number {
  const arg = argv.find((a) => a.startsWith("--season="));
  if (arg) {
    const fromArg = parseSeasonInt(arg.split("=")[1]);
    if (fromArg !== null) return fromArg;
  }
  const fromEnv = parseSeasonInt(env["NFLVERSE_PBP_SEASON"]);
  if (fromEnv !== null) return fromEnv;
  return DEFAULT_SEASON;
}

export function parseMode(argv: string[], env: Record<string, string | undefined>): "dry_run" | "execute" {
  if (argv.includes("--execute")) return "execute";
  if (env["NFLVERSE_PBP_EXECUTE"] === "true") return "execute";
  return "dry_run";
}
