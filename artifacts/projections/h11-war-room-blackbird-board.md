# H11.3 War Room Blackbird Board

Generated: 2026-06-15T19:57:19.608Z
Verdict: passed

## Ordering

available players -> H10 recommendation/value rank -> projection/value score -> market/ADP value -> ADP/market rank -> projected points -> position/name

## Coverage

- Rows audited: 5
- H10 rows: 3
- Projection rows: 3
- ADP rows: 3
- Market rows: 3
- Fallback ordered rows: 2

## Example Rows

- #1 Bravo QB: proj=332, adp=8, delta=7
- #2 Alpha WR: proj=261, adp=24, delta=22
- #3 Delta LB: proj=145, adp=180, delta=177
- #4 Charlie RB: proj=unavailable, adp=unavailable, delta=unavailable
- #5 Echo K: proj=unavailable, adp=unavailable, delta=unavailable

## Browser Smoke

- Draft room: c82aef89-ce90-40f0-936f-545656045554
- Visible: true
- Load more visible: false
- Loaded more: true
- Position filter works: true
- Mobile usable: true
- Banned language: none
- Mutation safety: {"draftStateUnchanged":true,"availablePlayerOrderUnchanged":true}
- Screenshots: C:\Projects\lineup_lab\artifacts\projections\h11-war-room-blackbird-board-screenshots\desktop-c82aef89-ce90-40f0-936f-545656045554.png, C:\Projects\lineup_lab\artifacts\projections\h11-war-room-blackbird-board-screenshots\mobile-c82aef89-ce90-40f0-936f-545656045554.png
- Error: none

## Remaining Risks

- Browser smoke uses local authenticated E2E bypass rather than a real OAuth session.
- The board is smoked against one representative room; pure sorting tests cover edge cases.
- Market rank falls back to ADP when exact compatible market rank is not available.
