# Builder B: statement-list fixes

Implemented BRIEF-B using invented catalogs and early histories only. L is a deterministic generator for
later use; it is not a reader format in this T5 run. No network, model calls, member data, production
database, production changes, commits, registration, gate look or real-pack fit occurred.

## What was built

- Franchise evidence uses movie collection membership and strictly earlier known full release dates.
  It distinguishes missing membership/date, tied dates, incomplete ordering, earliest observed entries,
  confirmed first entries and later entries. Unknowns are excluded from contrasts. The exact label is
  **a later movie in a franchise**. No title-number or keyword heuristic remains.
- The final statement fit uses all eligible early history. Trust instead refits the complete pipeline
  five times, withholding whole title/franchise groups, including usual rating, effect selection,
  shrinkage and centering. Bottom/middle/top bands are disjoint and title-key ties are deterministic.
  They report counts, means, ratings <=5 as numerator/denominator, one-decimal percentages and Wilson
  95% intervals. No safety conclusion is printed.
- Six kinds use all `in_pool & has_fingerprint` titles, the ordered 66 non-craft attributes,
  missing-as-pool-mean normalization, `KMeans(6, n_init=10, random_state=0)` and one numerical thread.
  Sixteen pool-tag TF-IDF/SVD axes use seed 20261013. Out-of-pool titles use these frozen transforms.
  Names come from centroid attributes/pool exemplars and signed pool-tag loadings, before ratings.
- Artifacts are canonical JSON under `<data-root>/work/statements/<sha256>/model.json`, never beside
  source. Directories are 700 and files 600. They freeze versions, recipe, ordered keys, catalog identity,
  means/SDs, centers, pool memberships, exemplars, names, vocabulary, IDF and SVD components. Loading
  requires the expected hash and rejects changed bytes, catalogs, recipes or library versions.
- Selection retains sequential residual stages and empirical shrinkage, 90% intervals excluding zero,
  >=0.15-point effects and >=8 observations on each side. Public quality requires 40 observed usable
  ratings; lean requires 80 with both audience and critic scores; kinds/facts/themes require 80 usable
  history ratings. At most four facts and two themes appear. Diagnostics include fingerprint losses and
  the 160+ usable-history stratum. Unsupported effects say “not enough evidence yet”.
- L text has a structured named-title registry, including early examples, generic pool exemplars, aliases
  and sources. There are no hard-coded example titles or old row-position cache dependencies.

## Files

All code paths below are relative to `docs/research/taste-loop/lab/`.

| File | Purpose |
|---|---|
| `t5/statements/data.py` | Small rating-free Catalog interface and Pack adapter; canonical identity |
| `t5/statements/franchise.py` | Conservative tri-state later-entry evidence |
| `t5/statements/artifact.py` | Pool-only kinds/text fit, transforms and private hash-checked artifacts |
| `t5/statements/feats.py` | Public-score, known/unknown fact and frozen theme features |
| `t5/statements/lib.py` | Sequential statement selection and prediction |
| `t5/statements/trust.py` | Five grouped folds, refits, bands and Wilson intervals |
| `t5/statements/render.py` | L text, registry and diagnostics |
| `t5/statements/__init__.py` | Public Catalog/render interface |
| `t5/statements/__main__.py` | Explicit `fit-kinds` CLI |
| `t5/statements/SOURCE.json` | Paths and SHA-256 hashes of the old Python sources adapted here |
| `tests/test_t5_statements.py` | Twenty synthetic tests |

This report is the only other file written by builder B. The old taste-prediction files were read,
never executed or changed. Builder A's files were left alone.

## Running later, when the frozen pack is reachable

From the repository root, in the specified Python environment:

```bash
T5_PY=/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python
PYTHONPATH=docs/research/taste-loop/lab "$T5_PY" -m t5.statements fit-kinds \
  --pack ~/goodwatch-research/taste/packs/2026-10-13 \
  --data-root ~/goodwatch-research/taste \
  --pack-sha256 ac1341f55c9b4d14e6514b91ee16dd9b5b2804ee86f1f821b3d40bc806b82bef
```

The CLI verifies `pack.pkl` against the explicit hash and both title files against the pack manifest,
then prints the artifact path/hash and reference count. It does not select a newer pack or pull anything.
Check the actual reference count is 60,759 at that later preflight. Library versions are captured in the
artifact; changes require a new reviewed fit/hash. Observe the plan's resource/time limits for that real fit;
this build measured only small synthetic pools.

The renderer takes an already eligible, cutoff/edited-filtered early history, supplied by the caller:

```python
from pack import Pack
from t5.statements import from_pack, render
from t5.statements.artifact import load

catalog = from_pack(Pack(explicit_pack_folder))
frozen = load(artifact_path, expected_artifact_sha256, catalog)
description = render(catalog, frozen, early_title_keys, early_scores)
# description.text, description.named_titles, description.named_title_keys
# description.profile, description.cross_fit, description.diagnostics
```

No split/member lookup is hidden in this interface. The caller must keep outer later labels out and
store any real descriptions, registries and cross-fit arrays privately under the data root, not the repo
or `/tmp`. The generator does not persist histories or rendered outputs. The synthetic CLI integration
test exercises this path using a made-up Pack, including changed-title-file refusal.

## Validation

The exact Done-when command passed: **20 passed in 4.90s** using the specified `t5venv/bin/python`.

The tests cover:

1. Numbered standalone, original, later entry, missing earlier entry, equal/unknown dates and incomplete order.
2. Fixed pool/66-key/6-kind/16-axis recipe, pool-only names/exemplars, missing-as-mean and out-of-pool transform.
3. Byte-identical artifact refit, private modes, changed hash refusal and repository-output refusal.
4. Catalog row permutation invariance and changed catalog refusal.
5. Deterministic five folds with whole franchises together.
6. A changed withheld rating/fold never changing its own predictions; explicit full-pipeline refit comparison.
7. Training-only median fallback and trust suppression.
8. An all-one-franchise history producing no self-trained prediction.
9. Disjoint bands, title-key tie breaks, small/flat suppression and **1/248 displayed as 0.4%** with Wilson bounds.
10. Evidence cutoffs, effect/interval/support limits, four-fact/two-theme limits and the 160+ diagnostic.
11. Public-quality cutoff counting observed scores only.
12. Unknown franchise rows excluded from contrast counts and contributing zero when predicting.
13. Withheld-fold isolation when the pipeline actually selects four facts and two themes.
14. The audience–critic cutoff and shrunk lean.
15. Early examples and generic pool exemplars both entering the title registry, aliases and deterministic text.
16. Sparse/empty-fingerprint output, missing-title refusal and duplicate-history refusal.
17. A title-only Pack interface that refuses any unexpected member-table access.
18. CLI help without pack access and absence of old fitted-cache imports.
19. End-to-end `fit-kinds`, load and render on a made-up Pack; changed input refusal.
20. Hashes identifying the old Python sources adapted here.

Ran existing `lab/tests/test_harness.py` once: **29 passed, 2 failed in 166.46s**. The failures are
`test_t2a_controls` and `test_t2b_controls`, both expecting 18 shuffled runs but receiving 21.
This is **not a library-version/environment failure**: `controls/shuffled.py` has six `RUNGS` plus
`CANDIDATES = ('g1_mix.py',)`, over three seeds, so 21 is the current implementation's count.
These pre-existing stale assertions were left unchanged as required. No existing harness code imports
the new statement package. `git diff --check` also passed.

## Choices, departures and limits

- Per BRIEF-B/REVIEW-fable, L/SL are not read in 015. No S adapter, reader broker, matching, protocol
  amendment, registration, results or production rollout is part of builder B. No independent protocol
  review or real-data claim is made here.
- PLAN 2 does not define the numeric meaning of “meaningful spread”. Here it means a prediction range
  of at least 0.15 points. A table is additionally suppressed if any occupied fold needs the median
  fallback, lacks training history, or no fold selects an effect. This conservative choice prevents
  fold-to-fold differences in intercepts/medians from becoming differentiated trust.
- The history-only median fallback applies below 40 training ratings; with zero training ratings a
  prediction remains unavailable and the table is suppressed. Five folds hash-sort title/franchise
  groups and deal them round-robin; group sizes may differ. Bands use sorted integer thirds, rather than
  overlapping quantile masks. None of these choices uses ratings to assign folds or title order.
- The real pack has no exhaustive franchise membership/order evidence. `complete_series` is an optional
  explicit catalog input for such evidence, exercised synthetically. Without it, an earliest observed
  entry stays unknown. No standalone is declared negative just because membership is missing. The
  franchise statement will be suppressed if known controls are insufficient, as PLAN 2 requires.
- Relative to the old code, public quality averages available audience/critic scores; missing public
  scores/facts remain unknown and per-feature fits omit them, rather than fabricating a critic score or
  converting missing flags to false. This supports the observed-data cutoffs and unknown-evidence rule.
  Every fit's centering is calculated on its training history alone.
- The new text recipe uses binary namespaced pool tags (including essence tags/words and catalog flags),
  pool document frequency >=3, smoothed IDF, L2 normalization, 16 randomized SVD components and pool
  standardization/clipping at 2.5. Exact vocabulary, parameters and transforms are frozen in the artifact.
  This specifies choices left open by PLAN 2; it does not reuse the old 96-axis cache or old index names.
  All-missing fingerprint columns use zero as their pool mean and constant columns use SD=1, both recorded.
- All API/CLI behavior was tested with synthetic data. The real pack, real reference-pool fit, actual
  feature coverage, statement prevalence and real-size memory/runtime remain untested because the brief
  explicitly excludes member data on this machine. No other departure from PLAN 2 is intended.
