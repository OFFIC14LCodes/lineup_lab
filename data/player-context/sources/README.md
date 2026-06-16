# Player Context Source Files

These files are local/import-backed inputs for player situation, role, scouting, and environment context.

Do not fabricate depth chart role, floor/ceiling role, injury context, coaching tendencies, athletic testing, or physical measurements. Leave unknown values blank. Blank fields become data gaps, not low risk, zero role, or neutral evidence.

Every populated row should include `source`, `sourceLabel`, and `sourceConfidence`.

Recommended fill order:

1. `depth-chart.csv`
2. `role-notes.csv`
3. `injury-history.csv`
4. `physical-profile.csv`
5. `athletic-testing.csv`
6. `coaching-environment.csv`
7. `team-environment.csv`

Run:

```bash
npm run diagnose:h9-player-context-source-readiness
npm run build:h9-player-context
npm run diagnose:h9-player-context-build
```

Local normalized profiles are written to `data/player-context/normalized/player-context-profiles.json`.
