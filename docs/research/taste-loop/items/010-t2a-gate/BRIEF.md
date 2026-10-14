# Item 010: the gate for T2a, and amendment A1 in the tables

You are the builder for item 010 (run as Sol 6.1 through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## Why

PLAN.md 2.3 says T2a uses the tier B gate like T1, but `lab/gate.py` replays T1 runs only. No T2a candidate may be
registered until it can be checked on tier B. Separately, `PROTOCOL.md` 13 (amendment A1) replaced one T2a guard;
the tables and the registered-run report must show the new guard.

## Read first

`PLAN.md` 2.3 and 2.5; `PROTOCOL.md` 4a, 11 (verify, gate, controls) and 13; `lab/gate.py`, `lab/run.py`,
`lab/views.py` (T1 and T2a builders), `lab/score.py`, `lab/table.py`, `lab/tests/` (the gate tests use a made-up
gate file); `items/009-composition/REVIEW-guard-fable.md`.

## What to build

1. **T2a in `gate.py`.** Replay a registered T2a run on tier B members the same way T1's replay works: same
   predictor and reference files (hash-checked frozen copies), same options, same harness hash. Tier B members'
   ratings come from the gate file and are hidden in folds exactly as for tier A; other members' rows are what the
   T1 gate gives a tier B view (say which in PROTOCOL.md). The effect compared is the primary measure, separation
   against the primary reference, for other members. `replicated` = same sign and at least half the tier A effect.
   Print only `replicated` / `not replicated` and the looks used; write numbers only under
   `~/goodwatch-research/taste/gate/results/`. A look is logged before the replay starts, as for T1. Refuse a T2a run
   that is not registered, uses `--members`, a shuffle or a plant, or whose files changed.
2. **Tests on the made-up gate file only:** a planted T2a effect replicates; a shuffled one does not; a changed
   predictor or a non-registered run is refused; nothing but the two words and the look count is printed. Never open
   the real gate file, not even to test.
3. **Amendment A1 in the output:** in `table.py T2a` and in the printed summary of a T2a run, the guard
   "disliked titles among equally popular candidates" (`pct_popular_low`, paired against the primary reference) is
   shown as a guard; the disliked first-50/200 shares and the median vote count are labelled descriptive; the
   per-member precision figure of A1 is reported. No other measure changes.
4. **`PROTOCOL.md`:** section 11 gains the T2a gate; section 12 drops it from "not built".

All tests must pass. Rebuild `table.py T2a` from the ledger without new runs and show that no figure changed, only
labels and the added columns. If a figure needs a new run, run it in `ladder` mode on tier A and say why.

## Running in this environment

Codex workspace-write sandbox, `~/goodwatch-research/taste/` writable. One run at a time; check `free -m` first.

## Forbidden

Opening, reading, copying or listing the contents of `~/goodwatch-research/taste/gate/` (the real gate file and its
results): only the orchestrator runs `run.sh --gate`. Running `gate.py` on real data. Querying production. Changing
rungs, candidates, or any measure other than those named. Installing packages. Committing.

## Hand back

Final message at most 40 lines: what changed in `gate.py` and why it cannot leak tier B numbers, the tests, whether
the T2a table figures stayed the same, the new harness hash, anything you could not do.
