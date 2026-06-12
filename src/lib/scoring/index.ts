export { auditLeagueScoringSettings } from "@/lib/scoring/coverage";
export { auditAggregateScoringCompatibility } from "@/lib/scoring/aggregate-compatibility";
export { normalizeSleeperScoringSettings } from "@/lib/scoring/normalize-settings";
export { getCanonicalStatDefinitions } from "@/lib/scoring/stat-aliases";
export {
  BLACKBIRD_SCORING_FORMULA_VERSION,
  scoreFantasyStats,
  scoreProjection,
  scoreSeasonStats,
  scoreWeeklyStats
} from "@/lib/scoring/score-player";
export { SLEEPER_SCORING_RULES } from "@/lib/scoring/sleeper-keys";
export type * from "@/lib/scoring/types";
