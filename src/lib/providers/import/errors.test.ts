import { describe, expect, it } from "vitest";

import { IMPORT_ERROR_CODES, ImportWorkflowError, toImportErrorPayload } from "@/lib/providers/import/errors";

describe("provider import error serialization", () => {
  it("serializes import workflow errors without internal details", () => {
    const serialized = toImportErrorPayload(
      new ImportWorkflowError(IMPORT_ERROR_CODES.sessionExpired, "This import preview has expired.", 410, {
        sql: "hidden"
      })
    );

    expect(serialized).toEqual({
      status: 410,
      body: {
        error: {
          code: "SESSION_EXPIRED",
          message: "This import preview has expired."
        }
      }
    });
  });
});
