# Item 009: F3 with the member's own mix of shows and animation at the front

You are the experimenter for item 009 (run as Sol 6.1 through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## The question

F3 (item 007: B3's order, titles B5 places in its bottom half moved behind the rest, one title per movie series at
the front) separates loved from disliked titles better than today's taste by +0.086 (+0.049 to +0.121) and puts
8.5% of loved titles in its first 50, but its first 50 hold 36% animation against the members' own 13%. This is the
list-composition re-ranker of PLAN.md phase 2, in its smallest form.

## Read first

`PLAN.md` 2.2 to 2.5 and phase 2; `PROTOCOL.md`; `DECISIONS.md` D1; `items/007-b5-floor/BRIEF.md`, `RESULTS.md`,
`REPORT.md`; `lab/candidates/007/f3_franchise.py`.

## The candidate, fixed now (no others)

**G1**, one file `lab/candidates/009/g1_mix.py`: F3's order, then the first 100 positions are refilled greedily. At
each position take the highest title in F3's order (among those not yet placed) whose placement keeps the running
share of shows and the running share of animation (production method "Animation", as the guards use it) each within
10 percentage points of the member's own share among the titles they rated in the view, or, once 10 titles are
placed, closer to it than the alternative; if no title qualifies, take the next title in F3's order. Everything after
position 100 keeps F3's order. `score` is B5's. Write the rule exactly in the file's docstring.

## What to do

1. The file and a test: on a made-up view the first 100 respect the rule; positions after 100 equal F3's order.
2. Explore runs on tier A against B2, with B3 and the F3 file as further references (one `--ref` each; F3 is not a
   pinned rung, so if the harness refuses it as a reference, use B3 and B5 and report F3's figures from item 007's
   ledger lines): T2a, T2b sitting, T2b order. At most 6 runs.
3. Write `RESULTS.md` in the item folder: absolute figures, comparisons with intervals, every guard, run ids. Do not
   write a PREREG: the orchestrator decides registration after a review of the guard definitions.

## Running in this environment

Codex workspace-write sandbox, `~/goodwatch-research/taste/` writable. `lab/run.sh <file> --task T2a --tier A --mode
explore --item 009 --ref ...` (`run.sh --help`). T2a runs take about 8 minutes and are resumable. One run at a time;
check `free -m` before each and wait if under 1.5 GB is available. If the harness's own sandbox cannot start inside
yours, stop and report the error.

## Forbidden

Reading the gate file; running `gate.py`. Querying production. Changing rungs, the harness or earlier candidates.
Other candidates or thresholds. Installing packages. More than 2 threads or about 4 GB per process. Committing.

## Hand back

Final message at most 40 lines: G1's T2a separation and first-50 shares against B2, B3 and F3; its guards (shows,
animation, franchise, votes, disliked share); T2b; anything you could not do.
