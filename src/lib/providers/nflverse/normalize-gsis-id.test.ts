import { describe, it, expect } from "vitest";
import { normalizeGsisId } from "./normalize-gsis-id";

describe("normalizeGsisId", () => {
  it("preserves standard format with leading zeros", () => {
    expect(normalizeGsisId("00-0031234")).toBe("00-0031234");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeGsisId("  00-0031234  ")).toBe("00-0031234");
    expect(normalizeGsisId("\t00-0039337\n")).toBe("00-0039337");
  });

  it("uppercases legacy alphanumeric IDs", () => {
    expect(normalizeGsisId("ALL637395")).toBe("ALL637395");
    expect(normalizeGsisId("all637395")).toBe("ALL637395");
    expect(normalizeGsisId("All637395")).toBe("ALL637395");
  });

  it("is idempotent — normalizing an already-normalized ID returns the same value", () => {
    expect(normalizeGsisId("00-0039337")).toBe("00-0039337");
    expect(normalizeGsisId("ALL637395")).toBe("ALL637395");
  });

  it("returns null for null input", () => {
    expect(normalizeGsisId(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeGsisId(undefined)).toBeNull();
  });

  it("returns null for blank string", () => {
    expect(normalizeGsisId("")).toBeNull();
    expect(normalizeGsisId("   ")).toBeNull();
  });

  it("never produces scientific notation or numeric coercion", () => {
    // A standard GSIS ID must never be interpreted as a float.
    const result = normalizeGsisId("00-0039337");
    expect(result).not.toContain("e");
    expect(result).toBe("00-0039337");
  });

  it("preserves hyphens in standard format", () => {
    const result = normalizeGsisId("00-0039337");
    expect(result).toContain("-");
  });

  it("two source strings with identical content normalize to the same key", () => {
    expect(normalizeGsisId(" 00-0039337 ")).toBe(normalizeGsisId("00-0039337"));
    expect(normalizeGsisId("ALL637395")).toBe(normalizeGsisId("all637395"));
  });

  it("does not strip leading zeros", () => {
    const result = normalizeGsisId("00-0000001");
    expect(result).toBe("00-0000001");
    expect(result?.startsWith("0")).toBe(true);
  });
});
