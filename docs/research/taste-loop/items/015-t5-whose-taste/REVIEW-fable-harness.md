# Fable 5.1 review of the built harness (October 16, 2026)

**Review of 015 T5 harness (read-only; tests run: 40 passed; synthetic `all` run completes, verify matches)**

## 1. Would the S verdict be trustworthy?

Mostly yes, with one design hole that will probably stop the real run before any call.

- **Leakage:** none found. Payloads are description + three 15-row `{title, year, type, rating}` lists; case ids are payload digests; rows and labels are hash-shuffled; removal (named, aliases, `movie_series_id` siblings, to closure) is applied to all three lists; answer/member/keys stay in `frozen.json`, which the broker never sees. `prompt_sha256` and immutable bytes make replay honest.
- **Adapter fidelity:** faithful. Normalization matches `catalog-stats` (missing→0, population SD, fallback 1); `unseen=[]` only disables suggestions/edges/moreOfThis; `here` poster filter is production's; key order checked against pinned `fingerprint.ts`. `chosen`=rated only (production adds watched) is a documented adaptation. The headline sentence at `adapter.ts:49` is adapter wording, not UI copy; PREREG should say so.
- **Numbers-only control:** fair, neither too weak nor too strong: keeps share/mean/`here` scores and layout, strips every word and title. `closest_printed_mean` is a near-useless baseline (loved means ≈8 pick the highest list), harmless.
- **Scorer:** rule as briefed: per reader share ≥43⅓%, excess lo>0, S−numbers lo>0, none/permuted not positive, both readers, AND `ready`. Member is the unit (within-member mean over triples, member bootstrap, same draws). Pooled binomial correctly labelled descriptive. In the synthetic run the permuted control hit 44.4% with lo exactly 0; at n≈15–20 this check is fragile, which is acceptable but worth stating.
- **The hole: rematch keeps the anchor in the middle.** Initial matching minimises |Δearly mean| to the anchor, so the anchor's list mean is the median ~50% of the time; the middle-mean baseline will likely trip. The rematch (`cases.py:96-108`) uses an anchor-relative ±0.2 caliper and sum-of-distances-to-anchor cost, so the anchor stays the median ~50% and `freeze` stops. The only test (`test_t5_cases.py:129`) uses a 4/6/8 pack that stops; no test shows a cured leak.
- **Position baselines as stop triggers:** `cases.py:150` stops at a 40% point estimate for `position_A/B/C`. With ~60–80 triples each has ~13% chance to exceed 40% under the null, so roughly one run in three rematches and stops on label noise alone.
- **Operational:** `run.py:310` caps a reader job at 30 min for 12n calls (~250) and `broker.py:107` refuses existing folders, so a timeout forfeits the registration; `score.py:227` voids the whole suite on one unresolved transport/tool-use event in ~500 calls.

## 2. Builder B's fixes

Correct per PLAN §2. Franchise: tri-state from `movie_series_id` + strictly earlier known date, tied/incomplete/missing distinguished, label as specified, unknowns out of contrasts. Note: without `complete_series` the 0-class is empty, so the statement can never fire on the real pack; per spec, but say so. Trust: hashed franchise-grouped five folds, full refit per fold incl. centering, disjoint thirds by prediction then key, Wilson, ≤5, 30/10 minimums, stricter suppression than PLAN (any fallback fold). Kinds: `in_pool & has_fingerprint`, 66 keys (CRAFT list matches pinned TS), 255→NaN→pool mean, `KMeans(6,10,0)` under `threadpool_limits(1)`, SVD seed 20261013, hash-checked private artifact, names from centroids/exemplars.

## 3. Fixes

**P1**
- `cases.py:96-108`: make rematch symmetric: seeded target rank of the anchor's displayed mean (low/middle/high, balanced across a member's triples), or minimise triple range with the caliper on all pairs; add a test where anchor-centred matching leaks and rematch cures it.
- `cases.py:145-150`: assign answer labels balanced by construction (cycle A/B/C per member by seeded offset); report position baselines, stop only on middle/closest.
- `run.py:308-313` + `broker.py:107`: make `read_suite` resumable (skip folders with `record.json`) or set the cap from a measured per-call time within the wrapper ceiling.
- `score.py:227,238`: preregister a per-case void rule with a cap (e.g. ≤10% voided; voided member leaves primary) instead of whole-suite invalidation.

**P2**
- `broker.py:63-66`: Haiku tool-use check reads non-existent fields (`num_tool_uses`, `messages`); use `num_turns>1`, take model id from `modelUsage` keys; `test_t5_broker_score.py:66` asserts the invented field.
- `score.py`: no edited-label sensitivity or strata (early size, show share); `edited_labels` is recorded (`cases.py:120`) and unused.
- `cases.py:106`: count term still in matching cost; drop or document.
- `PREREG-draft.md`: state headline wording is the adapter's; state the franchise statement is inert without series completeness evidence.

## 4. Verdict

**Ready after P1 fixes.** The confinement, blinding, freezing and scoring are sound; the matching/baseline logic as built would most likely halt the registered run or stop it on noise.
