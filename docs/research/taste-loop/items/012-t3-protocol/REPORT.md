# Item 012 drafter's report (Sol 6.1)

Saved by the orchestrator from the drafter's final message.

Updated [PROTOCOL.md](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/PROTOCOL.md:419) and wrote [RESULTS.md](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/012-t3-protocol/RESULTS.md).

- Pool: 24–40 titles; G1/B2 top ten, four each from B3/B5/public score, eight random.
- Primary: ≥1 extra unseen Want to See hit per ten, with the 95% interval above zero.
- Harm: upper 95% bound must stay below +1 per ten; unknown answers receive conservative bounds. Random harm is descriptive.
- Fixed sample: **60 exposures**, one analysis, no peeking. Planning assumes hit rates .30/.20, harm .25/.25 and doubled variance for clustering; both calculations require 59 members.
- G1/B2 hashes and the prospective absolute-distance mix guard are recorded.

Recruitment feasibility and assumed response rates remain unknown. Two-family review is pending; invitations await the owner checkpoint.

Only the two permitted documents changed. `git diff --check` passed; no experiments, gate reads, production actions or commits.
## Revision (Sol 6.1)

Completed [PROTOCOL.md](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/PROTOCOL.md) and [RESULTS.md](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/012-t3-protocol/RESULTS.md), retaining and correcting the partial simulation.

- Selected **t interval with variance floor 9**. Worst simulated false safety: **1.485%**; primary false win: **1.500%**. Monte Carlo upper limits also stay below 2.5%.
- Incorporated all nine revisions, including missing-label handling, novelty guard, withdrawal sensitivity, exposure/storage rules, and the 24–36-card pool.
- Joint passage approximation: **1.9% / 7.5% / 16.4%** at 20/30/60 exposures. Optimistic planning needs 128 respondents for safety at +0.25 harm.
- Feasibility uses **97 members, only 7/17 recently active**. Recruitment channel and exact eight-week deadline remain for the owner checkpoint.

Simulation used one thread and **100.7 MiB** peak RSS. Synthetic checks and `git diff --check` passed. All changes remain uncommitted; no harness, production, or gate access.