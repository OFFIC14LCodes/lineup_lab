# H11.3 Draft Slot Strategy

Generated: 2026-06-15T19:57:59.990Z
Verdict: H11.3 DRAFT SLOT STRATEGY READY

## Slot Classifications Tested

- Slot 1 / 8 teams: early, turn=true, nearTurn=true, maxWait=14
- Slot 3 / 10 teams: early-middle, turn=false, nearTurn=false, maxWait=14
- Slot 6 / 12 teams: middle, turn=false, nearTurn=false, maxWait=12
- Slot 11 / 12 teams: late, turn=false, nearTurn=true, maxWait=20
- Slot 14 / 14 teams: late, turn=true, nearTurn=true, maxWait=26
- Slot 5 / unknown teams: unknown, turn=false, nearTurn=false, maxWait=unknown

## Sample Outputs

### 8-team early
- Band: early
- Max wait: 14
- Projected picks: 1, 16, 17, 32, 33, 48
- Summary: Early-slot strategy preview: prioritize an anchor start and account for a 14-pick wait back.
- Language failures: none

### 10-team early-middle
- Band: early-middle
- Max wait: 14
- Projected picks: 3, 18, 23, 38, 43, 58
- Summary: Early-middle slot strategy preview: blend anchor value with flexibility across a 14-pick max wait.
- Language failures: none

### 12-team middle
- Band: middle
- Max wait: 12
- Projected picks: 6, 19, 30, 43, 54, 67
- Summary: Middle-slot strategy preview: preserve flexibility and exploit falling value while monitoring tier risk.
- Language failures: none

### 12-team near-turn
- Band: late
- Max wait: 20
- Projected picks: 11, 14, 35, 38, 59, 62
- Summary: Near-turn strategy preview: keep contingency pairs ready because the return wait can reach 20 picks.
- Language failures: none

### 14-team late turn
- Band: late
- Max wait: 26
- Projected picks: 14, 15, 42, 43, 70, 71
- Summary: Turn-slot strategy preview: plan paired selections and avoid passing thin tiers through a 26-pick wait.
- Language failures: none

## Data Gaps

- team count unavailable

## Remaining Risks

- Pick windows are deterministic snake-draft approximations and do not model traded picks.
- Unknown team count and draft slot contexts return partial strategy with explicit data gaps.
