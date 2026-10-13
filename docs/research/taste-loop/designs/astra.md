# 1. Goal

Help members discover appealing, unfamiliar titles, check whether they can watch them, and choose something they enjoy. Make Taste recognizable and correctable. Improve score prediction where it helps those outcomes, especially for members with short histories. This loop is not a contest to minimize the owner’s rating error. It does not treat public approval as objective quality, Taste match as a predicted rating, or Not interested, Dropped and Skip as invented ratings.

The loop must settle three decisions:

| Decision | Evidence that settles it |
|---|---|
| **Does a challenger replace today’s ordering on Discover?** | More worthwhile suggestions in fully judged top-ten lists, followed by a controlled product test. Rating error cannot settle this. Test Best match first. Changing For you requires a separate comparison using the actual sort and blend. |
| **Does a pooled predictor earn a place as an internal score and risk service?** | Better prospective rating prediction than strong simple baselines, with calibrated probabilities, useful coverage and acceptable cost. This does not authorize displaying risk or changing Taste match. |
| **Should GoodWatch change Sides of you, or ask different onboarding questions?** | Members recognize and can correct their Taste; new questions improve suggestions at the same time cost. Description, list composition and elicitation each receive their own experiment. |

**Default priority:** discovery first, information collection second, score refinement third. Standardized fingerprints are the first challenger. Keep today’s experience until a challenger passes the relevant gate.

# 2. Benchmark setup

## 2.1 What is already established

I ran a small, read-only analysis of the temporary development pack through `harness.Data()`. I did not query production or inspect locked ratings.

| Check | Verified result |
|---|---:|
| Titles in the pack | 4,446 |
| Development ratings | 7,210 |
| Members | 231 |
| Median development history | 15 ratings |
| Members whose ratings occupy one UTC day | 201 |
| Ratings on each member’s busiest UTC day, summed | 6,339 of 7,210 |
| Members with a later rating day after at least five earlier ratings | 24 |
| Target ratings available under that day-block rule | 1,117 |
| Those target ratings belonging to the owner | 711 |
| Eligible non-owner members with at least 20 target ratings | 6 |

This is a feasibility check, not a model comparison. The pack is already missing the old locked quarter. Its timestamps are rating-write times, not watch times.

I also checked that:

- All three signal lists in the pack contain only member and title identifiers. Want to See dates were discarded.
- The ledger contains 50 scored runs. Nine exceed 300 seconds; the longest records 670.6 seconds.
- Today’s Taste implementation uses raw unit fingerprints, a five-liked-title gate, and a capped logarithmic display scale. Ordering uses the percentile or its ordering step, not the displayed percentage.
- `taste-portrait/person.server.ts` currently gives Skip a negative contribution. Preserve this in a faithful current-behavior control, but flag it as a conflict with the intended interpretation of Skip. Do not carry it into a new inference rule silently.

The implementation document contains older descriptions of the percentage scale and tracking rules. Freeze baselines from executable code plus `CONTEXT.md`, recording any disagreement. The inspected repository HEAD was `6abb55334d9504f92c20204365e3c9d6cc17a9dd`; record the actual commit and dirty-file hashes when the new session starts.

## 2.2 Four benchmark tasks

### A. Predict the next recorded rating

**Question:** Given information available before a member’s next rating session, how accurately can we predict the ratings they enter?

**Labels:** Directly entered ratings from 1 to 10. Imported ratings and edits are separate strata. A rating is not evidence that the title was watched that day.

**Members:** Primary analysis includes non-owner members with at least five visible ratings. Report history sizes of 5–19, 20–59 and 60 or more at prediction time. Report 0–4 separately as a cold-start diagnostic. The owner is a separate case study.

**Titles:** Every movie or show receiving an eligible rating, including titles without a fingerprint. Models must use a declared fallback for missing features. Also report results on the common fingerprint-covered subset. This prevents apparent gains from silently dropping difficult titles.

**Historical protocol:**

1. Group each member’s writes by UTC day.
2. Keep every identified import batch together, even if it crosses midnight. A block starts at its earliest write.
3. Predict every rating in a block using only information available before that block.
4. Apply the same global cutoff to other members’ ratings. Later ratings from another member are not available.
5. Exclude the target member from population fitting. Their visible history enters only the personal update.
6. Fit supervised preprocessing, shrinkage, calibration and any internal selection using the permitted training data.
7. Key every cache by snapshot, cutoff, excluded member, feature version and configuration.

Use the same rule for every candidate. A secondary sensitivity analysis groups non-import writes using a 30-minute inactivity gap. It cannot replace the day-block headline after results are known.

Historical title metadata and surviving interaction rows are current snapshots. Without archived versions, call this a **write-order diagnostic using current title features**, not a faithful historical replay. Whole-show season scores, later public scores and changed fingerprints can contain future information.

**Prospective protocol:**

- Freeze candidate code and population parameters before collection begins.
- Capture predictions from member state before the rating mutation. The predictor must never receive the submitted score.
- Update each member’s permitted history between completed blocks according to a frozen rule. Keep population parameters fixed for the confirmation window.
- Record the prediction, state version and feature snapshot used. Never reconstruct a missing prediction after seeing the label.
- Primary labels are first direct ratings of member-title pairs during the collection window. Keep edits, imports and recalled versus recently watched titles separate.
- Predictions remain hidden during collection.

**Primary metric:** Mean absolute error, averaged within each non-owner member and then equally across members.

**Guard metrics:**

- Error on ratings of 5 or less.
- Error by history size, movie/show and source.
- Prediction coverage and fallback frequency.
- Familiar versus previously unrated franchise.
- Median member improvement and fraction of members harmed.
- Compute time and memory.

Report ordinary rating-weighted error as a secondary descriptive result. Do not use the old “skill” numbers. If relative skill is useful, always calculate it against that member’s visible-history median on exactly the same target rows.

### B. Rank unfamiliar titles for discovery

This task has an inexpensive diagnostic and a member-judged benchmark. Only the latter can support a discovery decision.

**Historical diagnostic:**

- Compare held-out Want to See with Not interested.
- Compare Want to See with Skip separately.
- Require at least five usable observations of each action being contrasted.
- Mask the target action from the member’s inputs.
- Use only provably earlier signals where dates permit.
- Report member-averaged AUC, class counts and coverage.

These are action contrasts, not enjoyment labels. Current Not interested titles remain excluded from actual recommendation lists. A diagnostic may score them counterfactually, but must say so.

Measure recall of later Want to See additions only where the earlier candidate universe and state can be reconstructed. If they cannot, mark it unavailable. Do not calculate “precision” by treating every title without an action as a negative.

Existing ratings and interactions are selected observations. They do not identify the effect of showing a new title. [Schnabel et al., *Recommendations as Treatments*](https://proceedings.mlr.press/v48/schnabel16.html).

**Member-judged benchmark:**

Start with the owner and six non-owner volunteers as a development pilot. Aim for two volunteers in each history-size group. They are never confirmation participants for this experiment.

For each pilot participant:

1. Freeze their history, country, services and discovery context.
2. Produce each of the four frozen policies’ actual top ten.
3. Deduplicate their union and add four uniformly sampled eligible titles.
4. Judge every title in that union. There can be 44 titles; split them into two short visits.
5. Randomize card order. Hide policy identity, predicted rating and Taste match. Keep all other information identical.
6. Record familiarity before showing the full description.
7. Ask whether the title looks appealing, then offer an explicit Want to See response.

Do not claim to evaluate four top-ten lists from 24 judgments unless their union actually fits in 24.

After the pilot, freeze one challenger. Confirmation compares only that challenger with today’s ordering, so the fully judged union has at most 24 titles including four random controls.

**Confirmation members:** Target 30, minimum 20, all non-owner and excluded from the pilot. Seek roughly equal representation across 5–19, 20–59 and 60-or-more ratings. The main personalized comparison requires five liked titles, matching today’s gate. Members below that gate form a separately reported onboarding study.

**Eligible titles:**

- Start from the full Discover catalog, not the 4,446-title research pack.
- Follow the pinned Discover rules: presentable, fingerprint available, at least 1,000 votes, known release date and not adult.
- Apply the participant’s explicit filters.
- Exclude Seen or scored titles, shows beyond Not started, Not interested, Dropped and Skip.
- Exclude existing Want to See titles for this novel-discovery study. Wishlist ordering is a different task.
- Collapse only reliable duplicate listings. Sequels remain distinct titles.
- For the primary watchable comparison, require a matching offer on saved services in the participant’s country, checked less than 30 days ago.
- Treat missing or stale availability as unknown, never as available.

Record coverage losses at every step. If a participant has fewer than ten eligible titles, report a small-catalog case separately.

**Labels:**

- Familiarity: Seen; known but not Seen; unfamiliar.
- Appeal: yes; unsure; no.
- Want to See: an explicit response, separate from appeal.
- Availability: verified match; verified no match; unknown.

A worthwhile suggestion has appeal “yes,” familiarity “unfamiliar,” and a verified matching offer.

**Primary metric:** Number of worthwhile suggestions in each policy’s actual first ten, paired within member.

**Secondary metric:** Appealing unfamiliar titles per ten, irrespective of availability. This measures interest discovery and supports participants without saved services.

**Guard metrics:**

- Familiar or Seen titles in the list.
- Invalid exclusions or incorrect availability.
- Repetition within franchises and concentration by movie/show.
- Judgment completion and missing responses.
- Results by history-size group.
- List-level preference and perceived repetition, collected separately from item judgments.

Every top-ten item must have a judgment. Missing judgments are not automatic dislikes. Report completion and worst/best-case bounds; incomplete comparisons do not establish a win.

NDCG may describe ordering within the fully judged union. It is not catalog NDCG. Ranking against a few sampled “negative” titles can change model comparisons. [Krichene and Rendle, *On Sampled Metrics for Item Recommendation*](https://research.google/pubs/on-sampled-metrics-for-item-recommendation/).

### C. Calibrate the probability of a low rating

**Question:** Among titles members subsequently rate, does a predicted probability of rating 5 or less match observed frequencies?

Use precisely the eligible prediction-label pairs from task A. This probability is conditional on the process that led to a recorded rating. It is not a probability that an arbitrary unseen title will disappoint.

**Output:** `p_low = P(recorded rating <= 5)`.

**Primary metric:** Member-averaged Brier score, the squared difference between the probability and the binary outcome.

**Baselines:**

- Population low-rating frequency, with equal member weighting.
- The member’s low-rating frequency shrunk toward that population frequency using 20 prior observations.

**Guard metrics:**

- Mean predicted versus observed frequency.
- Reliability tables in fixed bins: `[0,.1)`, `[.1,.2)`, `[.2,.4)`, `[.4,1]`.
- Counts of outcomes and distinct members in every bin.
- Log loss with a declared numerical clipping constant.
- Precision and recall when flagging the highest-risk 10% of predictions.
- History-size and movie/show breakdowns.

Fit probability calibration from predictions produced without the calibration rows. Refit the entire upstream pipeline, not just its final layer. Use earlier blocks for later-block calibration; use a population fallback when personal evidence is insufficient.

Require at least 100 low-rating outcomes across 30 non-owner members before claiming broad calibration. Sparse bins remain unresolved. They do not become “accurate” because their uncertainty is wide.

Risk remains internal throughout this loop. Display requires a separate study of meaning, usefulness and the effect of showing it.

### D. Describe Taste and test its repeatability

This contains two studies with different outcomes.

**Taste description study:**

- Use members with at least 20 ratings for rich-description comparisons.
- Below 20, test only modest descriptions grounded in known examples.
- Compare current Sides with one challenger: Sides plus up to three corrected, supported statements.
- Do not test three new writing styles and select the most flattering one.
- Each statement carries a structured evidence record: supporting titles, an exception where available, sample size, selection rule and uncertainty.
- Remove title-number sequel heuristics. Collection membership alone also does not establish sequel order.
- Describe associations among rated titles. Do not label public-score agreement “quality.”

Show each member their description among two consented, anonymized descriptions matched on history size and broad interests. Randomize order and hide identity. Then ask which claims are accurate, partly accurate or wrong, and whether a claim helps them choose another title.

**Primary metric:** Fraction of displayed claims judged accurate or mostly accurate, averaged by member.

**Guards:** Unsupported examples, generic statements, recognition versus the one-in-three chance level, successful explanation in the member’s own words, and useful suggestions reached through a Side or statement.

Use separate material for the recognition and correction exercises. Do not publish another member’s identifiable viewing history.

**Repeatability study:**

- Recruit 20 non-owner members; keep the owner separate.
- Sample 12 titles per member: four from each rating band, redistributing when a band is absent.
- Record sampling probabilities.
- Collect fresh ratings at day 0, day 14 and day 28. Existing old ratings provide historical context, not a controlled first session.
- Hide old ratings, public scores and predictions.
- Record confidence, recent rewatch and whether the member remembers the title well.
- Preserve every observation without overwriting their standing product rating.
- Weight estimates back to the member’s actual rating-band distribution.

Report absolute changes, exact agreement, crossings of the five-or-less boundary and order stability. Separate rewatches and remembered opinion changes.

Do not call re-rating MAE the prediction floor. Under independent, equal-variance measurement noise, half the mean squared difference estimates single-observation noise variance. That assumption does not supply a universal conversion from re-rating MAE to achievable model MAE.

Hiding predictions is substantive: displayed predictions can influence ratings. [Cosley et al., *Is Seeing Believing?*](https://www.cs.cornell.edu/~danco/research/papers/conform-chi2003.pdf).

## 2.3 Frozen baselines and one output convention

Freeze these before comparing outcomes:

| ID | Definition |
|---|---|
| `median` | Visible-history median. Population median fallback without history. Rating control only. |
| `current` | Exact current Taste formula, gating, ordering and fallbacks from the pinned code. |
| `standardized` | Current Taste construction over standardized raw fingerprint attributes, then unit normalization per title. Same rating weights, Want to See weight and liked-title gate. Rebuild its reference quantiles. |
| `public` | GoodWatch score mapped to ratings through a population affine fit, followed by a personal residual offset shrunk with ten prior observations. No separately fitted small-history slope. |
| `pooled` | The frozen continuous predictor behind `lab/agents/pooled/best.py`, with its dependencies and feature artifacts rebuilt and hashed. No new score features or output shaping. |

For `public`, fit the population relation with equal total weight per training member. Constrain its slope to be nonnegative. Freeze numerical regularization in the manifest.

For `standardized`, calculate means and standard deviations from a versioned reference catalog with at least 1,000 votes and posters. Handle missing attributes explicitly. Do not confuse standardization of raw attributes with the production pool’s statistics over unit vectors.

Use two predeclared diagnostic ablations:

- Pooled predictor without the personal fingerprint residual.
- Pooled population fit excluding the owner.

They answer specific questions about personalization and owner influence. They are not additional finalists.

**Output schema:**

```json
{
  "request_id": "opaque identifier",
  "model_id": "immutable version",
  "snapshot_id": "immutable version",
  "state_hash": "pre-prediction member state",
  "title_key": ["movie", 123],
  "rating_estimate": 7.21,
  "ranking_value": 0.83,
  "p_low": 0.12,
  "taste_percentile": null,
  "fallback_reason": null
}
```

Rules:

- Rating estimates are continuous, clipped to `[1,10]`.
- No rounding, band weighting, stretching or hidden tie-breaking in rating metrics.
- Ranking uses the declared unrounded ranking value. Ties use a fixed title-key order.
- Native Taste values are mapped to ratings only through a training-only calibration adapter for task A. That adapter does not change their native ranking.
- A missing probability is `null`, not zero.
- Taste percentile is available only for a fingerprint-fit model.
- A pooled predicted rating never appears under the existing Taste match percentage.
- Rating and ranking results stay in separate tables.

## 2.4 Development, confirmation and new data

**Retire the locked quarter.** It is historical development evidence. Do not locate it or manufacture another random quarter of the same ratings and call it fresh.

Use three evidence levels:

1. **Historical development:** Existing ratings, the old ledger and reconstructed time diagnostics. All may be inspected.
2. **Pilot development:** Owner judgments and the six-member pilot. All may be inspected. Their labels never become confirmation evidence.
3. **Prospective confirmation:** Fresh member judgments or predictions collected after a candidate and analysis are frozen.

A final test cannot remain untouched after it has informed a decision. Replace the idea of an inexhaustible locked set with **single-use confirmation batches**.

For each batch:

- Register the challenger, comparator, eligible population, metrics, exclusions, sample target, closing date and decision rule.
- Hash the code, model parameters, feature files and analysis script.
- Collect labels under an owner-controlled evaluator account that experiment agents cannot read.
- Release only collection counts and data-quality failures while collecting. Do not release comparative performance.
- Run the registered analysis once at closure.
- Publish every registered outcome, including failures and inconclusive results.
- Mark the batch consumed.
- Make it development data for later work, never confirmation data again.

A directory hidden from an agent’s prompt is not an access boundary. If a separate evaluator account cannot be arranged, the owner operates confirmation scoring outside the builders’ environment. Until then, label the work development-only.

**Rating confirmation:** Close after 90 days. Target at least 500 eligible non-owner ratings from 30 members. If the target is not reached, report the available evidence as underpowered; do not change the closing rule after inspecting effects.

**Discovery confirmation:** Close at 30 completed non-owner participants or eight weeks, whichever comes first. Fewer than 20 completed participants cannot authorize replacement.

These are collection targets, not assertions of statistical power. Estimate the likely detectable effect from pilot member-level variation before committing to confirmation.

New direct ratings become member history under the frozen update rule after their block closes. They do not trigger population refits or human tuning inside a confirmation window. Imports become available at ingestion, regardless of their source rating dates. At the next research cycle, all consumed data may enter training.

## 2.5 Uncertainty, wins, nulls and stops

Calculate paired differences on exactly the same members and target observations.

- Population inference resamples members, carrying each member’s complete paired results together.
- Use 10,000 bootstrap samples with a registered seed.
- Report the mean difference, interval, median difference and member count.
- For the owner, resample rating blocks; add a franchise-cluster sensitivity analysis.
- Do not treat repeated fold seeds, multiple judgments from one person or reratings of one title as independent members.
- Report sensitivity to shared titles and franchises when those dominate the sample.

Use 95% intervals for development description. Allow at most two confirmation attempts for the same decision, each using a fresh batch and a 97.5% interval. This reserves error allowance for a possible second attempt. A failed first attempt does not authorize repeated testing until something passes.

Pre-register these practical effect sizes:

| Decision | Win | Guards |
|---|---|---|
| Discover challenger | At least **one additional worthwhile suggestion per ten**, with paired confirmation interval above zero | No invalid exclusions; availability verified; no established loss above one suggestion per ten in a history group |
| Internal rating predictor | At least **0.05 rating points lower member-averaged MAE** than both `median` and `public`, with paired intervals above zero | Upper bound on low-rating MAE harm below 0.10; adequate coverage; performance budget met |
| Internal risk estimator | At least **0.005 lower Brier score** than the shrunk-frequency baseline, with interval above zero | Mean calibration gap bounded within ±0.05; stated event/member counts; unresolved bins disclosed |
| Taste-description challenger | At least **80% mostly accurate claims** and a **10 percentage-point improvement** over current, with paired interval above zero | No known factual errors; recognition above chance; useful explanation and correction behavior |

For guards with too little evidence, say “unresolved.” Do not turn a nonsignificant harm estimate into proof of safety.

Classify outcomes consistently:

- **Win:** Passes the effect, uncertainty and guard requirements.
- **Practical null:** The interval’s upper limit rules out the registered useful gain.
- **Inconclusive:** The interval still includes both an unhelpful result and a useful gain.
- **Stop:** Invalid measurement, established harm, exhausted compute allowance, or two confirmation attempts without a win.

Stop a model branch after a practical null unless new information changes the question. More hyperparameters are not new information.

## 2.6 Durable data pull and provenance

Build a new pull. Do not modify `build_pack.py` into another script that silently creates a split.

The repository’s schema declarations provide the starting column map. The pull must verify actual schema, paginate deterministically, count rows, and record missing columns. Do not assume schema declarations prove populated historical coverage.

| Source | Required fields and purpose |
|---|---|
| `user_score` | `user_id`, `media_type`, `tmdb_id`, `score`, `created_at`, `updated_at`. Exclude free-text reviews initially. |
| `user_wishlist`, `user_skipped`, `user_not_interested`, `user_favorite` | Member/title keys and both timestamps. Preserve each action’s meaning. Favorites are not another rating. |
| `user_watch_state` | Keys, `state`, `state_changed_at`, `pass`, `created_at`, `updated_at`. Current state is not a complete transition history. |
| `user_watch_log` | Keys, `watch_id`, episode identifiers, `watched_at`, `watched_at_precision`, `origin`, `group_id`, `import_id`, `pass`, `created_at`, `updated_at`. |
| `user_import` | `id`, pseudonymous member, `source`, `status`, `created_at`, `confirmed_at`, `finished_at`. Do not export filenames or raw uploaded files. |
| `user_import_item` | `import_id`, `row_index`, title keys, `kind`, `raw_rating`, `imdb_score`, `date_rated`, `current_score`, `prior_score`, `applied_score`, `apply_state`, `applied_at`, source identity needed for deduplication. Parse only necessary fields from native-source payloads. |
| `user_setting` | Only country, streaming services and relevant recommendation settings, with timestamps. |
| `movie`, `show` | Full eligible catalog identity; fingerprint and key order; public scores and counts; poster/release/adult eligibility; genres, language, runtime, franchise identifiers; title-analysis and source-update times; frozen leader’s required text and facts. |
| Qdrant | Fingerprints and the frozen model’s required embeddings, with collection/vector names, extraction time, missingness and identifiers. Fetch expensive embeddings only where required, in batches. |
| `streaming_availability` | Title, country, service, offer type and usable freshness evidence. Join the appropriate source-check timestamp; extraction time alone is not an availability check. |
| `season`, `episode` and score-source tables | Preserve existing leader dependencies and audit show coverage. New season-derived features are not a first-cycle experiment. |

Person/credit, trope and other title tables are pulled only where required to reproduce a frozen dependency. Search history and free text are excluded from the first cycle.

**Provenance rules:**

- Store `observed_at`, `available_to_goodwatch_at` and source event date separately.
- An import’s source date describes an old observation. Its ingestion date determines when GoodWatch could use it.
- Keep the source scale and normalization rule.
- Deduplicate repeated imports of the same observation.
- Do not count an imported score and its resulting `user_score` row as two independent judgments.
- Import/current-score differences are candidates for audit, not automatic natural reratings. Require evidence that the observations were independently made.
- Mark ambiguous native/import provenance unknown.
- Missing watch dates stay missing, following ADR 0008.
- Deleted Wishlist actions and overwritten scores cannot be reconstructed from a current table. Record that limitation rather than inventing event history.

**Storage:**

```text
/home/alper/.local/share/goodwatch-research/taste-v2/
  snapshots/<timestamp>-<hash>/
  artifacts/<model-hash>/
  runs/<run-id>/
  studies/<study-id>/
```

Use JSONL, compressed JSONL and NumPy arrays so the pack needs no new Python dependencies. Store checksums, query text, schema, UTC extraction bounds, row counts, feature ordering, package versions and provenance coverage in a manifest. Never overwrite a snapshot.

Back up private artifacts to an owner-controlled encrypted destination. Verify that a fresh session can restore and load one snapshot.

Pseudonymize member identifiers with a keyed mapping. Keep the key and contact mapping separately. Restrict private files to their owner. Do not put raw data, per-member predictions, UUID prefixes or identifiable viewing histories in Git or agent chat. Repository reports contain aggregates; suppress small sensitive groups. Record a 90-day retention review for study data and propagate participant withdrawal to derived artifacts.

## 2.7 What offline data cannot settle

| Unknown | Smallest useful new measurement |
|---|---|
| Familiarity and appeal among recommendations | Owner pilot, then six development members, then the separate confirmation panel |
| Rating consistency | Twelve titles, three sessions, twenty non-owner members |
| Whether a suggestion led to watching | Seven- and 28-day follow-up on judged suggestions: watched, not watched, unavailable, or no response |
| Whether a new ordering improves the product journey | Controlled assignment to current versus challenger on one surface |
| Whether questions reveal useful preferences | Equal-time elicitation pilot with answerability, completion and later suggestion judgments |
| Whether Taste reads accurately | Blind recognition and claim correction |
| Whether show inactivity means dissatisfaction | Explicit continuation feedback; absence of a watch log is not dislike |

Instrumentation should ship through normal development.

The first instrumentation contract needs:

- Actual visible card exposure, not only server-returned results.
- Member/session/request identifiers, surface, position and timestamp.
- Candidate-set artifact reference and eligibility/context versions.
- Policy and feature versions.
- Assigned treatment and assignment probability.
- Country/services/availability state needed to interpret the result.
- Subsequent actions linked to exposure, with response windows.
- Pre-mutation rating predictions and whether any prediction was displayed.

For a small exploration lane, use one fixed visible slot and sample uniformly from ten declared eligible candidates. Log probability `0.1`, candidate membership and actual visibility. This supports comparisons within that slot and candidate support. It cannot evaluate arbitrary full-list policies.

Whole-list replacement needs whole-policy randomization. Neither exposure logging alone nor ignoring unclicked cards makes historical feedback unbiased.

# 3. The loop

## Phase 0 — Establish the measurement contract

**Branches:** Forward-time testing; stronger baselines; the measurement part of recommendation evaluation.

**Produces:**

- `PROTOCOL.md`, data schema and eligibility definitions.
- Frozen candidate manifest.
- A data/provenance feasibility report.
- Independent preflight review.
- A short list of defects that would invalidate a comparison.

**Exit test:** A reviewer from another model family can trace one prediction from permitted inputs to outcome, explain every exclusion, and identify what the result would authorize. No model competition starts before this passes.

## Phase 1 — Rebuild the evidence foundation

**Branches:** Forward-time testing; prospective prediction logging; import consistency audit; smaller-model controls.

**Produces:**

- Durable private snapshot and restore instructions.
- New evaluator alongside the old lab.
- Current-behavior parity fixtures.
- Median, public-score and standardized baselines.
- Reproducible frozen pooled candidate, or a precise dependency/performance failure.
- Offline timestamp and signal diagnostics.
- Reviewable instrumentation specification.

**Exit test:** Every candidate sees only permitted data; missing-feature fallbacks are counted; a clean process reproduces predictions; all scored work is in the ledger.

Do not wait for product instrumentation before designing the member studies.

## Phase 2 — Obtain new information

**Branches:** Recommendation panel; rerating consistency; informative questions; low-rating reasons.

Run the discovery pilot and start the rerating schedule immediately. Recruitment and elapsed time are the bottlenecks.

Add one optional question after a newly collected low rating: what most affected it? Offer a short reason list plus free text. Also collect a smaller positive contrast sample. Keep this exploratory. Two hundred reasons are a review milestone, not a magic threshold proving that a new feature will work.

For elicitation:

1. Reserve evaluation titles before selecting questions.
2. Start with five visible ratings.
3. Compare three additional randomly chosen known-title ratings against a fixed informative-question rule.
4. Keep “enjoyed more,” “would watch tonight,” ties and “haven’t seen” separate.
5. Count the two titles exposed by a pair and all screening effort.
6. Treat offline simulations as feasibility only.
7. Test the real flows with a three-minute budget, including recognition failures and skipped questions.

**Exit test:** The collection instruments work, questions are answerable, label meanings are clear, and missingness is reported. No onboarding efficacy claim comes from simulated answers alone.

## Phase 3 — Make one bounded product hypothesis

**Branches:** Standardized Taste; Sides for retrieval and list composition; corrected descriptions; tonight’s context.

Choose standardized Taste as the default discovery challenger. The pilot may instead nominate the frozen pooled policy if its measured utility is better and its cost is acceptable. Choose by the registered pilot rule: highest member-averaged worthwhile suggestions; differences below half a suggestion per ten favor the simpler policy.

Then freeze one challenger for confirmation.

Test Sides separately:

- **Retrieval:** Retrieve from up to four Sides, merge candidates and score with the same fixed ranker. Compare with one-vector retrieval.
- **Composition:** Hold retrieval and scoring fixed; allow at most two entries from a verified franchise, selecting replacements only from the ranker’s top 50.
- Test retrieval before composition. Do not combine both and attribute the gain to Sides.
- Do not force lists to match historical genre proportions. Those proportions are affected by what members previously encountered.
- Test the corrected description alongside current Sides, not as a replacement justified by rating MAE.

Tonight’s Mood and time budget are explicit session context. Keep Watch next evaluation within the member’s Wishlist and separate it from unfamiliar-title discovery.

**Exit test:** One change, one comparator, one primary outcome, one registered confirmation analysis.

## Phase 4 — Confirm and decide

**Branches:** Fresh recommendation judgments; prospective rating and risk evaluation; description confirmation.

Run the consumed-once confirmation process. An independent reviewer reruns the analysis from immutable prediction artifacts and private labels.

Possible decisions are:

- Keep current.
- Prepare a limited product experiment.
- Adopt an internal research component.
- Collect more specified information.
- Stop the branch.

A panel win authorizes a product experiment, not an automatic Discover replacement. A score win does not authorize a Taste match change.

**Exit test:** A decision record names the evidence, uncertainty, applicable population, limitations and next authorized action.

## Phase 5 — Product experiment and maintenance

Through normal development, implement only the winning hypothesis and its instrumentation.

For Discover:

- Randomize members between current and challenger.
- Keep presentation, candidate eligibility and fallback behavior fixed.
- Measure worthwhile-suggestion feedback and Want to See actions per discovery session.
- Follow actual watches and satisfaction separately.
- Cluster analysis by member.
- Preserve the documented server budgets: Discover under 250 ms p95 and Taste match for 100 titles under 50 ms.
- Keep database reads and model fitting off the card path.

Freeze the analysis window before launch. Extend only for a predeclared collection rule, never because the result is almost favorable.

### Branches deferred or dropped

| Branch from `next-branches.md` | Decision |
|---|---|
| Broad model and feature sweeps | Drop for this cycle. |
| Reusing the locked quarter | Drop permanently as confirmation evidence. |
| Choice model trained on Want to See versus Skip/Not interested | Do not train in this cycle. Those actions may support diagnostics, not silently become general taste labels. Obtain explicit judgments first. |
| Full smaller-pooled-model ladder | Defer. First compare the frozen model, a strong public baseline and the two named ablations. |
| External collaborative factors | Defer until a validated benchmark exposes a specific information gap. Verify current terms and coverage before any later download. |
| Fingerprint audit | Do a small factual audit now. Expand to 200 titles only if observed errors justify it. Repeated model agreement is not truth. Respect ADR 0001. |
| Show watch-state prediction | Audit coverage now; defer modeling. State transitions, continuation and low ratings are different outcomes. |
| Rating-order feature | Defer until session/provenance handling works. A write-order correlation may describe imports rather than preference change. |
| Editable written Taste | Collect corrections now. Defer using prose as a predictive representation. |
| Additional low-rating features | Defer until reasons or verified title evidence motivate a specific hypothesis. |

### First three work items for the new session

**1. Measurement contract and preflight review — about two hours.**

Read the verdict, reviews, glossary and relevant code. Write the task contracts, candidate manifest, split rules and decision thresholds. Produce a synthetic example containing an import, an edit, a later rating from another member and stale availability.

**Acceptance:** A different-family reviewer confirms that none leaks into an earlier prediction. Domain meanings and confirmation access are explicit.

**2. Snapshot and provenance audit — two to three hours.**

Preserve the existing development pack in durable private storage. Implement the schema-mapped read-only pull and manifest. Under the kickoff authorization, run it only after preflight passes. Count timestamps, imports, watch coverage, missing features and candidate eligibility.

**Acceptance:** Checksums verify after reload; no private rows enter Git; imports are identified where possible; unknown provenance stays unknown; a new session can load the snapshot by manifest.

**3. Minimal evaluator and collection kit — two to three hours.**

Implement day-block evaluation for `median`, `public`, `current` and `standardized`. Add paired summaries and leakage fixtures. Generate the owner pilot’s fully judged title union and a twelve-title rerating form.

**Acceptance:** Changing hidden target labels cannot change predictions; later other-member labels are unavailable; runs are ledgered before execution; policy top tens are completely represented in the judgment union; no new model sweep runs.

These items leave useful, reviewable work even if recruitment or instrumentation takes weeks.

# 4. Orchestration

## 4.1 Models and effort

Use **Claude Opus 5.5 at high effort** as orchestrator, in short, checkpointed sessions.

This is an operational recommendation, not a claim from a model benchmark. Claude Code supplies the native agent and Workflow controls described in the brief. The orchestrator’s hard work is maintaining experimental validity, resolving conflicting evidence and making stopping decisions. Low effort is a poor allocation for that role.

Do not pay for an uninterrupted million-token session. Restart from written state at phase boundaries and after roughly 90 minutes of active coordination.

| Role | Model and effort | Responsibility |
|---|---|---|
| Orchestrator | Opus 5.5, high | Protocol, scope, resource ownership and decisions |
| Builder | Sonnet 5.5, high | Snapshot adapter, evaluator, fixtures and deterministic tooling |
| Experiment auditor | GPT-6.1 Sol, high | Read code and data artifacts; independently run bounded analyses through the controlled runner |
| Methodology reviewer | GPT-6 Astra, high | Before scoring: estimand, leakage, units of analysis, stopping rules and inference |
| Red team | Fable 5.1, high | Construct counterexamples: imports, unseen franchises, missing availability, selected show ratings, misleading descriptions |
| Writer | Sonnet 5.5, medium | Turn verified artifacts into the handoff and decision record |
| Mechanical checks | Haiku 5.5, low, optional | Schema completeness and missing-file checks only |

A GPT-family reviewer must review a Claude-built protocol before labels are scored. A builder must not be the sole judge of their own measurement.

Use deterministic scripts for fan-out, prediction and aggregation. Models choose and inspect experiments; they should not manually schedule a grid.

Why the alternatives lose:

- Opus at low effort repeats the old weak point: capable execution without enough scrutiny of the question.
- Sonnet or Haiku as sole scientific arbiter saves money in the place where one mistake invalidates all later spending.
- Astra as orchestrator is viable, but the supplied Claude-native control plane makes Opus simpler operationally. Use Astra where independent reasoning is most valuable.
- Four expensive experimenters in parallel create more adaptive trials and machine contention before better evidence exists.
- Maximum effort everywhere spends heavily on routine code and prose.

Budget the first cycle for one builder, one preflight reviewer, one bounded audit and one closing review. Add work only when an exit test identifies a concrete gap. Record actual model/token usage. Do not invent dollar comparisons without current pricing.

## 4.2 Concurrency and process ownership

Run at most **two workers concurrently**, preferably one builder or compute worker and one read-only reviewer.

- At most two numerical processes at once.
- One numerical thread per process: set OpenMP, OpenBLAS, MKL and NumExpr thread counts to one; `n_jobs=1`.
- Start with one numerical process while other sessions are busy.
- Every subprocess has a supervisor-owned process group.
- Each scoring shard has a 300-second wall limit, a five-second termination grace and a recorded memory cap.
- A candidate may use several predeclared shards. All required shards must finish before its result is valid.
- Reserve at most 30 minutes of numerical execution per candidate in the first cycle. A budget failure is reported, not hidden by dropping members.
- No detached children, polling loops or agent-created sleep loops.
- On cancellation or timeout, terminate the entire process group and verify it is gone.

Measure available memory before choosing the cap. Do not assume an eight-core machine has enough memory for two full-catalog embedding copies.

## 4.3 Briefs and handbacks

A fresh agent gets a self-contained brief containing:

- The decision and hypothesis.
- Task, labels and forbidden interpretations.
- Exact allowed inputs and snapshot hash.
- Candidate and comparator.
- Allowed configurations and numerical budget.
- Output schema and artifact directory.
- Acceptance checks and stopping conditions.
- Links to the relevant glossary and protocol sections.

Keep briefs around 800 words. Link source material rather than pasting every previous conversation. Never include confirmation outcomes in a brief that can influence a candidate still being evaluated on that batch.

Every agent returns:

```text
REPORT.md
result.json
artifact-manifest.json
code/ or a patch
```

`result.json` contains:

```json
{
  "run_id": "...",
  "preregistration_id": "...",
  "status": "complete|failed|invalid|timed_out",
  "code_hash": "...",
  "data_hash": "...",
  "prediction_hash": "...",
  "counts": {},
  "metrics": {},
  "paired_differences": {},
  "runtime_seconds": 0,
  "peak_memory_bytes": 0,
  "limitations": [],
  "all_trials": []
}
```

The report must include failures, deviations and exact reproduction commands.

Before dispatching work, test artifact writing with a harmless local file. If an agent cannot save, require the report and JSON in its final response; the orchestrator saves and validates them immediately. A missing file is a failed handoff.

An authorized shell heredoc can replace a malfunctioning Write tool. It cannot bypass a read-only sandbox or another permission boundary.

## 4.4 Pre-registration and ledger

The orchestrator owns the runner and ledger. Agents submit configurations; they do not launch untracked scoring scripts.

Before execution, append:

- Hypothesis and decision.
- Dataset, split and feature hashes.
- Code and configuration hashes.
- Primary and guard metrics.
- Candidate budget and trial allowance.
- Seeds and internal search settings.
- Start time and responsible agent.

After execution, append completion status, artifact hashes, runtime and exit code. Preserve the original entry. Record failed, quick, diagnostic and abandoned runs.

If a frozen algorithm contains internal tuning, register its search space and record its evaluated settings as child trials. Calling the grid “inside the model” does not make it disappear.

First-cycle candidate configurations are fixed. Later branches may register at most two configurations before seeing their results. Further changes require a new hypothesis and review, not an informal continuation.

## 4.5 Verification and independent review

**Before:** Astra reviews the protocol without experimental result tables.

**During:** Sol independently checks prediction rows and reproduces simple baselines. Fable attacks synthetic edge cases and product meanings.

**After:** A different-family reviewer reruns the registered analysis and checks that the conclusion follows from its declared gate.

The orchestrator also performs analysis. It must personally inspect:

- Temporal eligibility and effective member counts.
- Import and bulk-write concentration.
- The visible-median baseline.
- Missingness and fallback coverage.
- One complete candidate list with every exclusion explained.
- The practical effect and interval, not just a winning rank.

Verification tests should protect the measurement:

- Mutating hidden labels leaves predictions unchanged.
- Later other-member ratings are unavailable.
- Import batches cannot cross a boundary.
- A missing fingerprint invokes a fallback.
- Warm and clean-process runs agree.
- A deliberately injected signal is detectable.
- A shuffled-label control does not produce an implausible personalized advantage.
- The exact current formula agrees with production fixtures.
- Pooled output never masquerades as Taste match.

A failed confirmation run is not automatically repairable against the same labels. If output changes after outcomes have been exposed, consume that batch and collect a new one.

## 4.6 State that survives the session

Create a new directory rather than rewriting the old lab:

```text
docs/research/taste-prediction/loop-v2/
  README.md
  PROTOCOL.md
  DATA.md
  STATUS.md
  baselines.json
  preregistrations/
  briefs/
  decisions/
  reports/
  instrumentation.md
  ledger.jsonl
  harness/
```

Repository contents are code, synthetic fixtures, protocols, aggregate results and private-artifact references. Private rows and fitted artifacts remain outside Git.

`STATUS.md` must answer:

- What decision is active?
- Which protocol and candidate hashes are frozen?
- Which batches are development, collecting, sealed or consumed?
- Which work passed review?
- What exactly should the next session do?
- What is waiting on members or normal development?
- Which processes, if any, are still running?

Use GitHub Issues in `alp82/goodwatch-monorepo` for accepted implementation work. Draft the instrumentation breakdown first; publish only after the breakdown is approved, as `docs/agents/issue-tracker.md` requires. Use the five documented triage labels.

Do not create a second domain glossary. Established terminology or changed product semantics belong in root `CONTEXT.md` and, where appropriate, an ADR.

## 4.7 Prevention mechanisms for the old failures

| Old failure | Prevention |
|---|---|
| Wrong benchmark | Task-specific decisions and different-family review before scoring |
| Random chronology and bulk sessions | Global cutoffs, blocked writes and provenance |
| Recommendation quality unmeasured | Fully judged actual top-ten lists |
| Locked feedback leaked into later rounds | Single-use batches; inaccessible labels; no comparative results during collection |
| Unledgered sweeps | Runner-owned registration before every scored trial |
| Different baselines and output conventions | Immutable adapters, schema validation and paired evaluation |
| Reports lived only in chat | Write preflight; required files; orchestrator persistence fallback |
| Module collisions | One clean subprocess per predictor; explicit dependencies and cache identities |
| Runaway processes and load | One-thread workers, process-group deadlines and concurrency limits |
| Temporary data disappeared | Versioned private snapshots, backup and restore check |
| Orchestrator never checked assumptions | Mandatory independent baseline and data audit |
| Reviews arrived only at the end | Before, during and after review |
| Owner findings became population claims | Equal-member primary analysis; owner reported separately |
| Confident prose outran evidence | Structured claims, counts, intervals and decision-gate review |

# 5. Kickoff prompt

```text
You are starting GoodWatch’s next taste, recommendation and score-prediction research loop.

Work in /home/alper/projects/goodwatch-monorepo. Use Claude Opus 5.5 at high reasoning effort as orchestrator. Delegate explicitly bounded tasks as described below. This is measurement work first, not another model sweep.

Read these files:
1. AGENTS.md and CONTEXT.md.
2. docs/agents/issue-tracker.md, triage-labels.md and domain.md.
3. docs/research/taste-prediction/README.md, section 11 first.
4. docs/research/taste-prediction/next-branches.md.
5. All three reviews in docs/research/taste-prediction/reviews/.
6. The selected merged research-loop design supplied with this prompt. If it has been saved, read docs/research/taste-prediction/loop-v2/README.md and STATUS.md first.
7. docs/implementation/recommendation-experience/README.md.
8. goodwatch-webapp/app/server/taste/, taste-portrait/, title-filter/, and app/domain/taste-match.ts.
9. docs/adr/0001-no-jev-for-fingerprint-scoring.md, 0008-one-row-per-watch.md and 0009-tracking-is-a-state-machine.md.
10. The old lab’s harness.py, build_pack.py, add_scores.py, briefs, ledger and frozen candidate dependencies.

The old benchmark used random holdouts of selected, already-rated titles. It did not measure recommendations. The locked quarter is spent. Do not locate it, reuse it as confirmation, or launch new feature/model sweeps.

The immediate decisions are:
- Does standardized Taste or another frozen challenger improve worthwhile suggestions on Discover?
- Does the frozen pooled predictor beat strong baselines on prospective recorded ratings and calibrated low-rating probability?
- Do changes to Sides or elicitation help members recognize their Taste and find useful titles?

Preserve domain meanings. Taste match remains fingerprint fit, not a predicted rating. Not interested and Dropped are exclusions, not taste labels. Skip is not a bad rating. Want to See expresses intention. Report the owner separately from population results.

You may read repository files and existing local research data. You may create local research code, protocols and private artifacts. After an independent protocol and extraction preflight passes, I authorize one read-only production Crate/Qdrant snapshot using existing access. Never write to production, install instrumentation, contact members, publish issues, or deploy from this research session. Prepare those changes for normal development. Follow the repository rule requiring approval of an issue breakdown before publishing it.

Store private data under:
  /home/alper/.local/share/goodwatch-research/taste-v2/
Store code, protocols, aggregate reports and handoff state under:
  docs/research/taste-prediction/loop-v2/
Keep raw identifiers, histories, predictions, credentials and contact information out of Git and chat.

The old development pack may still exist at:
  <scratchpad>/lab/pack.pkl
Load it through its harness.Data() if available. Preserve an authorized private copy and hash it. Its 7,210 development ratings are not a complete historical event log.

Complete these first three work items:
1. Write the measurement contract, frozen candidate manifest, split rules and decision gates. Have GPT-6 Astra at high effort independently review them before any comparison is scored.
2. Create a durable snapshot and provenance audit. Verify imports, write-time blocks, missing features, availability freshness and candidate eligibility. Prove the snapshot reloads from its manifest.
3. Build the minimal day-block evaluator for visible-history median, calibrated public score, current Taste and standardized Taste. Produce paired member summaries and leakage fixtures. Prepare the owner’s fully judged discovery pool and twelve-title rerating instrument.

Freeze median, current Taste, standardized Taste, calibrated public score and the existing continuous pooled predictor. Use continuous clipped rating estimates, no output shaping. Preserve ranking values and risk as separate outputs.

For time tests, cut off every member’s information globally before the prediction block. Group writes by UTC day and keep import batches together. Current title metadata makes retrospective results diagnostics, not faithful historical replay. Fresh confirmation must use predictions captured before outcomes.

All scored work, including quick checks and failed trials, must be registered before execution and recorded afterward. Run predictors in clean subprocesses. At most two workers and two one-thread numerical processes may run at once. Give each scoring shard a 300-second wall limit and kill its entire process group on timeout. Do not leave background loops.

The discovery pilot may use the owner and six non-owner volunteers later. Confirmation uses separate non-owner members and one frozen challenger against current. Judge the entire union of actual top-ten lists. Do not infer precision from unobserved titles or turn a 24-title sample into a full-catalog claim.

Prepare a single-use prospective confirmation process. Builders cannot read collecting confirmation labels. A consumed batch becomes development evidence; it never becomes untouched again. If an evaluator access boundary is unavailable, mark work development-only.

Write STATUS.md before ending or changing sessions. Include exact artifact hashes, completed checks, unresolved issues, collection status, process cleanup and the next concrete action.

Use defaults from the design for reversible implementation choices. Ask only for owner decisions that materially change the protocol or require separate authorization. Continue independent work while those questions are pending.

End the first session with reviewable artifacts and an explicit measurement-readiness verdict. Do not announce a new model winner.
```

# 6. Risks and open questions

| Owner decision | Recommended answer |
|---|---|
| **Is the owner the target population?** | No. Use the owner to debug instruments and investigate examples. Population decisions use non-owner members with equal weighting. |
| **What improvement is worth building?** | One additional worthwhile suggestion per ten; 0.05 rating points of member-averaged MAE for a new internal predictor. Accept or amend these before scoring. |
| **Can recruitment support confirmation?** | Aim for six development volunteers plus 20–30 separate confirmation members. If only the owner is available, produce an owner case study and instrumentation plan, not a population winner. |
| **Should standardized fingerprints ship immediately?** | No automatic rollout. Make them the first challenger and fast-track their measurement. Their promise does not validate changed quantiles, explanations or For you behavior. |
| **Should predicted ratings or risk be shown?** | Keep both internal initially. A later display decision needs useful calibration in the intended population and a member study of interpretation. |
| **What if historical timestamps are unusable?** | Keep the honest diagnostic, report its coverage and rely on prospective collection. Do not impose synthetic viewing order. |
| **Can imports supply free reratings?** | Sometimes, after provenance audit. Copies and import applications are not independent observations. |
| **What if 90 days yields too little evidence?** | Report inconclusive, keep current and choose whether another predeclared collection batch is worth the cost. Do not lower thresholds afterward. |
| **Who guards final labels?** | An owner-controlled evaluator account. A prompt instruction or a separate directory under the same agent-accessible account is insufficient. |
| **What does the rerating study decide?** | Whether instability is large, where it occurs and what claims are sensible. It does not yield a universal MAE ceiling or an automatic “stop modeling at 0.7” rule. |
| **How should the Skip behavior in current Sides be handled?** | Preserve it only in the current-behavior control. Record the semantic conflict and prepare a separate correction; do not quietly mix it into the standardized-Taste experiment. |
| **Should fingerprint generation change?** | No. Audit concrete errors first and respect ADR 0001. A different model’s agreement is not a Fingerprint verdict. |
| **What if availability freshness cannot be established?** | Label it unknown. Report interest discovery, but do not call those titles worthwhile suggestions. |
| **How much model work should happen while waiting?** | Complete baseline reproduction, provenance fixes and instrumentation specifications. Then stop numerical experimentation until the next registered question has useful evidence. |
| **What should survive from this design?** | The measurement contract, frozen baselines, durable data, member studies and consumed-once confirmation. Individual thresholds may change before registration; the separation of tasks should not. |

**Delivery note — Astra:** The requested `scratchpad/design/astra.md` copy was not saved because this session’s filesystem policy is read-only. This response is the complete document.