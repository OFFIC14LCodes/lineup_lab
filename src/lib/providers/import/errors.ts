export const IMPORT_ERROR_CODES = {
  authRequired: "AUTH_REQUIRED",
  importDisabled: "IMPORT_DISABLED",
  invalidDatasetKind: "INVALID_DATASET_KIND",
  invalidProvider: "INVALID_PROVIDER",
  invalidInjuryMode: "INVALID_INJURY_MODE",
  missingFilename: "MISSING_FILENAME",
  fileTooLarge: "FILE_TOO_LARGE",
  emptyFile: "EMPTY_FILE",
  malformedJson: "MALFORMED_JSON",
  malformedCsv: "MALFORMED_CSV",
  invalidFileType: "INVALID_FILE_TYPE",
  tooManyRows: "TOO_MANY_ROWS",
  invalidRequest: "INVALID_REQUEST",
  sessionNotFound: "SESSION_NOT_FOUND",
  sessionExpired: "SESSION_EXPIRED",
  sessionNotExecutable: "SESSION_NOT_EXECUTABLE",
  executionAlreadyStarted: "EXECUTION_ALREADY_STARTED",
  executionAlreadyCompleted: "EXECUTION_ALREADY_COMPLETED",
  mappingNotApprovable: "MAPPING_NOT_APPROVABLE",
  mappingConflict: "MAPPING_CONFLICT",
  previewPersistenceFailed: "PREVIEW_PERSISTENCE_FAILED",
  internalError: "INTERNAL_ERROR"
} as const;

export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[keyof typeof IMPORT_ERROR_CODES];

export class ImportWorkflowError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ImportWorkflowError";
  }
}

export function toImportErrorPayload(error: unknown) {
  if (error instanceof ImportWorkflowError) {
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
        code: IMPORT_ERROR_CODES.internalError,
        message: "Unable to process provider import request."
      }
    }
  };
}
