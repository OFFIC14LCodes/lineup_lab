import type {
  CanonicalPlayerInfo,
  ConfidenceTier,
  Contradiction,
  EvidenceComparison,
  MatchedSignal,
  NflversePlayerInfo
} from "./types";

// ─── Height normalization ────────────────────────────────────────────────────

// Parse a height string to total inches.
// Handles: "74" (integer inches), "6'2\"" (feet+inches), "6-2" (feet-inches), "6'2" (feet+inches)
export function normalizeHeightToInches(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === "NA") return null;

  // Pure integer (already in inches): "74"
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    // Sanity-check: NFL player heights are 60–84 inches (5'0" – 7'0")
    return n >= 60 && n <= 84 ? n : null;
  }

  // Feet + inches: "6'2\"", "6'2", "6-2", "6 2"
  const match = s.match(/^(\d+)['\-\s](\d+)/);
  if (match) {
    const feet = parseInt(match[1]!, 10);
    const inches = parseInt(match[2]!, 10);
    if (feet >= 5 && feet <= 7 && inches >= 0 && inches < 12) {
      return feet * 12 + inches;
    }
  }

  return null;
}

// ─── College normalization ────────────────────────────────────────────────────

// Well-known aliases where nflverse and Sleeper use different names for the same school.
const COLLEGE_CANONICAL: Record<string, string> = {
  // Official name → common name used by the other source
  "olemiss": "mississippi",
  "southernmiss": "southernmississippi",
  // Miami disambiguation: "Miami (FL)" and plain "Miami" both → "miamifl"
  "miamifl": "miami",
  // Appended suffixes that differ
  "fortvalleystate": "fortvalleystatecollege",
  "sacredheart": "sacredheartuniversity",
  "campbell": "campbelluniversity",
  "stephenfaustin": "stephenfaustinstate",
  "shepherd": "shepherdwv",
  "yorkcan": "yorkcanada",
  "louisiana": "louisianalafayette",
  "umass": "umassamherst",
  "northwestmissouristate": "nwmissouristateuniversity",
  // Barton College
  "barton": "bartoncollege",
  "julian": "campbelluniversity",
};

function resolveCollegeAlias(normalized: string): string {
  return COLLEGE_CANONICAL[normalized] ?? normalized;
}

// Normalize a college name for comparison.
// Takes the primary school (before first semicolon for transfer players), lowercases,
// strips non-alphanumeric chars, and resolves known aliases.
export function normalizeCollegeForComparison(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const primary = raw.split(";")[0]!.trim();
  if (!primary || primary === "NA") return null;
  const normalized = primary.toLowerCase().replace(/[^a-z0-9]/g, "");
  return resolveCollegeAlias(normalized);
}

// ─── Evidence comparison ─────────────────────────────────────────────────────

export function buildEvidenceComparison(
  source: NflversePlayerInfo,
  canonical: CanonicalPlayerInfo
): EvidenceComparison {
  const strongMatches: MatchedSignal[] = [];
  const mediumMatches: MatchedSignal[] = [];
  const contradictions: Contradiction[] = [];

  // ── Strong signal: ESPN ID ──────────────────────────────────────────────────
  const srcEspn = source.espnId?.trim() || null;
  const canEspn = canonical.metaEspnId?.trim() || null;
  if (srcEspn && canEspn) {
    if (srcEspn === canEspn) {
      strongMatches.push({
        field: "espn_id",
        sourceValue: srcEspn,
        canonicalValue: canEspn,
        strength: "strong"
      });
    } else {
      contradictions.push({
        field: "espn_id",
        sourceValue: srcEspn,
        canonicalValue: canEspn,
        description: `espn_id mismatch: nflverse=${srcEspn} canonical=${canEspn}`
      });
    }
  }

  // ── Strong signal: Birth date ──────────────────────────────────────────────
  const srcBDate = source.birthDate?.trim() || null;
  const canBDate = canonical.metaBirthDate?.trim() || null;
  const srcBDateValid = srcBDate && srcBDate !== "NA";
  const canBDateValid = canBDate && canBDate !== "NA" && canBDate !== "null";

  if (srcBDateValid && canBDateValid) {
    if (srcBDate === canBDate) {
      strongMatches.push({
        field: "birth_date",
        sourceValue: srcBDate!,
        canonicalValue: canBDate!,
        strength: "strong"
      });
    } else {
      contradictions.push({
        field: "birth_date",
        sourceValue: srcBDate,
        canonicalValue: canBDate,
        description: `birth_date mismatch: nflverse=${srcBDate} canonical=${canBDate}`
      });
    }
  }

  // ── Medium signal: College ─────────────────────────────────────────────────
  const srcCollege = normalizeCollegeForComparison(source.college);
  const canCollege = normalizeCollegeForComparison(canonical.metaCollege);
  if (srcCollege && canCollege && srcCollege === canCollege) {
    mediumMatches.push({
      field: "college",
      sourceValue: source.college!,
      canonicalValue: canonical.metaCollege!,
      strength: "medium"
    });
  }
  // College mismatch is NOT a contradiction — differing abbreviations or transfer history

  // ── Medium signal: Height (within 1 inch) ──────────────────────────────────
  const srcHeight = normalizeHeightToInches(source.height);
  const canHeight = canonical.metaHeightInches;
  if (srcHeight !== null && canHeight !== null && Math.abs(srcHeight - canHeight) <= 1) {
    mediumMatches.push({
      field: "height",
      sourceValue: String(srcHeight),
      canonicalValue: String(canHeight),
      strength: "medium"
    });
  }

  // ── Medium signal: Weight (within 10 lbs) ──────────────────────────────────
  const srcWeightRaw = source.weight?.trim();
  const srcWeight = srcWeightRaw && srcWeightRaw !== "NA" ? parseInt(srcWeightRaw, 10) : null;
  const canWeight = canonical.metaWeightLbs;
  if (srcWeight !== null && !isNaN(srcWeight) && canWeight !== null && Math.abs(srcWeight - canWeight) <= 10) {
    mediumMatches.push({
      field: "weight",
      sourceValue: String(srcWeight),
      canonicalValue: String(canWeight),
      strength: "medium"
    });
  }

  // ── Medium signal: Rookie year ──────────────────────────────────────────────
  if (source.rookieSeason !== null && canonical.metaRookieYear !== null
    && source.rookieSeason === canonical.metaRookieYear) {
    mediumMatches.push({
      field: "rookie_year",
      sourceValue: String(source.rookieSeason),
      canonicalValue: String(canonical.metaRookieYear),
      strength: "medium"
    });
  }

  // ── Suffix check ────────────────────────────────────────────────────────────
  // If nflverse has a suffix (Jr., Sr., II, III, IV, V) and the canonical full name
  // doesn't include it, flag as a soft ambiguity concern.
  const srcSuffix = source.suffix?.trim() || null;
  const srcSuffixPresent = srcSuffix && srcSuffix !== "" && srcSuffix !== "NA";
  const canFullName = canonical.fullName ?? "";
  const suffixInCanonical = srcSuffixPresent
    ? canFullName.toLowerCase().includes(srcSuffix!.toLowerCase())
    : true;

  // ── Tier classification ─────────────────────────────────────────────────────
  const { tier, reason } = classifyTier({
    strongMatches,
    mediumMatches,
    contradictions,
    hasSuffixConflict: srcSuffixPresent ? !suffixInCanonical : false
  });

  return { strongMatches, mediumMatches, contradictions, tier, approvalReason: reason };
}

function classifyTier(params: {
  strongMatches: MatchedSignal[];
  mediumMatches: MatchedSignal[];
  contradictions: Contradiction[];
  hasSuffixConflict: boolean;
}): { tier: ConfidenceTier; reason: string } {
  const { strongMatches, mediumMatches, contradictions, hasSuffixConflict } = params;

  // Hard contradictions always block auto-approval
  if (contradictions.length > 0) {
    return {
      tier: "conflict",
      reason: `contradiction: ${contradictions.map((c) => c.field).join(", ")}`
    };
  }

  const hasStrong = strongMatches.length >= 1;
  const hasTwoMedium = mediumMatches.length >= 2;
  const qualifiesForAuto = hasStrong || hasTwoMedium;

  if (qualifiesForAuto && !hasSuffixConflict) {
    const signals = [
      ...strongMatches.map((s) => `${s.field}(strong)`),
      ...mediumMatches.map((m) => `${m.field}(medium)`)
    ].join(", ");
    return {
      tier: "auto_approved",
      reason: `matches: ${signals}`
    };
  }

  if (qualifiesForAuto && hasSuffixConflict) {
    return {
      tier: "high_confidence_review",
      reason: `suffix_requires_review: ${strongMatches.map((s) => s.field).concat(mediumMatches.map((m) => m.field)).join(", ")}`
    };
  }

  if (mediumMatches.length === 1) {
    return {
      tier: "high_confidence_review",
      reason: `single_medium_match_only: ${mediumMatches[0]!.field}`
    };
  }

  return {
    tier: "high_confidence_review",
    reason: "name_and_position_only"
  };
}
