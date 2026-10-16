# State of the taste research loop

Read this first. Rewritten at the end of every session.

- **Phase:** 2, obtain new information. Phase 1 exit confirmed by the owner October 14, 2026. Session 1 started October 13, 2026.
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
- Phase 1 checkpoint (October 14, 2026): start T3 (judged pools) for D1 with G1 as the challenger: freeze the harm
  rule and pool design first, then build the page and recruit toward 20 members. Harm margin: G1 is blocked if the
  upper bound of its extra harm over today's taste reaches 1 per 10 in the first 10 ("Not for me" plus "seen it,
  rated 5 or less"). Invitations to other members still wait for the owner checkpoint "before anything reaches
  another member".
- T3 parked (October 14, 2026): with 7 of 97 eligible members active in 30 days, the revised T3 (item 012) would
  pass G1 with about 2–8% probability at a feasible size. The owner chose instead: build the exposure log (#525),
  put G1 behind a flag for the owner only first, then turn it on for everyone if the owner finds it better, with
  the log recording Want to See adds, skips and ratings from those lists; the flag goes off if they turn worse.
  Confirmation is weaker than PLAN.md 2.3 wanted; this is recorded as the owner's decision. T3 reopens when there
  are enough active members.
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
- [x] **005 Fix the top** (`items/005-fix-the-top/`), Sol 6.1: null, nothing registered; standardization was not the
  cause of B5's top
- [x] **006 Harness fixes from Astra's review** (frozen predictor copy, retained counts for "both", fold table), Sol
  6.1, accepted: 95 tests, figures unchanged
- [x] **007 B3 with a B5 floor** (Astra): nothing registered; F1 misses the franchise limit by 0.01, F3 the
  first-50 bar by 0.005. Owner's first 20 under F1 and F3 equal B3's.
- [x] **008 D2 forward comparison, registered:** tier A win (−0.088), tier B not replicated. Gate looks used: 1 of 8.
- [x] Issues filed: #525 exposure log; #526 one-tap reason on low ratings
- [x] **Amendment A1/A2** (`PROTOCOL.md` 13), after Fable's and Astra's reviews: the disliked first-50 share becomes
  descriptive, guard 1 is the popularity-matched disliked percentile, the T2a gate rule and G1's registration rule are
  frozen. Verdicts of items 003–007 were reached under the protocol before A1; none changes to a win.
- [x] **009 G1, the member's own mix at the front** (`items/009-composition/`, Sol 6.1): registered under A2 after
  Fable's review; tier A separation +0.086 (+0.049 to +0.121) over B2, all guards pass; **gate look 2 of 8:
  replicated**. G1 is D1's challenger for confirmation.
- [x] **010 Gate for T2a** (`items/010-t2a-gate/`, Sol 6.1), accepted October 14, 2026: 105 tests pass, T2a table
  figures unchanged; Fable's review (accept with fixes) applied by the orchestrator. Real gate not opened.

- [x] **011 Phase 1 exit** (`items/011-phase1-exit/`): gate reviews by Fable (met with fixes) and Sol 6.1 (not met
  yet; fixes listed); fixes done: every DECISIONS cell filled (Sol 6.1), the orchestrator's five checks of G1,
  `verify.py` on both registered runs, shuffled control on G1 (inconclusive, leaning against a win)

- [x] **015 Whose Taste is this (T5, ticket #656)** (`items/015-t5-whose-taste/`), October 16, 2026:
  **the registered screen does not pass**. Astra 75.0% (56.2–89.6), +39.6 over numbers-only; Haiku 46.5%
  (30.6–62.5), excess interval −2.8 to +29.2; both readers point the same way. 12 members, 47 triples, movie-only
  lists (A1, after a 43.4% media-type shortcut found before any call). Words gate stays closed.
  - [x] Fable reviews: plan, harness, pre-call amendment ("go"), result (verdict correct, no integrity problem)
  - [x] Three statement-list errors fixed in the lab (`lab/t5/statements/`); production never had them
  - [x] Incident: a first job ran the fake reader (never scored); fixed with tests, re-registered
  - [ ] Replicate on tier C (#674; after 300+ new ratings from 15 members and six weeks), with the gate rule decided first

## Next action

Phase 2, D1 route chosen by the owner (October 14, 2026):
1. [x] Exposure log (#525) and G1 behind `REC_G1_ORDER` merged to main (#574, #575, October 14, 2026); table
   `user_list_exposure` created in production; Windmill job deployed, variable `f/sync/g1_preview_members` = the
   owner only; the owner's G1 payload published (60,025 candidates, 283 other members, parity exact under the
   worker's NumPy 2.5.3). Rating-triggered rebuilds are off (Windmill is not reachable over HTTPS); snapshot and
   nightly rebuilds run.
2. [ ] Owner: in Coolify set `REC_PREVIEW_USERS` (owner id) and `REC_G1_ORDER=shadow`, redeploy.
3. [ ] After a day: the orchestrator reads `user_list_exposure` (today's against G1's first 100) and the overlap
   logs, then the owner switches to `REC_G1_ORDER=preview` and judges their own Best match and Watch next.
4. In parallel, without members: T5 for D3; D2 waits for tier C.

## What the owner owes

Now: a day of shadow (live since October 15, 2026, 03:15 UTC), then the owner sets `REC_G1_ORDER=preview` and tries G1 on their own lists. First shadow rows: no fallback; G1 would keep 4 of the first 30 Discover Best match titles and 8 of 20 Watch next titles. A 500 seen during the shadow redeploy did not recur and was not traced. October 15, 03:38 UTC: the owner switched to `preview` and judged G1 "so much better". Before `on` for everyone: the payload is 3.2 MB per member (about 550 MB for the 170 members with 5+ ratings), so it needs a compact form, the job must build for all members, and the second owner decision is still open. Nothing reaches another member before that. Earlier: Checkpoint done October 14, 2026: shown the T1 and T2a tables and the first-20 lists; the owner found B3's
list plausible.

## What the census changed

- Not interested has 2 rows from 1 member: it cannot serve as a negative label. Skip (13,812 rows, 170 members) is
  the only stand-in negative.
- No import pairs with two ratings exist, and only one applied import: no free re-rating data.
- Only 1 member has a show status other than Seen: the watch-state branch stays parked.
- 31 members rated in two or more sittings; 200 in one.

## 014 G1 rollout (October 15, 2026)

Plan, Fable review and adopted fixes in items/014-g1-rollout/. Built by Sol, Astra review (2 × P2) fixed and passed; merged as PR #632 (`a9aa22e8`). Waiting for the owner's word on the production steps: create `f/sync/g1_members` = [owner], deploy the scripts, owner redeploys the webapp, backfill the owner's `g1:v2`, add the 3-minute dirty schedule. Then the 5–10 member cohort (second owner decision), then `on`, then the rename.

October 15, 21:20 UTC: renamed to "personal order" (PR #648, `13038e85`; flag `REC_G1_ORDER` kept). Production: exposure columns renamed (64 rows), `f/sync/personal_order_members` = [owner], owner payload `personal-order:v1:<owner>` published (737 KB), schedule `f/sync/copy/personal_order_dirty` every 3 minutes (empty runs take 1 ms), old `g1_order`/`g1_trigger` archived. Merges to main deploy Windmill scripts automatically. Waiting: owner redeploys the webapp; old variable `f/sync/g1_preview_members` still to delete.

## Handover, October 16, 2026 (item 015 done on `alppc`)

- Map: [Map: personal order and Sides of you across GoodWatch](https://github.com/alp82/goodwatch-monorepo/issues/652) (#652), tickets #653–#662 and #526. "Personal order" is in CONTEXT.md (#663).
- The research data root was copied to `alppc` by the owner on October 16 (pack hashes and tiers verified against MANIFEST.json). Gate untouched by item 015.
- T5 tools: Python venv with NumPy, SciPy, scikit-learn, pytest; `bun`; run `python -m t5.run --output <run folder> build|read --reader haiku|astra|score|verify` from `lab/`. Live reads need a committed `PREREG.md` naming the frozen digests.
- Two existing lab tests (`test_t2a_controls`, `test_t2b_controls`) fail on stale counts (18 expected, 21 runs since `g1_mix` joined the shuffled control); not fixed.
- Open check from before: no `user_list_exposure` rows since the redeploy at about 21:20 UTC on October 15; not rechecked in this session.
