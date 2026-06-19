# Blackbird Trust Metadata Audit

Generated: 2026-06-19T19:28:25.677Z
Projection season: 2026
Recommendation: blackbird_trust_metadata_ready_for_manual_review

## Executive Summary

Raw projection trust was globally low because current enriched projection rows are uploaded/current-season projections without stat component, floor, and ceiling metadata. Calibrated trust now uses identity, active roster policy, projection presence, source confidence, and ADP availability as evidence quality signals while keeping blocked/archive/manual-review/fallback rows capped.

## Top 100 Trust Distribution

- Before: high=0, medium=0, low=91, very_low=9
- After: high=81, medium=19, low=0, very_low=0

## Reason Counts

- missing_projection_confidence: 0
- missing_identity_confidence: 0
- missing_roster_confirmation: 1
- missing_sleeper_metadata: 0
- missing_historical_profile: 0
- fallback_projection: 0
- source_expansion_policy: 0
- manual_review_policy: 1
- blocked_or_archive_policy: 0
- trust_defaulted_low: 300
- trust_field_not_mapped: 0
- trust_overridden_by_data_gap: 300
- strong_identity: 300
- active_roster_confirmed: 299
- projection_present: 300
- market_evidence_present: 300
- source_confidence_present: 300

## Watchlist

- Ja'Marr Chase: raw=low, calibrated=high, rank=5, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Bijan Robinson: raw=low, calibrated=high, rank=9, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Justin Jefferson: raw=low, calibrated=high, rank=22, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- CeeDee Lamb: raw=low, calibrated=high, rank=20, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Saquon Barkley: raw=low, calibrated=high, rank=23, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Jahmyr Gibbs: raw=low, calibrated=high, rank=3, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Amon-Ra St. Brown: raw=low, calibrated=high, rank=7, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Puka Nacua: raw=low, calibrated=high, rank=2, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Malik Nabers: raw=low, calibrated=medium, rank=39, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Josh Allen: raw=low, calibrated=high, rank=1, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Lamar Jackson: raw=low, calibrated=high, rank=6, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Jayden Daniels: raw=low, calibrated=medium, rank=24, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Joe Burrow: raw=low, calibrated=high, rank=25, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Jalen Hurts: raw=low, calibrated=high, rank=4, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Brock Bowers: raw=low, calibrated=medium, rank=37, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Trey McBride: raw=low, calibrated=high, rank=26, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Nico Collins: raw=low, calibrated=high, rank=33, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Brian Thomas: raw=low, calibrated=medium, rank=38, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Drake London: raw=low, calibrated=high, rank=41, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- Patrick Mahomes: raw=low, calibrated=high, rank=8, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap

## Top Rows

- #1 Josh Allen QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #2 Puka Nacua WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #3 Jahmyr Gibbs RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #4 Jalen Hurts QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #5 Ja'Marr Chase WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #6 Lamar Jackson QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #7 Amon-Ra St. Brown WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #8 Patrick Mahomes QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #9 Bijan Robinson RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #10 Bo Nix QB: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #11 Drake Maye QB: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #12 Jared Goff QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #13 Baker Mayfield QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #14 Matthew Stafford QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #15 Trevor Lawrence QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #16 Caleb Williams QB: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #17 Justin Herbert QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #18 Dak Prescott QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #19 Jaxon Smith-Njigba WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #20 CeeDee Lamb WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #21 De'Von Achane RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #22 Justin Jefferson WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #23 Saquon Barkley RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #24 Jayden Daniels QB: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #25 Joe Burrow QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #26 Trey McBride TE: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #27 James Cook RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #28 Kyren Williams RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #29 Christian McCaffrey RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #30 Derrick Henry RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #31 Jonathan Taylor RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #32 Jordan Love QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #33 Nico Collins WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #34 A.J. Brown WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #35 Davante Adams WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #36 Ashton Jeanty RB: raw=very_low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #37 Brock Bowers TE: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #38 Brian Thomas WR: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #39 Malik Nabers WR: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #40 Josh Jacobs RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #41 Drake London WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #42 Ladd McConkey WR: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #43 Chase Brown RB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #44 Bucky Irving RB: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #45 Marvin Harrison WR: raw=low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #46 C.J. Stroud QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #47 George Pickens WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #48 Brock Purdy QB: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #49 Jaxson Dart QB: raw=very_low, calibrated=medium, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap
- #50 Zay Flowers WR: raw=low, calibrated=high, policy=final_policy_active_candidate, market=yes, reasons=active_roster_confirmed|market_evidence_present|projection_present|source_confidence_present|strong_identity|trust_defaulted_low|trust_overridden_by_data_gap

## Safety

- dry_run_only: pass - Trust audit reads local rows and writes local report files only.
- no_supabase_writes: pass - No Supabase client is imported or called.
- v8_2_not_enabled: pass - Audit does not read or write v8.2 feature flags.
- market_anchor_default_disabled: pass - ADP/market rank are evidence fields only; Market Anchor remains disabled by default.
- Market anchor enabled by default: false
- Supabase writes: false
- v8.2 enabled: false

