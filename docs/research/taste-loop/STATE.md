# State of the taste research loop

Read this first. Rewritten at the end of every session.

- **Phase:** 0, foundations. Session 1 started October 13, 2026.
- **Orchestrator:** Claude Opus 5.5.
- **Branch and worktree:** `research/taste-loop`, in `.claude/worktrees/taste-loop` of the main checkout.
- **Data:** `~/goodwatch-research/taste/` (mode 700). First loop's files in `packs/old/`. New pack: not built yet.
- **T0:** not set yet (the time of the first new pull).

## Owner decisions on record

- Reviewers and agents of any model family may read whatever they need (October 13, 2026).
- No re-rating and no labelling by the owner. The owner's ratings are tested one hidden title at a time (T2a).

## Items

- [ ] **001 Durable pack and census** (`items/001-pack-census/`)
  - [ ] pack under `~/goodwatch-research/taste/packs/<date>/`, mode 700
  - [ ] `MANIFEST.json` and `CENSUS.md` committed
  - [ ] counts match `count(*)` at T0 (about 9,000 ratings)
  - [ ] every rating has both dates and a provenance value
  - [ ] no raw member id in the pack
  - [ ] second run with the same `--until` gives the same hashes
  - [ ] gate file outside the lab folder
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
- [ ] Issue drafts, not filed: exposure log; one-tap reason on low ratings

## Next action

Item 001: write the brief, launch the builder, run the acceptance checks.

## What the owner owes

Nothing right now.
