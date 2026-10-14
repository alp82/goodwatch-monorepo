# Item 011: phase 1 exit, DECISIONS repairs from the gate reviews

You are the editor for item 011 (run as Sol 6.1 through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## Why

PLAN.md phase 1 exit: every cell of `DECISIONS.md` holds a number with an interval or "not measurable yet, needs X".
Two gate reviews (`items/011-phase1-exit/GATE-REVIEW-fable.md`, `GATE-REVIEW-sol.md`) found cells and wording to
repair. Read both first.

## What to change, in `DECISIONS.md` only

1. Every number in the D1 table gets its 95% interval, copied from the tables it comes from (T1:
   `items/006-harness-fixes/ladder-T1.md` or the latest rebuilt T1 table; T2a: `items/010-t2a-gate/ladder-T2a.md`;
   T2b: the latest `ladder-T2b*.md`). Where a figure in DECISIONS is stale against the latest table (e.g. BP's
   first-50 gain, +0.369 against +0.425 in the item 006/010 table), use the latest table and say which table. Where
   no interval can exist, write why in the cell. Cite the source table per column below the table.
2. D2: add a row with the registered run's guards from its ledger line (`20261014T112515-d288d6bc-a54f`: pair
   accuracy, AUC of low ratings, and any other guard the run reports against B1), and write the calibration row as
   "not measurable yet, needs a predictor that gives `p_low` and tier C ratings". Replace "does not hold up" with
   "did not meet the replication threshold"; a failed replication does not show there is no benefit.
3. D1, item 009 and "Where D1 stands": say that tier B checked only separation and guard 1; the composition,
   franchise and first-50 figures are tier A. Replace "members the loop never looked at" with "held-out tier B
   members" (item 002 recorded one canary run outside the sandbox). Add one sentence that amendment A1 was decisive
   for registering G1: under the guard before A1, G1's disliked first-50 share (+0.029, +0.009 to +0.055) would have
   failed it, and F3's figures, which G1's match, were known when A1 was written.
4. Leave the orchestrator's own checks (a later paragraph the orchestrator writes) and every other file alone.

Verify every number you copy against its source table or the ledger. Do not round differently from the source.

## Forbidden

Changing any other file; runs of any kind; reading `~/goodwatch-research/taste/gate/`; production; committing.

## Hand back

At most 15 lines: what changed, and every cell you could not fill and why.
