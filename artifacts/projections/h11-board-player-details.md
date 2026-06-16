# H11.4 Board Player Details

Generated: 2026-06-16T04:48:17.735Z
Verdict: passed

## Checks

- detailContextPresentForRows: true
- requestedFieldsPresent: true
- missingDataGapsExplicit: true
- tierNeighborContextPresent: true
- comparablePlayersPresent: true
- waitAndContingencyContextPresent: true
- noBannedLanguage: true
- inputOrderAndDataUnchanged: true
- noPersistenceOrMutation: true

## Example Details

- Delta LB (LB): rank=1, gaps=IDP roster confirmation, age, coaching environment, depth chart role, injury risk, projected snap share, role stability, roster positions, scoring settings, team defense environment, team offense environment, years experience, comparable=2
- Alpha WR (WR): rank=2, gaps=age, coaching environment, depth chart role, injury risk, projected snap share, role stability, roster positions, scoring settings, team defense environment, team offense environment, years experience, comparable=0
- Bravo QB (QB): rank=3, gaps=age, coaching environment, depth chart role, injury risk, projected snap share, role stability, roster positions, scoring settings, team defense environment, team offense environment, years experience, comparable=0
- Echo LB (LB): rank=4, gaps=IDP roster confirmation, age, coaching environment, depth chart role, injury risk, projected snap share, role stability, roster positions, scoring settings, team defense environment, team offense environment, years experience, comparable=2
- Charlie RB (RB): rank=5, gaps=projection, H10 context, age, coaching environment, depth chart role, injury risk, projected snap share, projection median, role stability, roster positions, scoring settings, team defense environment, team offense environment, years experience, comparable=0
- Foxtrot LB (LB): rank=6, gaps=IDP roster confirmation, age, coaching environment, depth chart role, injury risk, projected snap share, role stability, roster positions, scoring settings, team defense environment, team offense environment, years experience, comparable=2

## Safety

- mutatesDraftState: false
- mutatesProjectionData: false
- persistsUiState: false
- usesAi: false
