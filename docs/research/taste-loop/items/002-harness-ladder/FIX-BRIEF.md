# Item 002, fix pass: close the review findings

You are the builder for the fix pass on item 002 of the GoodWatch taste research loop. Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`).

## Read first

- `docs/research/taste-loop/items/002-harness-ladder/REVIEW-fable.md`, `REVIEW-sol.md`, `REVIEW-redteam-fable.md`:
  the three reviews. Their findings are your work list.
- `docs/research/taste-loop/PROTOCOL.md`, `PLAN.md` sections 2.2 to 2.5, and the code under `lab/`.
- `items/002-harness-ladder/REPORT.md`: what the first builder decided and left undone.

## Fixes, all required

**Process (red team 1 and 2, Sol 3).**
1. `control` mode: only predictors under `lab/ladder/` or `lab/controls/predictors/`, only the five control names.
   References in every mode: only files under `lab/ladder/`, at most the rungs of the ladder.
2. A new mode `ladder`: runs ladder files only, uses no item budget, is what `table.py` reads. Exploratory and
   registered budgets are for candidate predictors.
3. PREREG.md is parsed, not searched: exactly one `candidate: <sha256>`, one `reference: ladder/<file>`, one
   `others: all|before|no-owner`, one `task:`. A registered run must match all of them; `--members` is refused in
   registered mode; the candidate file must be committed with that hash; refuse when `git status --porcelain lab/`
   is not empty.
4. Ledger integrity: before any run, refuse unless the committed `ledger.jsonl` is a prefix of the working copy.
   Budgets count the union. An item number must match exactly one folder. `run.execute` cannot skip the ledger for
   real-pack runs outside `verify` and tests.
5. `gate.py`: replay the registered run's task, reference and `others` option exactly; require the same harness
   hash and pack; refuse registered lines it cannot replay; append the look to `looks.jsonl` before executing; for
   tier B never write per-member or per-measure results anywhere but the one summary line; print `replicated` only
   when the tier A effect is an improvement and tier B has the same sign and at least half the size.
6. `TASTE_RUN_SH` and `TASTE_LOCKS` cannot be set from outside to bypass slots and limits for real-pack runs.
7. Sandbox: `predict` is called from a frame that holds no harness state (no `state`, `notes`, view list, view id
   or file paths reachable through frames); cap a predictor file at 64 KB; verify cached reference answers against
   the predictor hash. PROTOCOL says the attempts report is advisory and the boundary is what counts.

**Measurement (Fable F1 to F3, Sol 1 and 2).**
8. Rank-only scorers and the calibrator. The contract gains one rule: a predictor that returns no `score` must
   return `rank` on a scale that means the same across views of one member. B2 and B3 return the product's own
   coordinate: the percentile of the title's cosine among the reference pool (`in_pool` and `has_fingerprint`),
   built from the view's history. BP returns the percentile of the vote count in the pool. The calibrator becomes a
   monotone fit under absolute loss with a minimum of 20 history ratings per step, falling back to B0 below 10
   ratings or when a calibration fold has no taste. Then measure the calibrator floor: the same answers with ranks
   permuted within each view must land within 0.01 of B0 for members other than the owner; report the floor in the
   table beside each calibrated rung. Add a control `rankscale`: B2 with a constant added per view must fail the
   contract check or change nothing; say which, and make it so.
9. The table reports, for every pair of rungs it compares, the paired difference in pair accuracy (the share of a
   member's target pairs with different ratings ordered correctly) beside the error difference, and marks error
   comparisons between a calibrated rung and a self-scoring rung as "not like for like".
10. Owner intervals: `stats` returns no interval and no smallest detectable effect when there are fewer than 10
    clusters or the largest cluster holds more than a quarter of the rows; the table prints "n/a" with the reason.
    The owner's numbers stay as plain figures. Build the franchise resampling check as a second, labelled figure.
11. `--others before`: B4 and B5 fall back to B1's behaviour when no other member has rated before the cutoff
    (today that is every owner block). Run B0, B1, B4, B5 with `--others before` and with `--others no-owner`, and
    add both as columns to the table.
12. History edited after the cutoff: a view omits a history rating whose `updated_at` is after the block's cutoff
    (its score at the time is unknown); targets whose label was edited later stay, flagged, and the table reports
    the primary measure with and without them.
13. `table.py` refuses to mix rows whose pack hash, harness hash or views digest differ from B0's.
14. `gate.py` and the bulk rule get one test each on a made-up pack that exercises the real code path (a bulk
    write after a block start; a gate replay with `others: before`).

**Documents.**
15. `PROTOCOL.md`: update every changed decision; add a section "What T1 measures" stating that 93% of other
    members' targets are typed in the same sitting as the history (median gap 6 seconds), that the later-sitting
    stratum (16 members, 276 targets) cannot be measured on this pack, that views show other members' data as of
    the pull unless `--others before` is used, and that title data is as of the pull. State that the harness hash,
    not the git commit, identifies the code.

Then rerun the whole ladder in `ladder` mode (all, before, no-owner), all controls, and rebuild
`items/002-harness-ladder/ladder-T1.md`.

## Forbidden

- Opening anything under `~/goodwatch-research/taste/gate/`; running `gate.py` on the real gate. Tests use a
  made-up pack and a made-up gate in a temporary folder, and never set `HOME` to the real home.
- Querying production. New models or tuning: the ladder's logic changes only where a fix above says so.
- Background jobs, sleep or polling loops; more than 2 threads or about 4 GB per process. The machine is heavily
  loaded: check `free -m` first, run serially.
- Committing. The orchestrator verifies and commits.

## Hand back

Your final message is the report, at most 60 lines: each numbered fix with done or not done and how it was checked;
the new ladder table (others and owner; error and pair accuracy; all, before, no-owner); the calibrator floor; each
control's outcome; anything you decided where this brief was silent.
