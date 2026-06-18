# H10.17 War Room Production Readiness

Generated: 2026-06-16T00:15:32.366Z
Verdict: H10.17 WAR ROOM PRODUCTION READINESS READY

## Aggregate

- Total checks: 8
- Passed: 8
- Failed: 0
- Blocked: 0
- Production e2e bypass guard present: true
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}

## Rooms

### preview_env_absent / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected true, actual true
- Experiment flag actual: false
- Uploaded rankings observed: false
- Legacy primary observed: true
- Blackbird preview observed: true
- Selector observed: false
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":true,"caveat":true}
- Empty states observed: None
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_absent-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- Error: None

### preview_env_absent / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected true, actual true
- Experiment flag actual: false
- Uploaded rankings observed: true
- Legacy primary observed: true
- Blackbird preview observed: true
- Selector observed: false
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":true,"caveat":true}
- Empty states observed: No synced draft picks yet
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_absent-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### preview_env_true / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected true, actual true
- Experiment flag actual: false
- Uploaded rankings observed: false
- Legacy primary observed: true
- Blackbird preview observed: true
- Selector observed: false
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":true,"caveat":true}
- Empty states observed: None
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_true-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- Error: None

### preview_env_true / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected true, actual true
- Experiment flag actual: false
- Uploaded rankings observed: true
- Legacy primary observed: true
- Blackbird preview observed: true
- Selector observed: false
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":true,"caveat":true}
- Empty states observed: No synced draft picks yet
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_true-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### preview_env_false / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected false, actual false
- Experiment flag actual: false
- Uploaded rankings observed: false
- Legacy primary observed: false
- Blackbird preview observed: false
- Selector observed: false
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":false,"caveat":false}
- Empty states observed: Recommendations need uploaded rankings
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_false-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- Error: None

### preview_env_false / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected false, actual false
- Experiment flag actual: false
- Uploaded rankings observed: true
- Legacy primary observed: true
- Blackbird preview observed: false
- Selector observed: false
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":false,"caveat":false}
- Empty states observed: No synced draft picks yet
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_false-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### experiment_env_true / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected true, actual true
- Experiment flag actual: true
- Uploaded rankings observed: false
- Legacy primary observed: true
- Blackbird preview observed: true
- Selector observed: true
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":true,"caveat":true}
- Empty states observed: None
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\experiment_env_true-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- Error: None

### experiment_env_true / BestBalls in Hand IDP Dynasty 

- Loaded: true
- Preview flag: expected true, actual true
- Experiment flag actual: true
- Uploaded rankings observed: true
- Legacy primary observed: true
- Blackbird preview observed: true
- Selector observed: true
- Labels observed: {"experimental":true,"readOnly":true,"projectionMarketRosterTiming":true,"caveat":true}
- Empty states observed: No synced draft picks yet
- Banned language: None
- Safety assertions: {"defaultSourceRemainsLegacy":true,"sourceSwitchingDoesNotPersistState":true,"blackbirdDoesNotMutateLegacyRows":true,"blackbirdDoesNotMutateAvailablePlayerOrder":true,"blackbirdDoesNotMutateProjectionPreview":true,"blackbirdDoesNotMutateDraftState":true,"noRecommendationPersistence":true,"noProjectionMutation":true,"noLegacyReplacement":true,"noBannedRecommendationLanguage":true,"productionE2EBypassGuardPresent":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\experiment_env_true-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

## Screenshots

- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_absent-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_absent-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\tablet-war-room-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\mobile-war-room-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_true-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_true-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_false-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\preview_env_false-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\experiment_env_true-no_rankings_preview-desktop-f85238ff-b2ee-4053-8493-e38c4cb63bd3.png
- C:\Projects\lineup_lab\artifacts\projections\h10-war-room-production-screenshots\experiment_env_true-uploaded_rankings_source_default-desktop-c82aef89-ce90-40f0-936f-545656045554.png

## Remaining Risks

- Browser authentication uses the server-only local e2e bypass, not real OAuth.
- The harness disables War Room auto-sync so source-switching checks can isolate UI reads from Sleeper sync writes.
- Real production behavior still depends on Vercel environment variables and Supabase OAuth dashboard configuration.
