import { describe, expect, it } from "vitest";

import { DEFAULT_SEASON, parseMode, parseSeason } from "./import-cli-options";

// ─── parseSeason ─────────────────────────────────────────────────────────────

describe("parseSeason", () => {
  it("returns DEFAULT_SEASON when no argv or env is provided", () => {
    expect(parseSeason([], {})).toBe(DEFAULT_SEASON);
  });

  it("parses --season from argv", () => {
    expect(parseSeason(["--season=2024"], {})).toBe(2024);
  });

  it("parses NFLVERSE_SEASON from env", () => {
    expect(parseSeason([], { NFLVERSE_SEASON: "2023" })).toBe(2023);
  });

  it("CLI --season takes precedence over NFLVERSE_SEASON env", () => {
    expect(parseSeason(["--season=2024"], { NFLVERSE_SEASON: "2023" })).toBe(2024);
  });

  it("falls back to default when --season value is not a valid integer", () => {
    expect(parseSeason(["--season=abc"], {})).toBe(DEFAULT_SEASON);
  });

  it("falls back to default when NFLVERSE_SEASON is out of range", () => {
    expect(parseSeason([], { NFLVERSE_SEASON: "1999" })).toBe(DEFAULT_SEASON);
  });
});

// ─── parseMode ───────────────────────────────────────────────────────────────

describe("parseMode", () => {
  it("defaults to dry_run with no argv or env", () => {
    expect(parseMode([], {})).toBe("dry_run");
  });

  it("--execute in argv enables execute mode", () => {
    expect(parseMode(["--execute"], {})).toBe("execute");
  });

  it("NFLVERSE_EXECUTE=true in env enables execute mode", () => {
    expect(parseMode([], { NFLVERSE_EXECUTE: "true" })).toBe("execute");
  });

  it("NFLVERSE_EXECUTE=false keeps dry_run", () => {
    expect(parseMode([], { NFLVERSE_EXECUTE: "false" })).toBe("dry_run");
  });

  it("--execute in argv takes precedence when env also present", () => {
    expect(parseMode(["--execute"], { NFLVERSE_EXECUTE: "false" })).toBe("execute");
  });
});
