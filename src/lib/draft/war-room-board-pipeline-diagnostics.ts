import type { BlackbirdBoardRow } from "@/lib/draft/blackbird-board";

export type WarRoomBoardPipelineTopRow = {
  rank: number;
  playerName: string;
  position: string | null;
  team: string | null;
  trust: string;
};

export type WarRoomBoardPipelineDiagnostics = {
  auditTop25: WarRoomBoardPipelineTopRow[];
  serverPayloadTop25: WarRoomBoardPipelineTopRow[];
  clientSortedTop25: WarRoomBoardPipelineTopRow[];
  renderedTop25: WarRoomBoardPipelineTopRow[];
  top25MatchesAudit: boolean;
  mismatches: Array<{
    rank: number;
    audit: string | null;
    serverPayload: string | null;
    clientSorted: string | null;
    rendered: string | null;
  }>;
};

export function buildWarRoomBoardPipelineDiagnostics(input: {
  auditRows: BlackbirdBoardRow[];
  serverPayloadRows: BlackbirdBoardRow[];
  clientSortedRows: BlackbirdBoardRow[];
  renderedRows?: BlackbirdBoardRow[];
}): WarRoomBoardPipelineDiagnostics {
  const auditTop25 = topRows(input.auditRows);
  const serverPayloadTop25 = topRows(input.serverPayloadRows);
  const clientSortedTop25 = topRows(input.clientSortedRows);
  const renderedTop25 = topRows(input.renderedRows ?? input.clientSortedRows);
  const mismatches = auditTop25
    .map((audit, index) => {
      const serverPayload = serverPayloadTop25[index] ?? null;
      const clientSorted = clientSortedTop25[index] ?? null;
      const rendered = renderedTop25[index] ?? null;
      const same =
        audit.playerName === serverPayload?.playerName &&
        audit.playerName === clientSorted?.playerName &&
        audit.playerName === rendered?.playerName;
      return same
        ? null
        : {
            rank: index + 1,
            audit: audit.playerName,
            serverPayload: serverPayload?.playerName ?? null,
            clientSorted: clientSorted?.playerName ?? null,
            rendered: rendered?.playerName ?? null,
          };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return {
    auditTop25,
    serverPayloadTop25,
    clientSortedTop25,
    renderedTop25,
    top25MatchesAudit: mismatches.length === 0,
    mismatches,
  };
}

function topRows(rows: BlackbirdBoardRow[]): WarRoomBoardPipelineTopRow[] {
  return [...rows]
    .sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName))
    .slice(0, 25)
    .map((row) => ({
      rank: row.blackbirdBoardRank,
      playerName: row.playerName,
      position: row.position,
      team: row.team,
      trust: row.projectionTrust.trustLabel,
    }));
}
