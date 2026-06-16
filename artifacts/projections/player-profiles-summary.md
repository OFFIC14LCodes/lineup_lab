# Historical Player Profiles

Generated: 2026-06-16T21:08:59.488Z

Dry-run only. No Supabase writes were performed.

Profiles built: 7511
Profiles with weekly stats: 1700
Profiles without weekly stats: 5811
Profiles with IDP stats: 1389
Profiles with warnings: 6248

## Scoring Profile
- Blackbird default dry-run profile scoring (v1)
- Dry-run default profile only; not a league-specific scoring profile.
- IDP support includes solo tackles and sacks so defensive profiles do not collapse to near-zero points.
- Replace with league scoring when profiles are wired into product surfaces.

## Profiles By Position
- DB: 1738
- WR: 1319
- LB: 1261
- DL: 1248
- RB: 812
- TE: 649
- QB: 346
- K: 138

## Profiles By Match Confidence
- exact_id: 4388
- strong: 2982
- weak: 100
- medium: 41

## Limitations
- Dry-run only. No Supabase writes are performed.
- Scoring uses a clearly labeled default profile, not league-specific settings.
- Position rank is calculated only within the built historical profile snapshot.
- Expected missed weeks use a simple 17-week estimate and do not yet account for byes, injuries, or playoff weeks.
- Profiles are not yet consumed by projections, Blackbird Rank, or War Room recommendations.
