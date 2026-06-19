export type WarRoomManualQaStatus = "pass" | "warn" | "fail" | "not_tested";

export type WarRoomManualQaRecommendation =
  | "war_room_manual_qa_passed"
  | "war_room_manual_qa_passed_with_warnings"
  | "war_room_manual_qa_needs_bugfix"
  | "war_room_manual_qa_blocked";

export type WarRoomLaunchCandidateStatus =
  | "launch_candidate_pass"
  | "launch_candidate_pass_with_warnings"
  | "launch_candidate_needs_bugfix"
  | "launch_candidate_blocked";

export type WarRoomManualQaSectionName =
  | "environment"
  | "draft_connection"
  | "draft_state_loading"
  | "board_modes"
  | "draft_suggestions"
  | "full_blackbird_rank"
  | "available_blackbird_rank"
  | "available_filtering"
  | "pick_updates"
  | "roster_construction"
  | "plan_alignment"
  | "gm_brief"
  | "player_modal"
  | "search_filter_load_more"
  | "sync_status"
  | "error_stale_states"
  | "responsive_desktop"
  | "responsive_tablet"
  | "responsive_mobile"
  | "data_policy_holdbacks"
  | "unsupported_position_filtering"
  | "legacy_archive_filtering"
  | "v8_2_safety"
  | "console_errors";

export type WarRoomManualQaSectionInput = {
  status: WarRoomManualQaStatus;
  critical?: boolean;
  notes?: string;
};

export type WarRoomManualQaInput = Record<WarRoomManualQaSectionName, WarRoomManualQaSectionInput> & {
  overall_notes?: string;
};

export type WarRoomManualQaSection = WarRoomManualQaSectionInput & {
  name: WarRoomManualQaSectionName;
  critical: boolean;
};

export type WarRoomManualQaTriageItem = {
  severity: "blocker" | "high" | "medium" | "low";
  area: WarRoomManualQaSectionName;
  description: string;
  suggested_next_action: string;
  is_blocker?: boolean;
  recommended_fix_or_action?: string;
  manual_retest_required?: boolean;
};

export type WarRoomManualQaReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  inputPath: string | null;
  recommendation: WarRoomManualQaRecommendation;
  launch_candidate_status: WarRoomLaunchCandidateStatus;
  sections: WarRoomManualQaSection[];
  summary: Record<WarRoomManualQaStatus, number>;
  missingRequiredSections: WarRoomManualQaSectionName[];
  triage: WarRoomManualQaTriageItem[];
  launch_candidate_triage: WarRoomManualQaTriageItem[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  overallNotes: string;
};

export type WarRoomManualQaArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
