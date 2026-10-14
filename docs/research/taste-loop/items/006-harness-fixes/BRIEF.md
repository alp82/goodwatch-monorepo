# Item 006: harness fixes from Astra's review of item 004

You are the builder for item 006 (run as Sol 6.1 through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## Read first

`items/004-want-to-see/REVIEW-astra.md` (findings 1, 2 and 9), `PROTOCOL.md`, `lab/run.py`, `lab/sandbox.py`,
`lab/score.py`, `lab/table.py`, `lab/tests/`.

## What to fix (nothing else)

1. **Frozen predictor.** `run.py` hashes the predictor once and each batch then reopens the live file. Copy every
   predictor and reference file, once, at the start of a run, into the run's work folder; check the copy's sha256
   against the hash in the ledger line; run only the copy. Do the same for any file a resumed run takes over: a
   resumed run must refuse if the harness hash, predictor hash, pack, options or views digest differ from the stopped
   run's. A test: editing the source file after a run starts changes nothing in that run.
2. **Retained counts for "both".** In the T2a and T2b tables, next to every "both" figure, show how many titles and
   members it keeps, per band, and T2b's `both_under_min` counts. In the T2a table add one line comparing plain,
   popularity-only and "both" separation against B2 on the same retained titles.
3. **Fold table.** The fold check in `ladder-T2a.md` must compare small folds and main folds on the same members
   (as `items/004-want-to-see/REPORT.md` does), not 10 members against 26.
4. **Table wording.** `table.py` (around line 344) says matching removes popularity; it reduces it. Use the words of
   `DECISIONS.md` D1.

Then rebuild the three tables from the ledger without new runs where the fixes are display-only; where a fix needs
new numbers (fix 2's same-sample line), run what is needed in `ladder` mode. T1, T2a and T2b figures must not change;
say so or explain. All tests must pass; add tests for fixes 1 and 2. Update `PROTOCOL.md` where it describes these.

## Running in this environment

You run in Codex's workspace-write sandbox, with `~/goodwatch-research/taste/` writable. Check `free -m` before
each run; one run at a time; runs are resumable (rerun the identical command if cut off). If the harness's own
sandbox cannot start inside yours, stop and report the exact error.

## Forbidden

Reading the gate file; running `gate.py`. Querying production. Changing any rung or candidate. Installing packages.
More than 2 threads or about 4 GB per process. Committing.

## Hand back

Final message, at most 40 lines: each fix and its test, the new harness hash, whether every figure stayed the same,
the tables rebuilt (paths), anything you could not do.
