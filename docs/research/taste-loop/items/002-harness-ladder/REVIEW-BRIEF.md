# Review brief for item 002: is this benchmark sound before any experiment runs on it?

You review the benchmark of the GoodWatch taste research loop before any result on it is believed. You work alone;
two other reviewers from other model families do the same. The worktree is
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop`.

## Read

- `docs/research/taste-loop/PLAN.md` (the plan; sections 2 and 5 matter most) and `PROTOCOL.md` (the benchmark as
  implemented, with every decision the builder made where the plan was silent, marked "Decided here").
- `docs/research/taste-loop/items/001-pack-census/REPORT.md`, `CENSUS.md`, `MANIFEST.json`.
- `docs/research/taste-loop/items/002-harness-ladder/REPORT.md` and `ladder-T1.md`.
- The code: `docs/research/taste-loop/lab/` (`views.py`, `score.py`, `stats.py`, `run.py`, `sandbox.py`,
  `ladder/`, `controls/`, `gate.py`, `verify.py`, `table.py`), and `ledger.jsonl`.
- Background: `docs/research/taste-prediction/README.md` section 11 (why the first loop's benchmark was rejected).

## Data

The pack is at `~/goodwatch-research/taste/packs/2026-10-13/`, loaded with `lab/pack.py` (`Pack()`). It holds tier
A only. You have full read access to it and may run your own read-only analyses. Do not open anything under
`~/goodwatch-research/taste/gate/`, do not run `gate.py`, do not query production, and do not write into the
repository or the data folder. The machine is short on memory: one process, at most 2 threads, small analyses.

## Your role

- **Red team (Astra):** make the harness report a win that is not one. Find a way for a predictor to get at hidden
  labels (through the view files, other members' rows, title data, file names, ordering, sizes, timing, the
  calibrator, the answer key path); find a way to gain on the measures without knowing anything (shrinkage against
  the median baseline, ties, rounding, the calibrator, block boundaries, who counts as eligible); find a way around
  the run budget, the pre-registration check or the gate look budget. Try your attacks where you can; say which you
  ran and which you only reasoned about.
- **Protocol reviewer (Sol, Fable):** is T1 as implemented the task the plan means, and is it the right task? Check
  time order and block boundaries on real members, the handling of bulk writes and imports, what other members'
  rows a view contains and whether that matches the product, the baselines' strength (is B0 the right reference, is
  B1 fair, is B2 really today's taste), the calibrator that gives B2 and B3 a score, the statistics (paired
  differences, what is resampled, the smallest detectable effect, the owner's sittings bootstrap), the strata, and
  the tier split (stratification, what tier B members' traces remain in the pack). Run at least one analysis of
  your own on the pack and report it. Say what the ladder table does and does not allow one to conclude.

## Deliver

Your final message is the review, in markdown, at most 150 lines:

1. **Verdict:** sound as is / sound after the fixes below / not sound, in one sentence.
2. **Blocking findings**, most serious first. Each: what is wrong, how you know (verified by running what, or
   reasoned), what it changes, and the smallest fix.
3. **Non-blocking findings**, briefly.
4. **What you ran**, with the numbers.
5. **What the ladder table supports**, in three lines at most.
