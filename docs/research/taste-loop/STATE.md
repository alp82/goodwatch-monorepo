# State of the taste research loop

Read this first. Rewritten at the end of every session.

- **Phase:** 0, foundations. Session 1 started October 13, 2026.
- **Orchestrator:** Claude Opus 5.5.
- **Branch and worktree:** `research/taste-loop`, in `.claude/worktrees/taste-loop` of the main checkout.
- **Data:** `~/goodwatch-research/taste/` (mode 700). First loop's files in `packs/old/`. Pack: `packs/2026-10-13/`.
- **T0:** 2026-10-13T08:50:00Z.

## Owner decisions on record

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
- [ ] **002 Harness, ladder and controls** (`items/002-harness-ladder/`)
  - [ ] one process per predictor, view file without hidden labels
  - [ ] T1 ladder table rebuilds from the ledger, with intervals and smallest detectable effects
  - [ ] shuffled-label control: no skill; planted 0.15 effect: found; leak canary: gets nothing
  - [ ] same-named predictor files do not clash; `verify.py` reproduces a run
  - [ ] full ladder under 10 minutes on 2 threads
  - [ ] red team (Astra) and protocol reviews (Sol 6.1, Fable) filed, findings fixed or answered
- [ ] **003 Hidden-title test** (`items/003-hidden-title/`)
  - [ ] T2a for every rung plus vote count, owner and members apart, with intervals
  - [ ] first 20 titles per rung for the owner read by the orchestrator
  - [ ] result written into `DECISIONS.md` under D1
- [x] Issues filed: #525 exposure log; #526 one-tap reason on low ratings

## Next action

Item 002: builder running. Then red team (Astra) and protocol reviews (Sol 6.1, Fable), then item 003.

## What the owner owes

Nothing right now.

## What the census changed

- Not interested has 2 rows from 1 member: it cannot serve as a negative label. Skip (13,812 rows, 170 members) is
  the only stand-in negative.
- No import pairs with two ratings exist, and only one applied import: no free re-rating data.
- Only 1 member has a show status other than Seen: the watch-state branch stays parked.
- 31 members rated in two or more sittings; 200 in one.
