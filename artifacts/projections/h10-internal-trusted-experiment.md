# H10.18 Internal Trusted Experimental Mode

Generated: 2026-06-15T18:14:29.831Z
Verdict: H10.18 INTERNAL TRUSTED EXPERIMENTAL MODE READY

## Gating

No durable admin-role table was found. H10.18 uses the environment flag plus optional trusted-user allowlist; local e2e and scoring operator users are treated as test users.

## Safety Assertions

- disabledMatchesH1017: true
- enabledExposesInternalUiOnlyWhenAllowed: true
- noPersistence: true
- noMutation: true
- noSourceSelectionPersistence: true
- noLegacyReplacement: true
- noBannedLanguage: true
- historicalValidationCaveatVisible: true

## Results

### disabled
- Internal enabled: false
- Internal allowed: false
- Gating: trusted_user_allowlist
- Internal label visible: false
- Historical caveat visible: false
- Legacy accessible: true
- No error overlay: true
- Banned language: None
- Mutation safety: {"legacyRecommendationsUnchanged":true,"availablePlayerOrderUnchanged":true,"projectionsUnchanged":true,"draftRoomStateUnchanged":true,"selectedSourceNotPersisted":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-internal-trusted-experiment-screenshots\disabled-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### enabled_allowed
- Internal enabled: true
- Internal allowed: true
- Gating: trusted_user_allowlist
- Internal label visible: true
- Historical caveat visible: true
- Legacy accessible: true
- No error overlay: true
- Banned language: None
- Mutation safety: {"legacyRecommendationsUnchanged":true,"availablePlayerOrderUnchanged":true,"projectionsUnchanged":true,"draftRoomStateUnchanged":true,"selectedSourceNotPersisted":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-internal-trusted-experiment-screenshots\enabled_allowed-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### enabled_allowed
- Internal enabled: true
- Internal allowed: true
- Gating: trusted_user_allowlist
- Internal label visible: true
- Historical caveat visible: true
- Legacy accessible: true
- No error overlay: true
- Banned language: None
- Mutation safety: {"legacyRecommendationsUnchanged":true,"availablePlayerOrderUnchanged":true,"projectionsUnchanged":true,"draftRoomStateUnchanged":true,"selectedSourceNotPersisted":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-internal-trusted-experiment-screenshots\enabled_allowed-tablet-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### enabled_allowed
- Internal enabled: true
- Internal allowed: true
- Gating: trusted_user_allowlist
- Internal label visible: true
- Historical caveat visible: true
- Legacy accessible: true
- No error overlay: true
- Banned language: None
- Mutation safety: {"legacyRecommendationsUnchanged":true,"availablePlayerOrderUnchanged":true,"projectionsUnchanged":true,"draftRoomStateUnchanged":true,"selectedSourceNotPersisted":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-internal-trusted-experiment-screenshots\enabled_allowed-mobile-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

### enabled_denied
- Internal enabled: true
- Internal allowed: false
- Gating: trusted_user_allowlist
- Internal label visible: false
- Historical caveat visible: false
- Legacy accessible: true
- No error overlay: true
- Banned language: None
- Mutation safety: {"legacyRecommendationsUnchanged":true,"availablePlayerOrderUnchanged":true,"projectionsUnchanged":true,"draftRoomStateUnchanged":true,"selectedSourceNotPersisted":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h10-internal-trusted-experiment-screenshots\enabled_denied-desktop-c82aef89-ce90-40f0-936f-545656045554.png
- Error: None

## Remaining Risks

- True historical completed-draft outcome validation is not available yet.
- Production admin gating should eventually move from env allowlist to a durable user-role model.
- Browser auth uses the local server-only e2e bypass and does not exercise Google OAuth.
