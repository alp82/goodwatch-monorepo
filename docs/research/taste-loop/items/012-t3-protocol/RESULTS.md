# Item 012: revised T3 protocol and feasibility

October 14, 2026. `../../PROTOCOL.md` 4a, 4c and A3 address both reviews under BRIEF.md's final revision.
Owner checkpoint and final acceptance remain pending; this item authorizes no exposure.

**Pool/builder:** G1/B2 first ten, B5/public score first four, eight random: deduplicate, fill to 24,
shuffle/blind; maximum 36. Drop B3 slots. Judge the product suggestion including availability. Freeze
eligibility, inputs, full rankings and G1/B2 hashes in 4c. Own mix uses rated `in_pool && has_fingerprint`
titles independently of suggestions; exclude empty denominators before exposure. Specify actual per-card
first display, navigation, answer instructions, submission/14-day closure and recoverable storage, not a schema.

**Decision/labels:** paired unseen Want to See mean ≥+1 per ten, lower endpoint >0; harm upper <+1.
Can't tell is zero harm; No answer/Seen-unrated use the scorer's member answered-slot rate, pooled rate if none.
No G1/B2-union answer means non-response. Unknown worst-case bounds/complete-answer table are descriptive.
New-to-me, each mix and franchise are binding guards. Withdrawals delete answers; confirmation must survive
anonymous worst-case sensitivity. Hash mismatches block; ineligibility blocks above 5% of exposed union cards.
Pass supports expressed interest, not enjoyment after watching; fail/inconclusive keeps B2. No random-point veto.

**Selected interval:** `t_floor9` for primary/harm: `mean ± t(.975,n−1)*sqrt(max(s²,9)/n)`, clipped to [−10,10].
Guards retain 10,000 member-bootstrap draws, seed 20261014. Synthetic `simulation.py` / `simulation.json`
use 20,000 studies/cell at n=20/30/60, harm 0/+.5/+1, rare +10 harm, missing labels and primary nulls.
Worst false safety **1.485%** (Monte Carlo upper **1.662%**); primary false win at zero **1.500%** (upper
**1.678%**): all tested cells meet 2.5%, without a universal coverage claim.

| n | Harm block at 0, diffuse missing | Block at +.5 | Joint pass, +1 hits | Inconclusive, +1 | Joint pass, +1.5 hits |
|---|---:|---:|---:|---:|---:|
| 20 | 78.920% | 96.195% | 1.900% | 84.950% | 4.250% |
| 30 | 61.900% | 93.100% | 7.500% | 65.225% | 12.260% |
| 60 | 23.320% | 83.420% | 16.425% | 34.380% | 24.315% |

**Planning:** extra harm +.25, G1/B2 Seen .25/.05, novel .08/.12, two shared cards, Dirichlet concentration 9,
8.5% absent cards, 10% Seen-unrated, 2% union non-response, favourable mix/franchise proxies, no withdrawals.
T2a supports Seen's direction, not assumed rates. Joint power uses t guard proxies; overlap sensitivities are
in 4c. **Inconclusive exceeds passage at each central n.** Optimistic variance-9 individual 80% planning needs
73 respondents for +1 primary/zero harm, 128 for safety at +.25, 284 at +.5; +1.5 primary needs 34.
These are not joint-power promises. Minimum SDEs at 20/30/60: 1.968/1.580/1.100; print actual SDEs in verdicts.

**Feasibility/stop:** CENSUS's 96 ceiling gives 19–38 exposures at hypothetical 20–40% uptake. Updated
FEASIBILITY: 97 non-owner 20+ raters; only 7/17/29 active in 30/90/180 days (writes; visits unlogged).
Same uptake range: ceiling 19–39, active groups 1–3/3–7/6–12, before exclusions. Product-only recruitment
cannot be budgeted to reach 20; reaching inactive members needs an approved channel. All 97 reached needs
20.6% conversion for 20, 30.9% for 30, 61.9% for 60; no 75% assumption. Stop at exposure 60 or a fixed UTC
owner-checkpoint deadline, proposed eight weeks after first invitation. Require 20 exposed and 20 retained
respondents; one analysis after closure, no peeking/replacements. Owner records reachability, channel and dates.

Uncommitted documentation and synthetic artifacts only; no harness, production or gate access. Simulation:
one numerical thread, 768 MiB cap, 100.7 MiB peak RSS; source-hash and synthetic boundary/imputation checks pass.
