export const SCORING_INSPECTOR_ERROR_CODES = {
  authRequired: "AUTH_REQUIRED",
  inspectorDisabled: "SCORING_INSPECTOR_DISABLED",
  invalidRequest: "INVALID_REQUEST",
  leagueNotFound: "LEAGUE_NOT_FOUND",
  scoringSettingsMissing: "SCORING_SETTINGS_MISSING",
  rowNotFound: "ROW_NOT_FOUND",
  internalError: "INTERNAL_ERROR"
} as const;

export class ScoringInspectorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ScoringInspectorError";
  }
}

export function toScoringInspectorErrorPayload(error: unknown) {
  if (error instanceof ScoringInspectorError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: SCORING_INSPECTOR_ERROR_CODES.internalError,
        message: "Unable to inspect scoring results."
      }
    }
  };
}
