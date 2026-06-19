# Mock Draft Result Capture

- Generated: 2026-06-18T22:01:19.943Z
- Projection season: 2026
- Recommendation: mock_draft_roster_review_ready_for_human_review
- Dry run: true
- Read only: true

## My Team Review

- Overall grade: C
- Starter candidates: Sample QB Two (QB, LAC), Sample RB Three (RB, MIA), Sample WR One (WR, DAL), Sample TE Four (TE, MIN)
- Bench depth: none

## Grade Logic

- Roster structure starts at 100 and loses 15 points per obvious starter-position hole.
- Starter strength starts at 100 and loses 20 points per obvious starter-position hole.
- Depth starts at 70 and gains 5 points per bench candidate above core starters.
- Value uses top-5 recommendation match rate when recommendation snapshots exist; otherwise it defaults to a neutral 75.
- Risk starts at 90 and loses 5 points per risk tag.
- Overall is the simple average of structure, starter, depth, value, risk, and format-fit scores.

## All-Team Summary

| Team | Slot | Counts | Holes | Grade |
| --- | --- | --- | --- | --- |
| team-1 | 1 | {"QB":1,"RB":1,"WR":1,"TE":1} | RB, WR | C |
| team-2 | 2 | {"QB":1,"RB":1,"WR":1,"TE":1} | RB, WR | C |
| team-3 | 3 | {"QB":1,"RB":1,"WR":1,"TE":1} | RB, WR | C |
| team-4 | 4 | {"QB":1,"RB":1,"WR":1,"TE":1} | RB, WR | C |

