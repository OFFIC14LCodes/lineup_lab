export type PreDraftStrategyUiLoadState = "loading" | "ready" | "error";

export type PreDraftStrategyUiInput = {
  loadState: PreDraftStrategyUiLoadState;
  error: string | null;
  dataGaps?: string[];
  sectionCounts?: Record<string, number>;
  riskNotes?: string[];
  safetyLanguagePassed?: boolean;
};

export type PreDraftStrategyUiViewModel = {
  title: "Pre-Draft Strategy Preview";
  loading: boolean;
  unavailable: boolean;
  partial: boolean;
  empty: boolean;
  caveats: string[];
  dataGaps: string[];
  errorMessage: string | null;
  bannedLanguageFound: string[];
};

export const H11_STRATEGY_UI_BANNED_LANGUAGE = [
  "must draft",
  "guaranteed",
  "lock",
  "can't miss",
  "can’t miss",
  "best pick",
  "ai advice",
  "you should draft",
  "final recommendation",
  "final plan",
] as const;

export function buildPreDraftStrategyUiViewModel(input: PreDraftStrategyUiInput): PreDraftStrategyUiViewModel {
  const dataGaps = Array.from(new Set(input.dataGaps ?? [])).sort();
  const sectionCounts = input.sectionCounts ?? {};
  const renderedSectionCount = Object.values(sectionCounts).reduce((sum, count) => sum + count, 0);
  const caveats = [
    "Read-only",
    "Experimental",
    "Based on currently available projections, market context, and league context.",
    ...(input.riskNotes ?? []).some((note) => note.toLowerCase().includes("historical"))
      ? ["Historical outcome validation is not yet available."]
      : ["Historical outcome validation is not yet available."],
  ];
  const textForSafety = [
    "Pre-Draft Strategy Preview",
    input.error ?? "",
    ...dataGaps,
    ...caveats,
  ].join(" ");

  return {
    title: "Pre-Draft Strategy Preview",
    loading: input.loadState === "loading",
    unavailable: input.loadState === "error",
    partial: dataGaps.length > 0,
    empty: input.loadState === "ready" && renderedSectionCount === 0,
    caveats,
    dataGaps,
    errorMessage: input.loadState === "error" ? input.error ?? "Unable to load strategy preview. War Room remains usable." : null,
    bannedLanguageFound: input.safetyLanguagePassed === false ? ["endpoint safety language check failed"] : findBannedStrategyUiLanguage(textForSafety),
  };
}

export function findBannedStrategyUiLanguage(text: string): string[] {
  const normalized = text.toLowerCase();
  return H11_STRATEGY_UI_BANNED_LANGUAGE.filter((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(normalized);
  });
}
