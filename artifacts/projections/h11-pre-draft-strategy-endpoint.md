# H11.1 Pre-Draft Strategy Endpoint

Generated: 2026-06-15T19:47:51.697Z
Verdict: H11.1 PRE-DRAFT STRATEGY ENDPOINT READY
Endpoint: /api/draft-rooms/[draftRoomId]/pre-draft-strategy

## Live Data Loaded

- leagueSettings: true
- rosterSlots: true
- draftSlot: true
- teamCount: true
- h10TimingRows: true
- remainingPlayers: true

## Auth And Safety

- requiresAuthenticatedUser: true
- userScopedDraftRoomAccess: true
- unauthenticatedStatus: 401
- unauthorizedStatus: 404
- serviceRoleClientInBrowserPath: false
- readOnly: true
- mutatesDraftState: false
- mutatesProjections: false
- mutatesAvailablePlayerOrder: false
- persistsStrategyOutput: false
- usesLlm: false
- safetyLanguagePassed: true

## Examples

### Superflex, IDP, Deep roster, Uploaded rankings
- Draft room: c82aef89-ce90-40f0-936f-545656045554
- League: BestBalls in Hand IDP Dynasty 
- Data gaps: draftOrder: partial; h10WaitPlanFields: partial
- Safety language passed: true
- Sections: leagueSummary, scoringEmphasis, rosterConstructionPlan, positionalPriorityMap, draftSlotStrategy, roundWindowPlan, tierCliffWatchlist, valuePocketWatchlist, waitPositions, doNotForcePositions, contingencyPlans, specialPositionGuidance, riskNotes, explanationFragments, dataGaps, safetyLanguageStatus

### TE premium, Shallow roster, Uploaded rankings
- Draft room: fixture-te-premium
- League: [Fixture] TE Premium
- Data gaps: draftOrder: partial; h10WaitPlanFields: partial; idpKDstSupport: partial
- Safety language passed: true
- Sections: leagueSummary, scoringEmphasis, rosterConstructionPlan, positionalPriorityMap, draftSlotStrategy, roundWindowPlan, tierCliffWatchlist, valuePocketWatchlist, waitPositions, doNotForcePositions, contingencyPlans, specialPositionGuidance, riskNotes, explanationFragments, dataGaps, safetyLanguageStatus

### 1QB offense, Kicker, DST, Shallow roster, Uploaded rankings
- Draft room: 2f62d6e3-d309-4d50-8e7e-2ef05a83771c
- League: Legacy League
- Data gaps: draftOrder: partial
- Safety language passed: true
- Sections: leagueSummary, scoringEmphasis, rosterConstructionPlan, positionalPriorityMap, draftSlotStrategy, roundWindowPlan, tierCliffWatchlist, valuePocketWatchlist, waitPositions, doNotForcePositions, contingencyPlans, specialPositionGuidance, riskNotes, explanationFragments, dataGaps, safetyLanguageStatus

### Superflex, Shallow roster, Uploaded rankings
- Draft room: b386e78a-c7ff-4688-828e-6b48cbca863e
- League: 🪓 Chopped
- Data gaps: draftOrder: partial; idpKDstSupport: partial
- Safety language passed: true
- Sections: leagueSummary, scoringEmphasis, rosterConstructionPlan, positionalPriorityMap, draftSlotStrategy, roundWindowPlan, tierCliffWatchlist, valuePocketWatchlist, waitPositions, doNotForcePositions, contingencyPlans, specialPositionGuidance, riskNotes, explanationFragments, dataGaps, safetyLanguageStatus

## Missing Data Gaps

- draftOrder: partial
- h10WaitPlanFields: partial
- idpKDstSupport: partial

## Remaining Risks

- The route depends on live draft room state; exact strategy quality still depends on available draft slot, team count, scoring, projection, and H10 preview context.
- H10 preview rows are feature-gated in live state, so the endpoint can return a partial strategy when timing rows are absent.
- Historical completed-draft outcome validation remains unavailable.
- Production-grade admin gating remains separate from this authenticated user-scoped endpoint.
