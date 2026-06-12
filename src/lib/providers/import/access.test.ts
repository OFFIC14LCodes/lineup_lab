import { describe, expect, it } from "vitest";

import { isProviderDataImportEnabled } from "@/lib/providers/import/access";

describe("provider import feature flag", () => {
  it("defaults to disabled when env is absent", () => {
    const previous = process.env.ENABLE_PROVIDER_DATA_IMPORT;
    delete process.env.ENABLE_PROVIDER_DATA_IMPORT;
    expect(isProviderDataImportEnabled()).toBe(false);
    if (previous !== undefined) {
      process.env.ENABLE_PROVIDER_DATA_IMPORT = previous;
    }
  });

  it("treats false as disabled", () => {
    const previous = process.env.ENABLE_PROVIDER_DATA_IMPORT;
    process.env.ENABLE_PROVIDER_DATA_IMPORT = "false";
    expect(isProviderDataImportEnabled()).toBe(false);
    if (previous !== undefined) {
      process.env.ENABLE_PROVIDER_DATA_IMPORT = previous;
    } else {
      delete process.env.ENABLE_PROVIDER_DATA_IMPORT;
    }
  });
});
