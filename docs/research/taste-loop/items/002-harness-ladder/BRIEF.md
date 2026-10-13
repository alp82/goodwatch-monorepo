# Item 002: harness, ladder and controls

You are the builder for item 002 of the GoodWatch taste research loop. Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths below
are relative to it unless absolute.

## The question

Build the benchmark every later experiment runs through: one predictor contract, task T1 (forward rating
prediction in entry order), the fixed ladder of scorers, and the controls that show the benchmark can be trusted.
No new model is invented in this item.

## Read first

- `docs/research/taste-loop/PLAN.md`: sections 2.2 (T1 only), 2.3, 2.4 and 2.5 are your specification; section 5
  lists the failures this harness must prevent.
- `docs/research/taste-loop/items/001-pack-census/REPORT.md`, `docs/research/taste-loop/MANIFEST.json`,
  `CENSUS.md` and `lab/pack.py`: the data file and its loader. The pack path is in the manifest.
- `docs/research/taste-prediction/lab/harness.py` (the first loop's harness, for what not to repeat) and
  `docs/research/taste-prediction/lab/agents/pooled/pool.py`, `preds.py` (rungs B4 and B5 are ported from these,
  logic unchanged).
- `goodwatch-webapp/app/server/taste/formula.server.ts` and `pool.server.ts`: today's taste, which rung B2
  reproduces exactly (`2P - N` on unit-length raw fingerprints, liked from 6, weights `score - 5` and `6 - score`,
  Want to See at 0.5, no taste below 5 liked titles).

## What to build, all under `docs/research/taste-loop/lab/`

1. **Views.** `views.py` builds, for a task and a member, a view file: everything a predictor may see, with the
   hidden labels physically absent (not masked by a flag). For T1: the member's ratings, Want to See, Skip and Not
   interested rows written before the block, with times; the title rows to predict (no rating, no write time, no
   position that reveals order beyond "after the history"); all other tier A members' rows; title data. The answer
   key is written to a separate file the predictor process cannot find from the view.
2. **Contract.** A predictor is one Python file with `predict(view) -> dict` returning `rank` (required), `score`
   (1 to 10 or None) and `p_low` (0 to 1 or None), one value per target. Anything else fails the run.
3. **Runner.** `run.sh <predictor.py> --task T1 --tier A --mode explore|registered --item NNN [--members ...]`:
   takes one of two lock slots (waits if both are taken), sets `OMP_NUM_THREADS=2` and the other thread variables,
   runs under `nice` and `timeout`, runs each predictor in its own Python process loaded by file path (two
   predictors with the same file name must not clash), records peak memory, and appends one line to
   `docs/research/taste-loop/ledger.jsonl`: run id, item, mode, git commit, predictor sha256, pack sha256, tier,
   task, every measure with its interval and smallest detectable effect, seconds. A `registered` run is refused
   unless `items/NNN-*/PREREG.md` is committed and lists the predictor's sha256. More than 20 exploratory or 3
   registered runs for one item are refused.
4. **T1.** Exactly as PLAN.md 2.2: entry-order blocks at 5, 10, 20, 40, 80, 160, 320, 640 ratings moved to the
   nearest sitting or bulk boundary; bulk writes are history, never targets; members with 6 or more ratings;
   strata reported apart (same sitting or later sitting, block, movies or shows, owner alone, provenance, titles
   with and without a fingerprint). Primary measure and guards as specified. The harness rounds and clips `score`;
   a scorer without `score` gets one from a monotone fit of rating on `rank` using the member's history only.
5. **Statistics.** `stats.py`: paired difference per member against a named reference rung; bootstrap over
   members (10,000 draws, seed in the ledger) for the mean, with the median member and the count improved; for
   the owner, bootstrap over sittings; the smallest detectable effect for each comparison (80% power, from the
   observed spread of per-member differences).
6. **Ladder.** `ladder/b0_median.py`, `b1_public.py`, `b2_taste_today.py`, `b3_taste_standardized.py`,
   `b4_consensus.py`, `b5_pooled.py`, plus `bp_votes.py` (rank only). B2 must match `formula.server.ts` on a
   hand-checked example in a test. B3 standardizes each attribute against the reference pool's mean and standard
   deviation before the same formula. B4 and B5 are ports of `pool.pooled_predict` with personal weights off and
   on, no trees, no text columns that the pack lacks.
7. **Gate and verify.** `gate.py <item>`: runs the item's registered comparison on tier B (reading the gate file
   named in the manifest), writes the numbers to `~/goodwatch-research/taste/gate/results/`, and prints only
   `replicated` or `not replicated` (same sign and at least half the tier A effect), with the count of looks used
   (8 per pack). `verify.py <run id>`: reruns a ledgered run in a fresh process and fails unless every measure
   matches.
8. **Table.** `table.py T1` rebuilds the ladder table from the ledger alone, as markdown: each rung against B0,
   and B3, B4, B5 against B2 and B1, with intervals and smallest detectable effects, owner and others apart.
9. **Controls**, as scripts under `lab/controls/` whose results go into the ledger:
   - shuffled labels: with each member's ratings permuted among their titles, no rung shows skill against B0;
   - planted effect: adding 0.15 points of real signal to a rung's score is detected;
   - leak canary: a predictor that tries every way it can to find the answers (reading other files, the answer
     key, the pack, the gate) gets nothing and is reported;
   - contract canary: a predictor that returns a bare array is rejected;
   - name clash: two predictors both named `best.py` in different folders give their own results.
10. **`PROTOCOL.md`** in `docs/research/taste-loop/`: the benchmark as implemented, in plain words, including
    every place where you had to decide something PLAN.md leaves open.

Run the full ladder on T1, tier A, in `explore` mode, and build the table.

## Forbidden

- Reading the gate file outside `gate.py`. Running `gate.py` at all: the orchestrator does that.
- Querying production. Everything comes from the pack.
- New models, feature searches or tuning on results. Port the ladder; do not improve it.
- Installing packages (numpy, scipy, sklearn only). Background jobs, sleep or polling loops. More than 2 threads
  or about 4 GB of memory per process; check `free -m` first.
- Committing. The orchestrator verifies and commits.

## Hand back

- Code under `lab/`, `PROTOCOL.md`, the ledger lines, the ladder table as `items/002-harness-ladder/ladder-T1.md`.
- Your final message is the report, at most 60 lines: what was built, the ladder table, each control's outcome,
  run time of the full ladder, every decision you made where the plan was silent, and what you could not do.

## Acceptance (the orchestrator runs these, not you)

- Each predictor runs in its own process from a view file that holds no hidden label.
- The T1 ladder table rebuilds from the ledger with intervals and smallest detectable effects.
- The five controls pass.
- `verify.py` reproduces a run exactly.
- The full ladder runs in under 10 minutes on 2 threads.

## Notes from item 001 (read `items/001-pack-census/REPORT.md` for the rest)

- Load data with `lab/pack.py` (`Pack()`), which reads `~/goodwatch-research/taste/packs/2026-10-13/`. The pack
  holds tier A ratings only; `pack.tier_b` lists the held-out members.
- The product's reference pool is `in_pool` and `has_fingerprint` together.
- Times are epoch milliseconds; a missing time is int64 min; a missing fingerprint score is 255; `sitting` and
  `position` count from 0. Bulk writes are flagged `in_bulk`.
- 92 touched titles are no longer in the catalog (`in_catalog = False`) and have no title data: T1 keeps them as
  targets with the declared fallback.
- Watch state and watch log still show which titles a tier B member rated. A predictor must not use other
  members' watch rows as a substitute for their ratings; views for T1 leave watch tables out.
