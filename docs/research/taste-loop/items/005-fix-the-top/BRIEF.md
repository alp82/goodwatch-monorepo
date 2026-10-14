# Item 005: give the pooled predictor a usable top, and try it with standardized taste

You are the experimenter for item 005 (run as Sol 6.1 through `codex exec`) of the GoodWatch taste research loop. Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths below
are relative to `docs/research/taste-loop/` unless absolute.

## The question

On the hidden-title test (T2a), B5 (pooled predictor) separates loved from disliked titles best by a wide margin
(+0.133 over today's taste for other members, +0.231 for the owner), but its first 50 titles are little-known
stand-up specials and documentaries with almost no shows, and almost none of a member's loved titles land there.
B3 (today's formula on standardized fingerprints) has the best top of the list, which the owner found plausible,
but leans to popular titles and animation. Can a candidate keep B5's separation and get a top at least as good as
B3's?

The cause found in item 003: B5 standardizes its columns over every title a view names
(`ladder/b5_pooled.py`, last line of `features`). In T1 that is mostly rated titles; in T2a and T2b it is the whole
catalogue, so a linear model extrapolates to titles unlike anything rated.

## Read first

`PLAN.md` 2.2 to 2.5; `PROTOCOL.md` (sections on registered runs, PREREG format, budgets); `DECISIONS.md` D1;
`items/003-hidden-title/REPORT.md`; `items/004-want-to-see/REPORT.md` and its tables; `lab/ladder/b3_*.py`,
`b5_pooled.py`.

## The candidates, fixed now (do not add others)

Each is one file under `lab/candidates/005/`, a copy of a rung with only the stated change.

- **C1, B5 with columns standardized over rated titles.** Means used for missing values, and the mean and spread for
  standardizing, come from the rows any member rated in the view (the member's and others' ratings), not from all
  rows. Nothing else changes.
- **C2, C1 with columns held to the rated range.** As C1, then each column of every row is clipped to the 1st and
  99th percentile of that column over the rated rows.
- **C3, C1 and B3 averaged.** Each candidate's percentile within the view under C1 and under B3, averaged with
  equal weight; `rank` is the average, `score` is C1's.

## What to do

1. Write the three files. A test per candidate: in a T1 view (where rated rows dominate), C1's ranking agrees with
   B5's closely (state the rank correlation); C2 never yields a column value outside the rated range; C3's rank is
   the stated average.
2. Explore runs on tier A, all against B2 with B1 and B5 as further references: T1, T2a, T2b (both split rules).
   `lab/top.py` runs pinned rungs only, so the orchestrator lists the first 20 titles each candidate would show
   the owner; you report the first-50 guards from the runs. Do not change a candidate after seeing results. If
   one fails outright (errors, empty top), report it and stop that candidate.
3. Write `items/005-fix-the-top/PREREG.md` in the parsed format (`candidate:`, `reference:`, `others:`, `task:`;
   the harness reads one of each) registering **one** candidate on **T2a against B2**, with the win rule of PLAN.md
   2.5: separation (primary), and "rated 8 or more in the first 50" not worse than B2 with an interval that excludes
   zero. Choose it from the explore results by this rule, fixed now: the best T2a separation among candidates whose
   first-50 share (rated 8 or more, others) is not below B3's point estimate; if none qualifies, register nothing and
   say so. Explore runs: at most 14 of the item's 20.
4. Stop after writing PREREG.md. The orchestrator commits it, runs the registered runs and the gate looks.

## Running in this environment

- You run inside Codex's workspace-write sandbox: you may write in the worktree and in `~/goodwatch-research/taste/`
  (results, work files). Start each run with `lab/run.sh <file> --task T2a --tier A --mode explore --item 005` and
  the options PROTOCOL.md names; `run.sh --help` lists them. If the harness's own sandbox cannot start inside yours,
  stop and report the exact error; do not work around it.
- T2a runs of B5-like predictors take 6 to 8 minutes and are resumable: rerun the identical command if one is cut
  off. Run one at a time. The machine is shared: check `free -m` before each run and wait for a run to finish before
  the next.

## Forbidden

Reading the gate file or running `gate.py`. Querying production. Changing ladder rungs or the harness (report
harness bugs instead). Candidates other than C1 to C3. Installing packages. Sleep or polling loops. More than 2
threads or about 4 GB per process; check `free -m`; one run at a time if under 3 GB is available. Committing.

## Hand back

Candidate files and tests, the ledger lines, `PREREG.md` (or the reason there is none). Final message at most 60 lines: each candidate's T1, T2a,
T2b figures against B2 (and B5 for T2a), with intervals; their first-50 guards; which candidate you registered and why by the rule above.
