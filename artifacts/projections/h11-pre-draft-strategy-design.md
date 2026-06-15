# H11.0 Pre-Draft Strategy Design
Generated: 2026-06-15T20:27:32.483Z
Verdict: H11.0 PRE-DRAFT STRATEGY DESIGN READY
## Data Availability
- roomsAudited: 11
- roomResultsAudited: 11
- superflexOr2QbRooms: 5
- tePremiumRooms: 1
- idpRooms: 3
- kickerRooms: 3
- dstRooms: 3
- shallowRosterRooms: 7
- roomsWithUploadedRankings: 10
- h10RecommendationRowsAvailable: 95
- h10WaitPlanRowsAvailable: 44
- representativeAudit: {"leagueScoring":"missing","rosterSlots":"partial","startingLineupRequirements":"partial","draftOrder":"partial","draftSlot":"missing","teamCount":"missing","roundCount":"missing","playerProjections":"available","marketAdp":"available","tiers":"available","scarcity":"available","h10RecommendationRows":"available","h10NeedTimingFields":"available","h10WaitPlanFields":"partial","idpKDstSupport":"available","notes":["Exact pre-draft strategy improves when raw draft slot, team count, round count, and roster slots are loaded.","H10 validation artifacts provide compact timing and recommendation rows but not every raw league scoring key.","True historical completed-draft outcome validation remains unavailable."]}
## Strategy Model
- model: Pure deterministic read model for pre-draft planning. Inputs: league settings, roster slots, draft slot, team count, H10 rows.
- leagueSummary: Summarize league format, roster structure, and available timing context. Inputs: room flags, roster slots, draft metadata.
- scoringEmphasis: Convert format signals into positional emphasis. Inputs: scoring settings, format flags, roster requirements.
- positionalPriorityMap: Rank positional planning priority without selecting a player. Inputs: starter counts, tier risk, market signals, special-position rules.
- draftSlotStrategy: Describe early, middle, or turn timing behavior. Inputs: draft slot, team count, snake timing.
- roundWindowPlan: Define broad windows for anchors, value pockets, depth, IDP, and K/DST. Inputs: format flags, roster requirements.
- tierCliffWatchlist: List visible tier risk from compact H10 rows. Inputs: tierDropRisk, tierCliff component, H10 tier.
- valuePocketWatchlist: List market value pockets from H10 market signals. Inputs: marketValueSignal, marketValue component.
- waitPositions: Surface H10 wait-plan-backed positions. Inputs: needTimingAction, waitPlanBacked, waitPlanTargetCount.
- doNotForcePositions: Prevent early forcing of low-priority or high-opportunity-cost slots. Inputs: K/DST flags, needTimingAction, opportunityCost.
- contingencyPlans: Generate if/then fallback plans for tier risk and wait uncertainty. Inputs: tier risk, format flags, wait target coverage.
- specialPositionGuidance: Handle IDP, kicker, and team defense with explicit caveats. Inputs: IDP/K/DST flags, roster requirements.
- riskNotes: Document missing inputs and validation limits. Inputs: data audit, source artifact coverage.
## Examples
### superflex/2QB room
- Room: BestBalls in Hand IDP Dynasty 
- Formats: Superflex, IDP, Shallow roster
- Draft slot archetype: early
- Priority map: {"QB":{"priority":"elite","score":95,"reasons":["QB has direct starter demand.","Superflex or 2QB format signal elevates QB priority."]},"RB":{"priority":"high","score":80,"reasons":["RB has direct starter demand.","Flex or deep roster settings increase depth value."]},"WR":{"priority":"high","score":80,"reasons":["WR has direct starter demand.","Flex or deep roster settings increase depth value."]},"TE":{"priority":"medium","score":60,"reasons":["TE has direct starter demand."]},"K":{"priority":"defer","score":1,"reasons":["K is generally a late-round fill position."]},"DEF":{"priority":"defer","score":1,"reasons":["DEF is generally a late-round fill position."]},"DL":{"priority":"medium","score":58,"reasons":["DL appears in the H10 planning pool.","IDP format signal requires defensive planning."]},"LB":{"priority":"medium","score":58,"reasons":["LB appears in the H10 planning pool.","IDP format signal requires defensive planning."]},"DB":{"priority":"medium","score":58,"reasons":["DB appears in the H10 planning pool.","IDP format signal requires defensive planning."]}}
- Tier cliffs: []
- Value pockets: []
### TE premium room
- Room: [Fixture] TE Premium
- Formats: TE premium, Shallow roster
- Draft slot archetype: middle
- Priority map: {"QB":{"priority":"medium","score":60,"reasons":["QB has direct starter demand."]},"RB":{"priority":"high","score":80,"reasons":["RB has direct starter demand.","Flex or deep roster settings increase depth value."]},"WR":{"priority":"high","score":87,"reasons":["WR has direct starter demand.","WR appears in the H10 planning pool.","WR has visible tier risk in H10 rows.","Flex or deep roster settings increase depth value."]},"TE":{"priority":"elite","score":89,"reasons":["TE has direct starter demand.","TE appears in the H10 planning pool.","TE has visible tier risk in H10 rows.","TE premium format signal elevates TE tier sensitivity."]},"K":{"priority":"defer","score":1,"reasons":["K is generally a late-round fill position."]},"DEF":{"priority":"defer","score":1,"reasons":["DEF is generally a late-round fill position."]},"DL":{"priority":"defer","score":25,"reasons":["DL has no strong pre-draft format signal."]},"LB":{"priority":"defer","score":25,"reasons":["LB has no strong pre-draft format signal."]},"DB":{"priority":"defer","score":25,"reasons":["DB has no strong pre-draft format signal."]}}
- Tier cliffs: [{"position":"TE","label":"Fixture Premium TE","tier":1,"risk":"high","reason":"TE tier risk is elevated in current H10 rows."},{"position":"WR","label":"Fixture WR","tier":1,"risk":"high","reason":"WR tier risk is elevated in current H10 rows."}]
- Value pockets: []
### IDP mixed room
- Room: BestBalls in Hand IDP Dynasty 
- Formats: Superflex, IDP, Shallow roster
- Draft slot archetype: middle
- Priority map: {"QB":{"priority":"elite","score":95,"reasons":["QB has direct starter demand.","Superflex or 2QB format signal elevates QB priority."]},"RB":{"priority":"high","score":72,"reasons":["RB has direct starter demand.","Flex or deep roster settings increase depth value."]},"WR":{"priority":"high","score":72,"reasons":["WR has direct starter demand.","Flex or deep roster settings increase depth value."]},"TE":{"priority":"medium","score":60,"reasons":["TE has direct starter demand."]},"K":{"priority":"defer","score":1,"reasons":["K is generally a late-round fill position."]},"DEF":{"priority":"defer","score":1,"reasons":["DEF is generally a late-round fill position."]},"DL":{"priority":"high","score":76,"reasons":["DL has direct starter demand.","DL appears in the H10 planning pool.","IDP format signal requires defensive planning."]},"LB":{"priority":"high","score":76,"reasons":["LB has direct starter demand.","LB appears in the H10 planning pool.","IDP format signal requires defensive planning."]},"DB":{"priority":"high","score":76,"reasons":["DB has direct starter demand.","DB appears in the H10 planning pool.","IDP format signal requires defensive planning."]}}
- Tier cliffs: []
- Value pockets: []
### K/DST room
- Room: Legacy League
- Formats: Kicker, DST, Shallow roster
- Draft slot archetype: turn
- Priority map: {"QB":{"priority":"medium","score":60,"reasons":["QB has direct starter demand."]},"RB":{"priority":"medium","score":68,"reasons":["RB has direct starter demand."]},"WR":{"priority":"medium","score":68,"reasons":["WR has direct starter demand."]},"TE":{"priority":"medium","score":60,"reasons":["TE has direct starter demand."]},"K":{"priority":"low","score":36,"reasons":["K has direct starter demand.","K is generally a late-round fill position."]},"DEF":{"priority":"low","score":36,"reasons":["DEF has direct starter demand.","DEF appears in the H10 planning pool.","DEF is generally a late-round fill position."]},"DL":{"priority":"defer","score":25,"reasons":["DL has no strong pre-draft format signal."]},"LB":{"priority":"defer","score":25,"reasons":["LB has no strong pre-draft format signal."]},"DB":{"priority":"defer","score":25,"reasons":["DB has no strong pre-draft format signal."]}}
- Tier cliffs: []
- Value pockets: []
### shallow roster room
- Room: 🪓 Chopped
- Formats: Superflex, Shallow roster
- Draft slot archetype: turn
- Priority map: {"QB":{"priority":"elite","score":100,"reasons":["QB has direct starter demand.","QB appears in the H10 planning pool.","QB has visible tier risk in H10 rows.","Superflex or 2QB format signal elevates QB priority."]},"RB":{"priority":"high","score":79,"reasons":["RB has direct starter demand.","RB appears in the H10 planning pool.","RB has visible tier risk in H10 rows.","Flex or deep roster settings increase depth value."]},"WR":{"priority":"high","score":86,"reasons":["WR has direct starter demand.","WR appears in the H10 planning pool.","WR has visible tier risk in H10 rows.","Flex or deep roster settings increase depth value."]},"TE":{"priority":"high","score":74,"reasons":["TE has direct starter demand.","TE appears in the H10 planning pool.","TE has visible tier risk in H10 rows."]},"K":{"priority":"defer","score":1,"reasons":["K is generally a late-round fill position."]},"DEF":{"priority":"defer","score":1,"reasons":["DEF is generally a late-round fill position."]},"DL":{"priority":"defer","score":25,"reasons":["DL has no strong pre-draft format signal."]},"LB":{"priority":"defer","score":25,"reasons":["LB has no strong pre-draft format signal."]},"DB":{"priority":"defer","score":25,"reasons":["DB has no strong pre-draft format signal."]}}
- Tier cliffs: [{"position":"TE","label":"Trey McBride","tier":1,"risk":"high","reason":"TE tier risk is elevated in current H10 rows."},{"position":"RB","label":"Christian McCaffrey","tier":1,"risk":"high","reason":"RB tier risk is elevated in current H10 rows."},{"position":"WR","label":"Puka Nacua","tier":1,"risk":"high","reason":"WR tier risk is elevated in current H10 rows."}]
- Value pockets: []
## Safety
- Read-only: true
- Mutates draft state: false
- Mutates projections: false
- Uses LLM: false
- Banned language failures: 0
## Missing Data / Risks
- Exact pre-draft snake timing needs draft slot, team count, and round count on the H11 input.
- The H10 validation artifact has compact format flags but does not always include raw league scoring keys.
- Some representative rooms expose only the remaining pool visible to H10 validation, not a full pre-draft player universe.
- True historical completed-draft outcome validation is still unavailable.
## Next Implementation Recommendation
Implement an authenticated read-only pre-draft strategy endpoint that loads live league settings, draft order, roster slots, H10 projections, market data, and timing rows, then returns this H11 read model without persisting strategy choices.