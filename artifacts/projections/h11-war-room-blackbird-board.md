# H11.3 War Room Blackbird Board

Generated: 2026-06-16T04:48:55.172Z
Verdict: passed

## Ordering

static Blackbird league rank; ADP external reference only

## Coverage

- Rows audited: 5
- H10 rows: 3
- Projection rows: 3
- Blackbird rank rows: 5
- Fallback ordered rows: 2

## Example Rows

- #1 Bravo QB: proj=330, blackbirdRank=1
- #2 Alpha WR: proj=260, blackbirdRank=2
- #3 Delta LB: proj=145, blackbirdRank=3
- #4 Charlie RB: proj=unavailable, blackbirdRank=4
- #5 Echo K: proj=unavailable, blackbirdRank=5

## Browser Smoke

- Draft room: c82aef89-ce90-40f0-936f-545656045554
- Visible: true
- Load more visible: true
- Loaded more: true
- Position filter works: true
- Mobile usable: true
- Banned language: none
- Mutation safety: {"draftStateUnchanged":true,"availablePlayerOrderUnchanged":true}
- Projection coverage: passed
- Projection coverage failures: none
- Board rows by position: {"WR":213,"RB":107,"QB":45,"TE":108,"LB":118,"DB":213,"DL":202,"K":16}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h11-war-room-blackbird-board-screenshots\desktop-c82aef89-ce90-40f0-936f-545656045554.png, C:\Projects\lineup_lab\artifacts\projections\h11-war-room-blackbird-board-screenshots\mobile-c82aef89-ce90-40f0-936f-545656045554.png
- Error: none

## Remaining Risks

- Browser smoke uses local authenticated E2E bypass rather than a real OAuth session.
- The board is smoked against one representative room; pure sorting tests cover edge cases.
- Blackbird rank is deterministic from the current draft room context and does not use ADP as the primary order.
