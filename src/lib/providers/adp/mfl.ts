// MFL (MyFantasyLeague) public ADP provider.
//
// Two-step fetch:
//   1. ADP endpoint  → player IDs + rankings only (no name/position/team)
//   2. Players endpoint → name/position/team keyed by MFL ID
// Merge by MFL ID to build complete RawAdpRecord[].
//
// URL parameter: JSON=1 (not FORMAT=json — MFL ignores FORMAT=json and returns XML)

import { createHash } from "node:crypto";

import { XMLParser } from "fast-xml-parser";

import { normalizeMflName } from "@/lib/adp/identity";
import { normalizeTeam } from "@/lib/players/normalize";
import type { AdpFormatProfile, AdpSourceMeta, RawAdpRecord } from "@/lib/adp/types";

const PARSER_VERSION = "h7-mfl-parser-v1";

const MFL_TEAM_MAP: Record<string, string> = {
  KCC: "KC",
  GBP: "GB",
  NEP: "NE",
  NOS: "NO",
  SFO: "SF",
  TBB: "TB",
  LVR: "LVR",
  LAR: "LAR",
  LAC: "LAC",
  JAC: "JAX",
};

function normalizeMflTeam(team: string | null | undefined): string | null {
  if (!team) return null;
  const upper = team.trim().toUpperCase();
  if (upper === "FA" || upper === "UNK") return null;
  return normalizeTeam(MFL_TEAM_MAP[upper] ?? upper);
}

// ADP endpoint fields — only IDs and pick statistics; no name/position/team
type MflAdpEntry = {
  id: string;
  rank?: string;
  averagePick?: string;
  minPick?: string;
  maxPick?: string;
  draftsSelectedIn?: string;
  draftSelPct?: string;
};

// Players endpoint fields — name/position/team keyed by MFL ID
type MflPlayerEntry = {
  id: string;
  name?: string;
  position?: string;
  team?: string;
  status?: string;
};

type MflAdpRoot = {
  totalDrafts?: string | number;
  totalPicks?: string | number;
  timestamp?: string | number;
  player?: MflAdpEntry | MflAdpEntry[];
  message?: string;
};

type MflJsonAdpResponse = {
  version?: string;
  encoding?: string;
  adp?: MflAdpRoot;
};

type MflJsonPlayersResponse = {
  players?: {
    timestamp?: string;
    player?: MflPlayerEntry | MflPlayerEntry[];
  };
};

export type MflFetchOptions = {
  season: number;
  teamCount?: number;
  period?: string;
  baseUrl?: string;
};

export type MflFetchResult = {
  raw: RawAdpRecord[];
  fileHash: string;
  sourceUrl: string;
  sampleSize: number | null;
  sourceVersion: string | null;
  rejectedCount: number;
  rejectedReasons: Record<string, number>;
};

// Positions to skip: team defenses, kickers, and MFL team-aggregated slots
const SKIP_POSITIONS = new Set(["DEF", "K", "PK", "Def"]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (tagName: string) => tagName === "player",
});

function detectResponseFormat(contentType: string, body: string): "json" | "xml" | "html" {
  const ct = contentType.toLowerCase();
  if (ct.includes("application/json")) return "json";
  if (ct.includes("text/xml") || ct.includes("application/xml")) return "xml";
  // Fall back to body inspection
  const trimmed = body.trimStart();
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<adp") || trimmed.startsWith("<status") || trimmed.startsWith("<error")) return "xml";
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("<!doctype html") || lower.startsWith("<html") || lower.startsWith("<h1>") || lower.startsWith("<p>")) return "html";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  return "json";
}

function parseXmlAdp(body: string): MflJsonAdpResponse {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(body) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`MFL ADP XML parse failed: ${(err as Error).message}`);
  }

  // Detect XML error envelope: <status is="..."/> or <error>...</error>
  if ("status" in parsed) {
    const status = parsed.status as Record<string, string> | string;
    const msg = typeof status === "object" ? (status?.is ?? JSON.stringify(status)) : String(status);
    throw new Error(`MFL API returned error status: ${msg}`);
  }
  if ("error" in parsed) {
    throw new Error(`MFL API returned error: ${JSON.stringify(parsed.error)}`);
  }

  const adpNode = parsed.adp as Record<string, unknown> | undefined;
  if (!adpNode) {
    throw new Error("MFL XML response missing <adp> root element");
  }

  // Check for inline <message> error inside <adp>
  if (typeof adpNode.message === "string") {
    throw new Error(`MFL ADP error: ${adpNode.message}`);
  }

  return {
    adp: {
      totalDrafts: adpNode.totalDrafts as string | undefined,
      totalPicks: adpNode.totalPicks as string | undefined,
      timestamp: adpNode.timestamp as string | undefined,
      player: adpNode.player as MflAdpEntry | MflAdpEntry[] | undefined,
    },
  };
}

async function mflGet(url: string): Promise<{ body: string; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/xml",
      "User-Agent": "blackbird-gm/h7-adp-pipeline",
    },
  });
  if (!response.ok) {
    throw new Error(`MFL fetch failed: HTTP ${response.status} ${response.statusText} (${url})`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  return { body, contentType };
}

async function fetchAdpData(url: string): Promise<{
  entries: MflAdpEntry[];
  totalDrafts: number | null;
  timestamp: string | null;
}> {
  const { body, contentType } = await mflGet(url);
  const format = detectResponseFormat(contentType, body);

  if (format === "html") {
    throw new Error(
      `MFL returned an HTML error page — this season may not be available on MFL's API (${url})`
    );
  }

  let data: MflJsonAdpResponse;
  if (format === "xml") {
    data = parseXmlAdp(body);
  } else {
    try {
      data = JSON.parse(body) as MflJsonAdpResponse;
    } catch (err) {
      // Content-Type said JSON but body wasn't — try XML fallback
      try {
        data = parseXmlAdp(body);
      } catch {
        throw new Error(`MFL ADP JSON parse failed: ${(err as Error).message}`);
      }
    }
  }

  const { adp } = data;
  const totalDrafts = adp?.totalDrafts != null ? parseInt(String(adp.totalDrafts), 10) : null;
  const timestamp = adp?.timestamp != null ? String(adp.timestamp) : null;
  const rawPlayer = adp?.player;
  const entries: MflAdpEntry[] = Array.isArray(rawPlayer) ? rawPlayer : rawPlayer ? [rawPlayer] : [];

  return {
    entries,
    totalDrafts: totalDrafts !== null && !isNaN(totalDrafts) ? totalDrafts : null,
    timestamp,
  };
}

async function fetchPlayersMap(
  base: string,
  season: number
): Promise<Map<string, MflPlayerEntry>> {
  const url = `${base}/${season}/export?TYPE=players&JSON=1`;
  const { body, contentType } = await mflGet(url);
  const format = detectResponseFormat(contentType, body);

  if (format === "html") {
    throw new Error(`MFL players endpoint returned HTML — season ${season} may not be available`);
  }

  let data: MflJsonPlayersResponse;
  if (format === "xml") {
    let parsed: Record<string, unknown>;
    try {
      parsed = xmlParser.parse(body) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`MFL players XML parse failed: ${(err as Error).message}`);
    }
    const playersNode = parsed.players as Record<string, unknown> | undefined;
    const rawPlayers = playersNode?.player as MflPlayerEntry | MflPlayerEntry[] | undefined;
    const players = Array.isArray(rawPlayers) ? rawPlayers : rawPlayers ? [rawPlayers] : [];
    data = { players: { player: players } };
  } else {
    try {
      data = JSON.parse(body) as MflJsonPlayersResponse;
    } catch (err) {
      throw new Error(`MFL players JSON parse failed: ${(err as Error).message}`);
    }
  }

  const rawPlayers = data?.players?.player;
  const players: MflPlayerEntry[] = Array.isArray(rawPlayers) ? rawPlayers : rawPlayers ? [rawPlayers] : [];

  const map = new Map<string, MflPlayerEntry>();
  for (const p of players) {
    if (p.id) map.set(p.id, p);
  }
  return map;
}

export async function fetchMflAdp(opts: MflFetchOptions): Promise<MflFetchResult> {
  const base = opts.baseUrl ?? "https://api.myfantasyleague.com";
  const count = opts.teamCount ?? 12;
  const period = opts.period ?? "recent";
  const adpUrl = `${base}/${opts.season}/export?TYPE=adp&PERIOD=${period}&FCOUNT=${count}&JSON=1`;

  // Step 1: ADP entries — IDs + pick statistics only
  const { entries, totalDrafts, timestamp } = await fetchAdpData(adpUrl);

  if (entries.length === 0) {
    throw new Error(
      `MFL ADP for season ${opts.season} returned no player records — ` +
        `the season may have ended or draft activity is below the FCOUNT=${count} threshold`
    );
  }

  // Step 2: Player details — name/position/team by MFL ID
  const playersMap = await fetchPlayersMap(base, opts.season);

  // Semantic hash: sorted player ID+ADP tuples, excluding volatile fields like timestamp.
  // This makes the deduplication key stable across requests that return identical ADP values.
  const normalizedForHash = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => ({ id: e.id, adp: e.averagePick ?? "0", rank: e.rank ?? "" }));
  const fileHash = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "mfl",
        season: opts.season,
        period: opts.period ?? "recent",
        teamCount: opts.teamCount ?? 12,
        players: normalizedForHash,
      })
    )
    .digest("hex");
  const rejectedReasons: Record<string, number> = {};
  const records: RawAdpRecord[] = [];

  for (const entry of entries) {
    const avgPick = parseFloat(entry.averagePick ?? "");
    if (!isFinite(avgPick) || avgPick <= 0) {
      rejectedReasons["invalid_adp"] = (rejectedReasons["invalid_adp"] ?? 0) + 1;
      continue;
    }

    const detail = playersMap.get(entry.id);
    if (!detail) {
      rejectedReasons["player_id_not_found"] = (rejectedReasons["player_id_not_found"] ?? 0) + 1;
      continue;
    }

    const pos = detail.position ?? null;
    // Skip team defenses, kickers, and MFL team-aggregate positions (prefix "TM")
    if (pos && (SKIP_POSITIONS.has(pos) || pos.startsWith("TM"))) {
      rejectedReasons["skip_position"] = (rejectedReasons["skip_position"] ?? 0) + 1;
      continue;
    }

    const rawName = detail.name ? normalizeMflName(detail.name) : "";
    if (!rawName) {
      rejectedReasons["no_name"] = (rejectedReasons["no_name"] ?? 0) + 1;
      continue;
    }

    records.push({
      rawId: entry.id,
      rawName,
      rawPosition: pos,
      rawTeam: normalizeMflTeam(detail.team),
      overallAdp: avgPick,
      overallRank: entry.rank ? parseInt(entry.rank, 10) : null,
      positionalAdp: null,
      positionalRank: null,
      minPick: entry.minPick ? parseInt(entry.minPick, 10) : null,
      maxPick: entry.maxPick ? parseInt(entry.maxPick, 10) : null,
      stddev: null,
      sampleSize: null,
      extraFields: {
        mfl_id: entry.id,
        mfl_drafts_selected_in: entry.draftsSelectedIn ?? null,
        mfl_draft_sel_pct: entry.draftSelPct ?? null,
      },
    });
  }

  records.sort((a, b) => a.overallAdp - b.overallAdp);

  return {
    raw: records,
    fileHash,
    sourceUrl: adpUrl,
    sampleSize: totalDrafts,
    sourceVersion: timestamp,
    rejectedCount: entries.length - records.length,
    rejectedReasons,
  };
}

export function buildMflSourceMeta(opts: {
  season: number;
  teamCount: number;
  capturedAt: string;
  effectiveDate: string;
  fileHash: string;
  sourceUrl: string;
  sampleSize?: number | null;
  sourceVersion?: string | null;
}): AdpSourceMeta {
  const formatProfile: AdpFormatProfile = {
    draftType: "redraft",
    platform: "mfl",
    scoringFormat: "ppr",
    pprValue: 1.0,
    tePremiumValue: 0.0,
    rosterPositions: [],
    teamCount: opts.teamCount,
    isBestBall: false,
    isDynasty: false,
    isStartup: false,
    isSuperflex: false,
    isTePremium: false,
  };

  const identifier = [
    "mfl",
    opts.season,
    "redraft",
    "ppr",
    `${opts.teamCount}team`,
    opts.effectiveDate.slice(0, 10).replace(/-/g, ""),
  ].join("-");

  return {
    provider: "mfl",
    sourceIdentifier: identifier,
    sourceUrl: opts.sourceUrl,
    capturedAt: opts.capturedAt,
    effectiveDate: opts.effectiveDate,
    season: opts.season,
    formatProfile,
    sampleSize: opts.sampleSize ?? null,
    sourceVersion: opts.sourceVersion ?? null,
    fileHash: opts.fileHash,
    parserVersion: PARSER_VERSION,
  };
}
