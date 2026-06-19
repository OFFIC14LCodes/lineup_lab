# Historical Mock Draft Engine

- Generated: 2026-06-19T15:34:23.146Z
- Projection season: 2025
- Recommendation: historical_mock_draft_engine_ready_for_season_scoring
- Draft order: third_round_reversal
- Dry run: true
- Read only: true

## Strategies

| Strategy | Picks | My roster | Starter coverage | Bench depth |
| --- | --- | --- | --- | --- |
| blackbird_rank_only | 180 | Lamar Jackson (QB), Justin Herbert (QB), Geno Smith (QB), De'Von Achane (RB), Tua Tagovailoa (QB), Rachaad White (RB), Ben Roethlisberger (QB), Deebo Samuel (WR), Christian McCaffrey (RB), Tyler Lockett (WR), Pat Freiermuth (TE), Wan'Dale Robinson (WR), Zach Ertz (TE), Demarcus Robinson (WR), J.K. Dobbins (RB) | Core starters covered. | 9 bench/depth picks. |
| blackbird_market_anchor | 180 | Lamar Jackson (QB), Justin Herbert (QB), Geno Smith (QB), De'Von Achane (RB), Tua Tagovailoa (QB), Rachaad White (RB), Ben Roethlisberger (QB), Deebo Samuel (WR), Christian McCaffrey (RB), Tyler Lockett (WR), Pat Freiermuth (TE), Wan'Dale Robinson (WR), Zach Ertz (TE), Demarcus Robinson (WR), J.K. Dobbins (RB) | Core starters covered. | 9 bench/depth picks. |
| blackbird_market_anchor_need_based | 180 | Lamar Jackson (QB), Tony Pollard (RB), Puka Nacua (WR), Travis Kelce (TE), Chuba Hubbard (RB), DJ Moore (WR), Tua Tagovailoa (QB), Christian McCaffrey (RB), Chris Godwin (WR), Pat Freiermuth (TE), Tyler Allgeier (RB), George Pickens (WR), Daniel Jones (QB), Latavius Murray (RB), Chris Olave (WR) | Core starters covered. | 9 bench/depth picks. |
| projection_only | 180 | Lamar Jackson (QB), Justin Herbert (QB), Geno Smith (QB), De'Von Achane (RB), Tua Tagovailoa (QB), Rachaad White (RB), Ben Roethlisberger (QB), Deebo Samuel (WR), Christian McCaffrey (RB), Tyler Lockett (WR), Pat Freiermuth (TE), Wan'Dale Robinson (WR), Zach Ertz (TE), Demarcus Robinson (WR), J.K. Dobbins (RB) | Core starters covered. | 9 bench/depth picks. |
| adp_only | 180 | A.J. Green (WR), Alfred Blue (RB), Andrew Luck (QB), Antoine Wesley (WR), Blake Corum (RB), Boston Scott (RB), Bucky Irving (RB), Cade Otton (TE), Chase Brown (RB), Chig Okonkwo (TE), Cooper Kupp (WR), Corey Davis (WR), Darius Slayton (WR), Darrel Williams (RB), Demarcus Robinson (WR) | Core starters covered. | 9 bench/depth picks. |
| market_rank | 180 | Lamar Jackson (QB), Justin Herbert (QB), Geno Smith (QB), De'Von Achane (RB), Tua Tagovailoa (QB), Rachaad White (RB), Ben Roethlisberger (QB), Deebo Samuel (WR), Christian McCaffrey (RB), Tyler Lockett (WR), Pat Freiermuth (TE), Wan'Dale Robinson (WR), Zach Ertz (TE), Demarcus Robinson (WR), J.K. Dobbins (RB) | Core starters covered. | 9 bench/depth picks. |
| need_based | 180 | Lamar Jackson (QB), Tony Pollard (RB), Puka Nacua (WR), Travis Kelce (TE), Chuba Hubbard (RB), DJ Moore (WR), Tua Tagovailoa (QB), Christian McCaffrey (RB), Chris Godwin (WR), Pat Freiermuth (TE), Tyler Allgeier (RB), George Pickens (WR), Daniel Jones (QB), Latavius Murray (RB), Chris Olave (WR) | Core starters covered. | 9 bench/depth picks. |
| random_within_adp_band | 180 | Aaron Rodgers (QB), Alex Collins (RB), Andrew Luck (QB), Anthony Richardson (QB), Blake Corum (RB), Brandon Aiyuk (WR), Cade Otton (TE), Brian Robinson (RB), Charlie Kolar (TE), Chase Brown (RB), Corey Davis (WR), Courtland Sutton (WR), Darrell Henderson (RB), Darnell Washington (TE), Deonte Thompson (WR) | Core starters covered. | 9 bench/depth picks. |

## Data Leakage Guard

- Actual season scoring loaded: false
- Future outcome fields used: false

- Allowed: preseason projection snapshot for the historical season
- Allowed: preseason ADP or market rank source if present
- Allowed: league roster and scoring settings
- Allowed: draft slot/order
- Allowed: player universe as of draft time
- Disallowed: actual weekly results from the historical season
- Disallowed: final season fantasy points
- Disallowed: injury outcomes not known before the draft
- Disallowed: future ADP/rank/projection snapshots

