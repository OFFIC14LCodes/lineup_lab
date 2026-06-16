# H11.4 Round Window Contingencies

Generated: 2026-06-16T00:06:29.844Z
Verdict: passed

## Checks

- roundWindowPlansExist: true
- turnDiffersFromMiddle: true
- superflexGuidancePresent: true
- tePremiumGuidancePresent: true
- kDstCautionPresent: true
- idpCautionPresent: true
- contingencyTriggersPresent: true
- noBannedLanguage: true
- noMutationOrPersistence: true

## Examples

- turn slot: available=true, windows=5, triggers=qb-tier-superflex-pivot, idp-confidence-caution, turn-paired-position
- middle slot: available=true, windows=4, triggers=special-position-late-caution, middle-slot-flexibility
- superflex or 2QB: available=true, windows=5, triggers=qb-tier-superflex-pivot, idp-confidence-caution
- TE premium: available=true, windows=4, triggers=te-premium-value-fall, weak-survival-te, weak-survival-wr, middle-slot-flexibility
- IDP: available=true, windows=5, triggers=qb-tier-superflex-pivot, idp-confidence-caution, middle-slot-flexibility
- K/DST: available=true, windows=4, triggers=special-position-late-caution

## Safety

- mutatesDraftState: false
- mutatesProjectionData: false
- persistsStrategyState: false
- usesAi: false
