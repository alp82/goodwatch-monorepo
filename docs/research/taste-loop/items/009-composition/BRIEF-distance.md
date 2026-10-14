# Item 009 addendum: distance from the member's own mix, G1 against B2

You are the analyst for this addendum (run as Sol 6.1 through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## Why

Amendment A2 (`PROTOCOL.md` 13) registers G1 only if, among other conditions, none of shows, animation and franchise
is worse than B2 with an interval excluding zero. The guard (`PROTOCOL.md` 4a) is the share of shows and of animation
in the first 50, each minus the member's own share; the loop has read "worse" as further from the member's own mix in
either direction (`DECISIONS.md` D1: B5 failed for too few shows). The harness reports only the signed difference,
so the paired interval of the distance itself is missing.

## What to compute

For tier A members other than the owner, in item 009's T2a run `20261014T113107-e864bd47-b08d` (G1 against B2
`lab/ladder/b2_taste_today.py`, `others: all`):

- per member, `d = |top_shows − own_shows|` for G1 and for B2, exactly as `lab/score.py` computes `top_shows` and
  `own_shows` (first 50 non-hidden candidates per view, ties in view order, averaged over the member's views); the same
  for animation;
- the paired difference G1 minus B2 of the per-member mean distance, with the harness's own paired bootstrap
  (`lab/stats.py`, 10,000 draws, seed 20261013), member counts, and how many members are closer under each;
- as a check, the signed paired differences, which must equal RESULTS.md's `top_shows_vs_own` and
  `top_animation_vs_own` against B2 (+0.175071 and −0.014557) to six decimals.

Use the cached predictor outputs under `~/goodwatch-research/taste/work/cache/` if they match the run's views digest
and file hashes; otherwise rerun only B2 and G1 on tier A in a scratch script that imports the harness's functions.
Say which. Write a short script `items/009-composition/distance.py` and the results to
`items/009-composition/DISTANCE.md`: the two rows (shows, animation) with G1, B2, paired difference and interval,
n, closer counts, and the check. No per-member rows in committed files.

## Running in this environment

Codex workspace-write sandbox. One process at a time; check `free -m` first and wait while under 1.5 GB is available.
At most 2 threads.

## Forbidden

Changing anything under `lab/` or the ledger; registered or explore runs; reading `~/goodwatch-research/taste/gate/`;
querying production; other measures or candidates; installing packages; committing.

## Hand back

At most 15 lines: the two rows, the check, cache or rerun.
