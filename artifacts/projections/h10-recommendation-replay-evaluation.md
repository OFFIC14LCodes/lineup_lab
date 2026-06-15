# H10.13 Recommendation Replay Evaluation

Generated: 2026-06-15T18:07:06.933Z
Verdict: quality_risks
True historical drafts available: false

## Methodology

Deterministic simulated replay over validation/live recommendation snapshots. Board depletion removes higher-ranked available rows before the next user pick and next two user picks, then evaluates whether timing, tier cliff, value, and caution signals remain supported.

## Aggregate

- Rooms evaluated: 11
- Replay states evaluated: 22
- Recommendations evaluated: 95
- Wait-on-need cases: 25
- Wait-on-need success rate: 92%
- Wait-plan cases: 44
- Wait-plan backed rate: 70.5%
- Unsupported waits: 0
- Unsupported waits converted: 31
- Wait-plan target survival rate: 71%
- Average wait-plan target count: 3.3
- Strong wait-plan targets: 90
- Waits without targets: 2
- Fill-now cases: 26
- Fill-now supported rate: 92.3%
- Tier-cliff cases: 30
- Tier-cliff supported rate: 100%
- Elite value cases: 20
- Low-confidence pushes: 0
- K/DST early pushes: 0
- IDP low-confidence overpushes: 0
- Instability churn findings: 0
- Safety findings: 0

## Assumptions

- True historical draft logs are not yet available in the H10 validation artifact, so this phase uses simulated depletion.
- Opponent picks are approximated by current recommendation/rank order, including the evaluated candidate when that row would be selected before the user's next pick.
- Comparable players are rows at the same normalized position with score within a tier/value tolerance.
- Next two user picks are modeled as twice picksUntilNextUserPick when known, otherwise a conservative default.

## Rooms

### validation_seed:BestBalls in Hand IDP Dynasty 

- Draft room: c82aef89-ce90-40f0-936f-545656045554
- Rows evaluated: 15
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: None
- Concerning examples: Myles Garrett DL rank 1 score 56 monitor; Aidan Hutchinson DL rank 2 score 41 monitor; Danielle Hunter DL rank 3 score 37.2 monitor; Chase Young DL rank 4 score 29.5 monitor; Brian Burns LB rank 5 score 29.3 monitor
- Need timing examples: None
- Tier cliff examples: None
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### validation_seed:🪓 Chopped

- Draft room: b386e78a-c7ff-4688-828e-6b48cbca863e
- Rows evaluated: 15
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Trey McBride TE rank 1 score 91 fill_now; Christian McCaffrey RB rank 2 score 86.7 fill_now; Puka Nacua WR rank 3 score 74 fill_now; Kyle Pitts TE rank 4 score 71.6 fill_now; James Cook RB rank 8 score 36.1 wait_one_turn
- Concerning examples: Josh Allen QB rank 5 score 54.5 fill_now; Ja'Marr Chase WR rank 6 score 51.6 fill_now; Jahmyr Gibbs RB rank 7 score 40.1 monitor
- Need timing examples: Trey McBride TE rank 1 score 91 fill_now; Christian McCaffrey RB rank 2 score 86.7 fill_now; Puka Nacua WR rank 3 score 74 fill_now; Kyle Pitts TE rank 4 score 71.6 fill_now; Josh Allen QB rank 5 score 54.5 fill_now
- Tier cliff examples: Trey McBride TE rank 1 score 91 fill_now; Christian McCaffrey RB rank 2 score 86.7 fill_now; Puka Nacua WR rank 3 score 74 fill_now; Kyle Pitts TE rank 4 score 71.6 fill_now; Josh Allen QB rank 5 score 54.5 fill_now
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### validation_seed:Legacy League

- Draft room: 2f62d6e3-d309-4d50-8e7e-2ef05a83771c
- Rows evaluated: 6
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Pittsburgh Steelers DEF rank 1 score 2 wait_multiple_turns; Baltimore Ravens DEF rank 2 score 0 wait_multiple_turns; New York Jets DEF rank 3 score 0 wait_multiple_turns; Cleveland Browns DEF rank 5 score 0 wait_multiple_turns; Dallas Cowboys DEF rank 6 score 0 wait_multiple_turns
- Concerning examples: Buffalo Bills DEF rank 4 score 0 wait_multiple_turns
- Need timing examples: None
- Tier cliff examples: None
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### validation_seed:Legacy League

- Draft room: 2a5c27ce-1a26-4473-95cc-9da9ed78520a
- Rows evaluated: 15
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Trey McBride TE rank 1 score 90.3 fill_now; Christian McCaffrey RB rank 2 score 88.8 fill_now; Puka Nacua WR rank 3 score 82.1 fill_now; Bijan Robinson RB rank 4 score 46.9 monitor; Jahmyr Gibbs RB rank 5 score 44.7 monitor
- Concerning examples: Matthew Stafford QB rank 13 score 29.7 monitor; Drake Maye QB rank 14 score 26.7 monitor
- Need timing examples: Trey McBride TE rank 1 score 90.3 fill_now; Christian McCaffrey RB rank 2 score 88.8 fill_now; Puka Nacua WR rank 3 score 82.1 fill_now; Jaxon Smith-Njigba WR rank 11 score 33.7 wait_one_turn
- Tier cliff examples: Trey McBride TE rank 1 score 90.3 fill_now; Christian McCaffrey RB rank 2 score 88.8 fill_now; Puka Nacua WR rank 3 score 82.1 fill_now; Ka'imi Fairbairn K rank 15 score 0 wait_multiple_turns
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### validation_seed:🪓 Chopped

- Draft room: f131b67c-c646-4e01-a925-c7d9f3eab4b0
- Rows evaluated: 15
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Trey McBride TE rank 1 score 89 fill_now; Christian McCaffrey RB rank 2 score 85.9 fill_now; Puka Nacua WR rank 3 score 73.3 fill_now; Kyle Pitts TE rank 4 score 56.1 fill_now; Josh Allen QB rank 5 score 53.9 fill_now
- Concerning examples: Ja'Marr Chase WR rank 6 score 52.1 fill_now; Amon-Ra St. Brown WR rank 15 score 23 wait_one_turn
- Need timing examples: Trey McBride TE rank 1 score 89 fill_now; Christian McCaffrey RB rank 2 score 85.9 fill_now; Puka Nacua WR rank 3 score 73.3 fill_now; Kyle Pitts TE rank 4 score 56.1 fill_now; Josh Allen QB rank 5 score 53.9 fill_now
- Tier cliff examples: Trey McBride TE rank 1 score 89 fill_now; Christian McCaffrey RB rank 2 score 85.9 fill_now; Puka Nacua WR rank 3 score 73.3 fill_now; Kyle Pitts TE rank 4 score 56.1 fill_now; Josh Allen QB rank 5 score 53.9 fill_now
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### live:BestBalls in Hand IDP Dynasty 

- Draft room: f85238ff-b2ee-4053-8493-e38c4cb63bd3
- Rows evaluated: 15
- Simulated picks until next: 4
- Simulated picks until next two: 8
- Strong examples: None
- Concerning examples: Jamel Dean DB rank 1 score 42 monitor; Kevin Byard DB rank 2 score 40.3 monitor; Derek Stingley DB rank 3 score 39.3 monitor; Marlon Humphrey DB rank 4 score 38.3 monitor; Jaylinn Hawkins DB rank 5 score 37.6 monitor
- Need timing examples: None
- Tier cliff examples: None
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### fixture:[Fixture] 1QB Offense

- Draft room: fixture-one-qb-offense
- Rows evaluated: 4
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Fixture RB RB rank 1 score 100 fill_now; Fixture WR WR rank 2 score 83.9 fill_now; Fixture TE TE rank 3 score 75 fill_now; Fixture QB QB rank 4 score 74.1 fill_now
- Concerning examples: None
- Need timing examples: Fixture RB RB rank 1 score 100 fill_now; Fixture WR WR rank 2 score 83.9 fill_now; Fixture TE TE rank 3 score 75 fill_now; Fixture QB QB rank 4 score 74.1 fill_now
- Tier cliff examples: Fixture RB RB rank 1 score 100 fill_now; Fixture WR WR rank 2 score 83.9 fill_now; Fixture TE TE rank 3 score 75 fill_now; Fixture QB QB rank 4 score 74.1 fill_now
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### fixture:[Fixture] Superflex QB

- Draft room: fixture-superflex-qb
- Rows evaluated: 3
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Fixture SF QB QB rank 1 score 100 fill_now; Fixture SF RB RB rank 2 score 94 fill_now
- Concerning examples: Fixture SF WR WR rank 3 score 44 monitor
- Need timing examples: Fixture SF QB QB rank 1 score 100 fill_now; Fixture SF RB RB rank 2 score 94 fill_now
- Tier cliff examples: Fixture SF QB QB rank 1 score 100 fill_now; Fixture SF RB RB rank 2 score 94 fill_now; Fixture SF WR WR rank 3 score 44 monitor
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### fixture:[Fixture] TE Premium

- Draft room: fixture-te-premium
- Rows evaluated: 2
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Fixture Premium TE TE rank 1 score 100 fill_now; Fixture WR WR rank 2 score 75 fill_now
- Concerning examples: None
- Need timing examples: Fixture Premium TE TE rank 1 score 100 fill_now; Fixture WR WR rank 2 score 75 fill_now
- Tier cliff examples: Fixture Premium TE TE rank 1 score 100 fill_now; Fixture WR WR rank 2 score 75 fill_now
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### fixture:[Fixture] Kicker DST

- Draft room: fixture-kicker-dst
- Rows evaluated: 2
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: None
- Concerning examples: Fixture K K rank 1 score 4 wait_multiple_turns; Fixture DST DEF rank 2 score 27 wait_multiple_turns
- Need timing examples: None
- Tier cliff examples: Fixture K K rank 1 score 4 wait_multiple_turns; Fixture DST DEF rank 2 score 27 wait_multiple_turns
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

### fixture:[Fixture] Mixed IDP

- Draft room: fixture-idp-mixed
- Rows evaluated: 3
- Simulated picks until next: 12
- Simulated picks until next two: 24
- Strong examples: Fixture DL DL rank 1 score 100 fill_now; Fixture LB LB rank 2 score 100 fill_now; Fixture DB DB rank 3 score 75 fill_now
- Concerning examples: None
- Need timing examples: Fixture DL DL rank 1 score 100 fill_now; Fixture LB LB rank 2 score 100 fill_now; Fixture DB DB rank 3 score 75 fill_now
- Tier cliff examples: Fixture DL DL rank 1 score 100 fill_now; Fixture LB LB rank 2 score 100 fill_now; Fixture DB DB rank 3 score 75 fill_now
- Special position caution findings: None
- Stability findings: None
- Safety findings: None

## Known Limitations

- This is not yet a true historical draft-outcome backtest.
- Simulated opponent selection uses deterministic depletion from available recommendation rows, not actual manager behavior.
- Outcome scoring evaluates projection/market/timing support, not end-of-season fantasy points.
- Rows absent from compact validation examples cannot be evaluated until richer replay snapshots are persisted as artifacts.
