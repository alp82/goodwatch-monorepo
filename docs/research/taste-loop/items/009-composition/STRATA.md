# Item 009: stratum checks of G1 against B2 (orchestrator)

T2a, tier A, `others: all`; predictor outputs of run `20261014T152137-e864bd47-c7f9`, which has the registered run `20261014T150814-e864bd47-58d5`'s views, harness and measures (asserted). Separation per member: mean percentile of hidden titles rated 8 or more minus those rated 5 or less, each band with 5 or more titles inside the stratum; paired G1 minus B2 over the members that qualify under both, member bootstrap, 10,000 draws, seed 20261013. A stratum restricts the hidden titles; the candidates they are ranked among are unchanged. Exploratory checks (PLAN.md 4, the orchestrator's checks 4 and 5); nothing here is judged by the win rule.

**This would be wrong if** G1 separates loved from disliked titles only because loved titles are more popular: then the gain would vanish among hidden titles with few votes. Test: the two vote rows below.

| Stratum | G1 − B2 separation | Members | G1 better |
|---|---:|---:|---:|
| All (check: equals the registered run) | +0.086 (+0.049 to +0.121) | 26 | 21 of 26 |
| Owner in | +0.091 (+0.054 to +0.126) | 27 | 22 of 27 |
| Hidden movies only | +0.072 (+0.017 to +0.121) | 18 | 14 of 18 |
| Hidden shows only | +0.072 (+0.026 to +0.113) | 17 | 14 of 17 |
| Members with fewer hidden titles (under 78) | +0.079 (+0.018 to +0.135) | 13 | 10 of 13 |
| Members with more hidden titles (78 or more) | +0.093 (+0.048 to +0.130) | 13 | 11 of 13 |
| Members whose hidden titles come from one sitting | +0.081 (+0.039 to +0.121) | 22 | 17 of 22 |
| Members whose hidden titles come from two or more sittings | 4 members: too few |  |  |
| Hidden titles with votes under the median (629,698) | +0.125 (+0.085 to +0.166) | 13 | 13 of 13 |
| Hidden titles with votes at or over the median | +0.045 (-0.007 to +0.093) | 17 | 12 of 17 |

Reproduce from the worktree root: `python3 -B docs/research/taste-loop/items/009-composition/strata.py`.
