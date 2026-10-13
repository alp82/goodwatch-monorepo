## 1. Verdict

**Sound after the fixes below:** T1 is a useful retrospective entry-order screen, but its chronology, calibration contract, and gate consistency need correction before experimental wins are believed.

## 2. Blocking findings

**1. “Forward” views contain information unavailable at the prediction cutoff.**

- **Wrong:** [views.py](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/lab/views.py) filters history by first write time while retaining subsequently revised scores. Default population data also includes later ratings, as the plan permits.
- **Evidence:** My pack audit found 35 distinct history rows revised after a cutoff. These affect 13 non-owner blocks containing 450 targets and three owner blocks containing 844 targets. Across non-owner views, 52.3% of population rating-row exposures are at or after the cutoff.
- **Consequence:** These are retrospective predictions using current data, not forecasts reproducible at the historical moment. The distinction particularly affects population-trained rungs.
- **Smallest fix:** Add an unedited-rating sensitivity analysis; historical views must omit scores revised after their cutoff unless the earlier value is recoverable. Require the planned `--others before` comparison before accepting finalists. B4/B5 also need an empty-population fallback: all eight owner cutoffs precede every other member’s first rating, and calling their population fit with no ratings raises `ZeroDivisionError`.

**2. The calibrator requires a rank scale that the predictor contract does not require.**

- **Wrong:** [score.py](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/lab/score.py) combines numerical ranks from five different fitted tastes, then applies that mapping to the full-history taste. The contract requires only correct within-view ordering.
- **Evidence:** I repeated B2 with `rank + number_of_visible_ratings`. Every view retains exactly the same ordering, but non-owner MAE changes **1.442 → 1.651**, and owner MAE **1.051 → 2.220**. Both outputs satisfy the contract.
- **Consequence:** T1 score comparisons can reward rank encoding rather than predictive information. B2/B3’s reported MAE measures their combination with this particular calibrator, not today’s product behavior.
- **Smallest fix:** Require rank-only scorers to expose a stable calibration coordinate across views, or calibrate a canonical coordinate such as percentile over a fixed reference pool. Also handle absent tastes explicitly: five non-owner blocks, covering 48 targets, have a usable main taste but at least one calibration fold without one.

**3. The gate does not necessarily replicate the registered comparison.**

- **Wrong:** [gate.py](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/lab/gate.py) takes the candidate and primary reference from the registered run but invokes `execute()` with default view options. It does not preserve `others='before'` or `others='no-owner'`, or require the registered harness and title version.
- **Evidence:** Static inspection; I did not execute the gate or access its folder.
- **Consequence:** “Replicated” can compare tier A and tier B effects from different information regimes. This does not invalidate the current default-option ladder, but blocks dependable confirmation of future experiments.
- **Smallest fix:** Preserve population-view options, reject unsupported member restrictions, and require matching harness/title hashes before a look.

**4. The implemented block rule needs an explicit amendment to the plan.**

- **Wrong:** The plan says cuts move to sitting or bulk boundaries. The implementation permits cuts anywhere adjacent ratings are at least two seconds apart. This is a substantive task decision, not a detail the plan left silent.
- **Evidence:** **266/272** non-owner block starts split a sitting. **3,919/4,195 targets (93.4%)** are in the same sitting as the last history rating. My counterfactual using sitting/bulk edges yields only **18 primary non-owner members**, versus 72 implemented.
- **Consequence:** The primary task predominantly predicts continued entry of previously watched titles. It is useful for learning from a member’s first sitting, but weak evidence about ratings of subsequently watched titles.
- **Smallest fix:** Explicitly adopt and name the implemented task in PLAN.md. Retain later-sitting results as a separate outcome; do not treat the pooled primary result as establishing later-watch prediction.

## 3. Non-blocking findings

- **B0 is the right fixed MAE reference:** the rounded history median is a strong constant baseline. B1 faithfully implements the declared public-score-plus-shrunk-offset baseline, using the same allowed data. My untuned median-residual alternative did not clearly improve it.
- **B2’s usable-fingerprint ordering matches today’s formula:** ratings, weights, Want to See deduplication, and the five-liked-title threshold agree with product source. Its calibrated rating and missing-fingerprint fallback are research additions.
- **Population views follow the documented tier-A-only design:** they exclude the predicted member and all tier B members. This is a reduced retrospective population, not literally every other production member. The owner-excluded population runs are valuable.
- **Bulk/import handling works on this pack:** all 469 imported tier A ratings are bulk; none become targets. All 5,194 targets are typed. Empty bulk/import target strata are structural exclusions, not evidence of performance on imports. Future non-bulk imports need an explicit targeting policy.
- **Population statistics are correctly paired:** differences are computed per member and members are resampled together. These intervals condition on the fitted predictions; they do not include model selection or refitting uncertainty.
- **Owner sitting resampling is implemented correctly, but “97 sittings” overstates independent breadth:** the largest supplies 391/999 targets; the count-based effective cluster number is about **5**. My movie-franchise sensitivity preserves the B3–B2 direction, but does not establish generalization to future owner behavior.
- **Smallest detectable effects are normal approximations:** `2.80 × SE` is reasonable planning shorthand, not a demonstrated 80% power guarantee. Detecting the planted effect once does not measure power. An effect below this threshold is not evidence of equivalence.
- **Strata change the population:** each includes members with one target, whereas the primary requires ten. Their results are descriptive and do not decompose the primary mean. Low-rating AUC covers only 22 primary members; reliability bins pool targets.
- **The split matches the declared rating-count stratification.** Tier B interaction traces remain openly available, while predictor views exclude them. The builder’s possible gate-file exposure prevents certifying that file as never accessed; it is not evidence that its scores influenced results.
- **Reporting needs future version protection:** `table.py` can combine different pack/harness cohorts under one heading. The current table has one consistent cohort. D2 remains incomplete because only B0 supplies `p_low`, and tier C has not run.

## 4. What I ran

All analyses were read-only, serial, with numerical libraries limited to two threads. I did not run the harness, controls, verification runner, gate, or production queries.

- Loaded the dated pack with `Pack()`; checked `pack.pkl` and `titles.pkl` hashes against its manifest.
- Rebuilt views in memory: **98 members, 280 main views, 955 calibration views, 5,194 targets**. The view digest matches every default ladder run; no main-history timestamp crossed its cutoff.
- Reconstructed B0–B3 predictions and paired statistics for **72 primary non-owner members / 4,058 targets**:

| Rung | Reproduced MAE | Difference to B0, 95% interval | Approximate detectable effect |
|---|---:|---:|---:|
| B0 | 1.468587 | Reference | — |
| B1 | 1.473176 | +0.004589 [−0.097110, +0.106749] | 0.145396 |
| B2 | 1.441881 | −0.026706 [−0.083930, +0.033397] | 0.084657 |
| B3 | 1.442462 | −0.026125 [−0.098490, +0.048391] | 0.104708 |

- Ran the chronology, block-boundary, import, and calibration analyses quantified above.
- Reproduced owner B0’s sitting interval: **1.075075 [0.850099, 1.180309]**.
- Recomputed owner B3 minus B2: sitting bootstrap **−0.120120 [−0.172868, −0.073879]**; movie-franchise/title bootstrap **[−0.163324, −0.077083]**. There are 413 targets in 236 movie series; 47 series cross sittings.
- Rebuilt the **142-line ladder table byte-for-byte** from the ledger. It contains 11 exploratory runs, no registered runs, and recorded passes for all five controls; I did not independently rerun those controls.

## 5. What the ladder table supports

It supports exploratory retrospective comparisons: B5 beats B0/B1 on reported MAE, while its additional gain over B4 remains uncertain.  
It does not establish recommendation quality, personal-taste superiority, calibrated risk, historical forecasting, or a product change.  
The exact numerical reproduction confirms reproducibility; the blocking fixes and subsequent confirmation determine validity.