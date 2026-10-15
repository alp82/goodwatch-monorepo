# Item 015 build brief B: statement-list fixes

For the builder (Codex). Ticket [#656](https://github.com/alp82/goodwatch-monorepo/issues/656). October 16, 2026.

## Situation

- `PLAN.md` in this folder is the design. Read it whole, plus `../../PLAN.md` (T5, 2.3, 2.5) and the parts of
  `../../PROTOCOL.md` the lab code follows. `REVIEW-fable.md` in this folder lists the review findings; where it
  and `PLAN.md` disagree, `REVIEW-fable.md` and the scope section of this brief win.
- The frozen pack (`~/goodwatch-research/taste/`) is **not on this machine**. Do not try to pull, rebuild or fetch
  member data, and do not open any production database. Everything in this item runs on made-up data.
- The three known errors live only in the lab's statement-list builder
  (`docs/research/taste-prediction/lab/agents/profile/{lib,feats,render}.py`). Production
  (`goodwatch-webapp/app/server/taste-portrait/`) has none of them. Do not change production code.

## Scope

Two builders work at once. **You are builder B: the statement-list fixes.** Builder A builds the S harness in
`lab/t5/` (other files) and `lab/tests/test_t5_*.py`; you own only `lab/t5/statements/` and
`lab/tests/test_t5_statements.py`, plus `REPORT-statements.md` in this folder.

The ticket requires the three known errors of the statement list fixed before T5. The statement list (format L)
will not be read in this run (S is the sole primary, see REVIEW-fable.md), so this is a correct, tested,
deterministic L generator for later use, not a run. Copy the needed parts of
`docs/research/taste-prediction/lab/agents/profile/{lib,feats,render}.py` into `lab/t5/statements/` and fix them
there, reading data only through a small interface you can feed with a synthetic pack (the real one uses
`lab/pack.py:Pack`). Do exactly PLAN.md section 2:

1. Later franchise entry from `movie_series_id` and strictly earlier known release dates; no title-number regex,
   no keyword; unknown is unknown; label "a later movie in a franchise".
2. Trust table from five-fold out-of-fold predictions inside the early history (franchise kept together), with
   bands, counts, low = 5 or less, Wilson intervals, suppression rules; delete the "safe" sentence.
3. Six kinds from `KMeans(k=6, n_init=10, random_state=0)` on the reference pool (`in_pool & has_fingerprint`)
   over the 66 non-craft keys, frozen to a content-addressed artifact under the data root (never beside source);
   names from centroids and pool exemplars; 16 text axes from a rating-free TF-IDF/SVD on pool tags, seed
   20261013. A CLI `fit-kinds` builds the artifact from the real pack later; tests use a synthetic pool.
4. Keep the selection rules and evidence cutoffs of PLAN.md 2 (last paragraph). Render L text and its
   named-title registry.

Tests in `lab/tests/test_t5_statements.py` cover every synthetic fixture PLAN.md 2 names (standalone with a
number in its name, original, later entry, missing earlier entry, equal/unknown dates; out-of-fold leakage
check: a held-out rating never changes its own prediction; 1 in 248 does not print as zero; kinds artifact is
identical on a rerun and refuses a changed hash).

## Rules

- Work only under `docs/research/taste-loop/` in this worktree. Do not edit the old
  `docs/research/taste-prediction/` files; copy what you need into the new T5 code and fix it there.
- Do not commit. The orchestrator commits.
- No model calls, no network, no member data. The reader broker is built and tested with a fake reader.
- Python: `/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python`
  (NumPy, SciPy, scikit-learn, pytest). TypeScript: `bun` (see `lab/tests/formula_check.ts` for how the lab runs
  production TS against made-up input).
- Production TS source for the S adapter comes from `git show origin/main:<path>`; pin the commit SHA and the
  SHA-256 of each copied or imported file in a small manifest.
- Match the lab's style: short modules, docstrings that say what and why, plain names, no member ids anywhere.
- One existing lab test, `lab/tests/test_harness.py::test_t2a_controls`, fails on this machine (likely library
  versions). Leave it; say in your report whether it is environmental.

## Done when

- New tests pass: `t5venv/bin/python -m pytest -q docs/research/taste-loop/lab/tests/test_t5_statements.py`.
- `REPORT-statements.md` in this folder: what you built, file list, how to run it once the pack is reachable, the test list,
  anything you could not do, and every place you departed from `PLAN.md` and why.
