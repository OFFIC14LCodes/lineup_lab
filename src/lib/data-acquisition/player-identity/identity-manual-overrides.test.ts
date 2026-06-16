import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadIdentityManualOverrides } from "./identity-manual-overrides";

describe("identity manual overrides", () => {
  it("loads only approved manual overrides as active overrides", async () => {
    const root = await tempRoot();
    const filePath = path.join(root, "data", "player-identity", "manual-overrides.csv");
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, [
      "sleeper_id,gsis_id,reason,review_status",
      "s1,00-one,wrong profile,approved",
      "s2,00-two,still reviewing,pending",
      "s3,00-three,bad row,rejected",
    ].join("\n"));

    const result = loadIdentityManualOverrides(root);

    expect(result.exists).toBe(true);
    expect(result.rows).toBe(3);
    expect(result.approvedRows).toBe(1);
    expect(result.skippedRows).toBe(2);
    expect(result.approved[0]).toMatchObject({ sleeperId: "s1", gsisId: "00-one", reviewStatus: "approved" });
  });

  it("treats a missing override file as non-fatal and empty", async () => {
    const root = await tempRoot();
    const result = loadIdentityManualOverrides(root);

    expect(result.exists).toBe(false);
    expect(result.approved).toEqual([]);
    expect(result.issues).toContain("manual override file missing; no overrides applied");
  });

  it("reports required column gaps", async () => {
    const root = await tempRoot();
    const filePath = path.join(root, "data", "player-identity", "manual-overrides.csv");
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "sleeper_id,gsis_id\ns1,00-one\n");

    const result = loadIdentityManualOverrides(root);

    expect(result.missingColumns).toEqual(["reason", "review_status"]);
    expect(result.approvedRows).toBe(0);
  });
});

async function tempRoot() {
  return mkdtemp(path.join(os.tmpdir(), "blackbird-identity-overrides-"));
}
