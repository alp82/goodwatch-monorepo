# State of the taste research loop

Read this first. Rewritten at the end of every session.

- **Phase:** 0, foundations. Session 1 started October 13, 2026.
- **Orchestrator:** Claude Opus 5.5.
- **Branch and worktree:** `research/taste-loop`, in `.claude/worktrees/taste-loop` of the main checkout.
- **Data:** `~/goodwatch-research/taste/` (mode 700). First loop's files in `packs/old/`. Pack: `packs/2026-10-13/`.
- **T0:** 2026-10-13T08:50:00Z.

## Owner decisions on record

- The loop does not stop at item or phase boundaries: after an item is accepted, the next brief is written and its
  builder started in the same session. Pause only at the owner checkpoints in PLAN.md (October 14, 2026).
- Most building, experimenting and routine review goes to Astra (`gpt-6-astra`) and Sol 6.1 (`gpt-6.1-sol`) through
  `codex exec`; Opus and Fable only for the most critical tasks and reviews: phase-gate reviews, red teams, accepting a
  claimed win (October 14, 2026). Item 004 was already with an Opus builder.
- Reviewers and agents of any model family may read whatever they need (October 13, 2026).
- No re-rating and no labelling by the owner. The owner's ratings are tested one hidden title at a time (T2a).

## Items

- [x] **001 Durable pack and census** (`items/001-pack-census/`), accepted October 13, 2026
  - [x] pack under `~/goodwatch-research/taste/packs/2026-10-13/`, mode 700; gate file in `gate/2026-10-13/`
  - [x] `MANIFEST.json` and `CENSUS.md` committed, no member ids
  - [x] 9,017 ratings from 231 members, equal to `count(*)` at T0 (orchestrator's own query); 6,525 in tier A, 2,492 in the gate
  - [x] every rating has both dates and a provenance value
  - [x] no UUID-like string in any pack or gate file
  - [x] member files identical on a second run; title files differ in 2 of 72,101 titles because production
        rewrites title rows continuously. Accepted as is: title data is "as of the pull".
- [x] **002 Harness, ladder and controls** (`items/002-harness-ladder/`), accepted October 13, 2026
  - [x] one process per predictor, view file without hidden labels
  - [x] T1 ladder table rebuilds from the ledger, with intervals and smallest detectable effects
  - [x] shuffled-label control: no skill; planted 0.15 effect: found (−0.148); leak canary: gets nothing
  - [x] same-named predictor files do not clash; `verify.py` reproduced a run (786 values)
  - [x] full T1 ladder under 10 minutes on 2 threads
  - [x] red team (Fable, because Astra's provider blocked the run) and protocol reviews (Sol 6.1, Fable) filed; all
        15 findings fixed. A first builder ran the leak canary once outside the sandbox; counted as no gate look.
- [x] **003 Hidden-title test** (`items/003-hidden-title/`), accepted October 14, 2026
  - [x] T2a for every rung plus vote count, owner and members apart, with intervals (owner: franchises drawn again,
        because one sitting holds 34% of the owner's titles)
  - [x] T2a shuffled and leak controls pass; T1 ladder and its six controls rerun under the new harness, identical
  - [x] first 20 titles per rung for the owner read by the orchestrator
  - [x] result written into `DECISIONS.md` under D1
  - Folds: at most 20 hidden titles per view and at least 5 views per member (the brief said folds of 20).
- [x] **004 Want to See test (T2b) and popularity check** (`items/004-want-to-see/`), accepted October 14, 2026
  - [x] T2b with sitting and entry-order splits (4 and 10 members incl. owner); T2a "equally popular" columns
  - [x] Sol 6.1's four fixes to item 003 (side-list leak, shuffled tolerance, owner band minimum, fold check)
  - [x] tables rebuild; 81 tests; B3 T2a run verified (1,472 values)
- [ ] **005 Fix the top** (`items/005-fix-the-top/`): Sol 6.1 experimenter, candidates C1 to C3
- [x] Issues filed: #525 exposure log; #526 one-tap reason on low ratings

## Next action

Phase 0 exit is met. Owner checkpoint done. Phase 1 is running in session 1: item 004 T2b for every rung; fix B5's top (standardize as in T1) and check B3's popularity
tilt; register the leads and use gate looks only on registered comparisons; a gate review by two models other than
the orchestrator's.

## What the owner owes

Nothing. Checkpoint done October 14, 2026: shown the T1 and T2a tables and the first-20 lists; the owner found B3's
list plausible.

## What the census changed

- Not interested has 2 rows from 1 member: it cannot serve as a negative label. Skip (13,812 rows, 170 members) is
  the only stand-in negative.
- No import pairs with two ratings exist, and only one applied import: no free re-rating data.
- Only 1 member has a show status other than Seen: the watch-state branch stays parked.
- 31 members rated in two or more sittings; 200 in one.
