# Item 007: B3 chooses the top, B5 pushes likely dislikes down

You are the experimenter for item 007 (run as Astra, `gpt-6-astra`, through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## The question

B3 (today's formula on standardized fingerprints) chooses a plausible top: 9.0% of a member's loved titles land in
its first 50, against 1.9% for today's taste (B2). B5 (pooled predictor) is best at pushing down what a member
will dislike: titles rated 5 or less fall to percentile 0.41 against 0.56 for B2, but its top is stand-up specials
and documentaries. Item 005 showed that averaging the two (C3) loses some of B3's top and adds animation and
franchise repeats. Does keeping B3's order and using B5 only as a floor keep B3's top and gain B5's separation?

## Read first

`PLAN.md` 2.2 to 2.5; `PROTOCOL.md`; `DECISIONS.md` D1; `items/005-fix-the-top/BRIEF.md`, `REPORT.md`,
`RESULTS.md`, `NO-PREREG.md`; `lab/ladder/b3_taste_standardized.py`, `lab/ladder/b5_pooled.py`,
`lab/candidates/005/c3_average.py` (how one file runs two rungs).

## The candidates, fixed now (do not add others)

One file each under `lab/candidates/007/`. Each computes B3's rank and B5's rank exactly as the pinned rungs do
(copied code, no change), and B5's percentile within the view's targets.

- **F1, floor at the median.** Titles with B5 percentile at or above 0.5 come first, in B3's order; then the rest,
  in B3's order. `score` is B5's.
- **F2, floor at 0.8.** As F1 with the threshold at 0.8.
- **F3, F1 with one title per franchise at the front.** As F1; within the first group, the second and later titles
  of one movie series (`movie_series_id`, as the guards use it) move to the end of the first group, in B3's order.

## What to do

1. Write the three files and a test per file: the rank reproduces the rule on a small made-up view; F3 never puts two
   titles of one series ahead of a title of a series not yet seen within the first group.
2. Explore runs on tier A against B2, with B3 and B5 as further references: T2a, T2b (both split rules). T1 is not
   needed: `score` is B5's, so T1 equals B5's. At most 10 explore runs.
3. Registration rule, fixed now: among candidates whose T2a first-50 share of loved titles (others) is at least B3's
   point estimate (0.090) and whose "most titles from one franchise" is not above B3's (2.0), take the best T2a
   separation against B2. Write `items/007-b5-floor/PREREG.md` for it in the parsed format (one `candidate:`,
   `reference: ladder/b2_taste_today.py`, `others: all`, `task: T2a`) with the win rule of PLAN.md 2.5. If none
   qualifies, write `NO-PREREG.md` with the figures and register nothing.
4. Stop after that. The orchestrator commits, runs the registered run and the gate look, and lists the owner's
   first 20 titles per candidate.

## Running in this environment

You run in Codex's workspace-write sandbox, with `~/goodwatch-research/taste/` writable. Runs look like
`lab/run.sh <file> --task T2a --tier A --mode explore --item 007 --ref ...` (one `--ref` per reference; `run.sh --help`). A T2a run of a
B5-based file takes about 8 minutes and is resumable: rerun the identical command if cut off. One run at a time;
check `free -m` before each. If the harness's own sandbox cannot start inside yours, stop and report the error.

## Forbidden

Reading the gate file; running `gate.py`. Querying production. Changing rungs, the harness or earlier candidates.
Other candidates or thresholds. Installing packages. More than 2 threads or about 4 GB per process. Committing.

## Hand back

`RESULTS.md` in the item folder (absolute figures, comparisons against B2, B3 and B5 with intervals, every guard,
run ids), `PREREG.md` or `NO-PREREG.md`, the files and tests. Final message at most 50 lines: each candidate's T2a
separation and first-50 shares against B2, B3 and B5; its guards; T2b; which one you registered and why.
