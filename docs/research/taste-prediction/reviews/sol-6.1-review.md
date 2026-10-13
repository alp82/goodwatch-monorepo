## 1. Review

**The report supports testing a pooled rating predictor. It does not yet support replacing GoodWatch’s recommendation model or Sides of you.** Those changes require different evidence.

I verified the development data, reproduced the main tree baseline, separated rounding from another simultaneous model change, tested stronger simple baselines for small histories, and checked the implementation of pooling, calibration and readable statements. I inspected the experiment code and ledger. I did not access locked ratings, production databases or paid APIs. Locked results below are the report’s results, not an independent reproduction.

The issues below are ordered by how much they change what should be built.

### 1. The measured task does not establish recommendation quality

The benchmark estimates:

> How would this member rate another title drawn from the titles they chose to watch and rate?

The product needs to answer:

> Which unfamiliar titles should we show, given the member’s interests, current choice and availability?

These are different populations and outcomes. A member may enjoy a title without wanting to watch it now. A worthwhile suggestion must also be unfamiliar and available. Neither is measured here.

Spearman correlation measures ordering across the held-out rated titles. Bad-title AUC measures whether a randomly chosen bad title falls below a randomly chosen non-bad title. Neither establishes that the first ten recommendations improve. A model can improve both by identifying mediocre titles while leaving its best recommendations unchanged.

Selection also affects the apparent predictability of ratings. Members filter out many unsuitable titles before watching. Public scores probably influence that selection. Predicting ratings after that filtering does not identify preferences across the catalog. This is the selection problem formalized in [Recommendations as Treatments](https://proceedings.mlr.press/v48/schnabel16.html).

**Build implication:** retain the pooled predictor as a candidate scorer. Measure discovery and watch choice before replacing the recommendation path.

There is also a domain conflict. Today, **Taste match** means fingerprint fit within the member’s own range. A pooled prediction includes public scores, generosity and population preferences. Its output is not automatically the same thing. Showing it through the existing percentage would change what the percentage means.

### 2. The locked set was never a completely untouched final test

The report correctly acknowledges three looks. The problem starts earlier: the pre-loop comparison used all 993 owner ratings before the locked split existed. Those results influenced the choice of baseline, features and research directions.

Then round-1 locked results were published in the round-2 brief, and round-2 locked results in the round-3 brief. Later choices therefore depended on earlier locked performance, even if individual agents could not read the labels.

The ledger contains 50 full runs. The reports describe many additional unledgered sweeps. Cross-validation protects a particular fit from using its test labels. It does not protect the winning design from repeated selection on the same cross-validation results. [Cawley and Talbot](https://www.jmlr.org/beta/papers/v11/cawley10a.html) explain why this selection bias can be as large as the differences between algorithms.

The large development-to-locked failure of the combined model is useful evidence. It does not prove that every simpler winner escaped the same process.

The report’s universal “differences under 0.02 are noise” rule is also unjustified. Uncertainty depends on the **paired difference between two models**, not just each model’s error. Twenty-two evaluated members are more informative than one owner, but they are still only 22 members.

**Build implication:** freeze a short candidate list now. Use new prospective ratings for the final decision. Use nested validation—choose settings inside training folds, assess them outside—for further development.

### 3. Rejecting Sides of you confuses prediction with description

“Clusters of loved titles predict nothing” is much broader than the experiment warrants.

The pre-loop cluster predictor takes the maximum similarity to a loved cluster. Production Sides also provide names, examples, exploration edges and “More of this,” whose ranking includes public score. The benchmark does not evaluate that experience.

A member can find “you love gentle comedy and dark crime” accurate and useful even if cluster similarity adds no rating accuracy after public scores. Conversely, a statistically stable public-score slope may tell them little about themselves.

The statement list was evaluated for prediction and split-half stability. It was not evaluated for:

- Whether members recognize themselves.
- Whether examples support the words used.
- Whether statements teach something useful.
- Whether members can correct them.
- Whether they help members find another worthwhile suggestion.

There are concrete presentation problems. The sequel heuristic marks **Menace II Society** as a sequel because its title contains “II.” It then appears as a sequel example. The “horror, mystery, psychological, dread” theme presents **The Wild Robot** and **Exit Marrakech** as supporting examples. Those titles may occupy the positive end of a text component, but that does not establish that the component’s name describes them faithfully.

The implementation also computes the six shared kinds over the pack’s **4,446 selected titles**, not the full catalog. Catalog normalization and catalog clustering are different operations.

Finally, only **14 of 231 members** have at least 80 development ratings. The stated display gates would give most members very little inferred taste text.

**Build implication:** test statements alongside Sides. Give small-history members accurate descriptions of their known examples and explicit preferences, without unsupported quantitative claims.

### 4. The score, the decision rule and the probability need separate evaluation

The report is right that the median minimizes expected absolute error. But its delivered answer is a **band-weighted** median, mixed with a continuous value. That deliberately trades ordinary error against error on rare rating bands.

That can be a good decision rule. It is not simply the member’s most likely score, and it does not improve the underlying information.

I reproduced this controlled development comparison for the owner:

| Predictor | Mean absolute error, rating points | Spearman rank correlation |
|---|---:|---:|
| Original tree baseline | 0.818 | 0.550 |
| Same predictions, rounded with the existing tie breaker | 0.785 | 0.550 |
| Tree baseline with monotonic public-score constraints | 0.809 | 0.562 |
| Monotonic version, rounded | 0.770 | 0.562 |

The report’s “rounding alone” reference changes **both** rounding and monotonic constraints. Rounding helps ordinary error, but leaves ordering unchanged. Rounding the unchanged baseline slightly worsens error on the owner’s bad titles: **1.652 to 1.668 points**.

The risk work deserves credit for measuring probability quality. But “accurate at every level” overstates a development calibration table. The highest-risk bin contains about five titles per split. Repeated splits reuse the same outcomes; they do not create new independent titles. No locked probability scores or calibration intervals are presented.

The readable owner profile’s “high prediction is safe” claim is weaker still. Its trust bands are computed on the ratings used to fit that profile. Zero observed bad ratings does not imply zero future risk.

There are inconsistent skill references too:

- Main development skill uses the member’s mean over all development ratings, including held-out ratings.
- Small-history evaluation uses the visible training mean.
- Locked evaluation uses the development mean.

These are different baselines, so skill values across those tables are not directly comparable.

**Build implication:** evaluate the raw distribution with probability measures, the displayed score with ordinary error, and recommendation decisions with their own costs. Keep those three outputs distinct.

### 5. The owner is informative, but not representative

I verified:

| Development population | Movie ratings | Bad movie ratings | Show ratings | Bad show ratings |
|---|---:|---:|---:|---:|
| Owner | 639 | 67 — 10.5% | 105 | 3 — 2.9% |
| Other 22 evaluated members | 2,046 | 403 — 19.7% | 997 | 257 — 25.8% |

The owner’s “shows are safe” pattern reverses in the evaluated other members. It cannot justify a general recommendation rule.

The median member has **15 development ratings**. The owner supplies **10.3% of all development ratings**, and the top five members supply **24.7%**. Pooling excludes the predicted member, which is correct. But when predicting other members, the owner remains a substantial contributor to the consensus fit.

Small-history results also need stronger controls. I reproduced the reported public-score skill of **−19.1%** for the 21 members with 5–9 ratings. Merely putting that score on a 1–10 scale before the same `RidgeCV` fit changes its effective regularization and improves skill to **−5.7%**. A visible-history median improves error by **4.8%** against the visible-history mean.

This does not erase the reported pooled gain. It shows that part of the claimed advantage over existing methods depends on weak baselines.

Randomly selecting five ratings from an experienced member also does not reproduce onboarding. First ratings may be favorites, imported ratings, familiar blockbuster titles or quiz selections.

**Build implication:** report results by history size, source of ratings, rating behavior and media type. Add an owner-excluded population fit and stronger simple baselines.

### 6. Null results establish limits of these tests, not limits of taste

These statements are unproven:

- “Liking is monotone.”
- “There are no sweet spots.”
- “Nothing in the data separates” the missed bad titles.
- Better bad-title prediction must come from a better point score.
- About 69% of variance is unexplained by anything tried.

The defensible conclusion is narrower: the tested representations and models did not find a transferable improvement.

A positive control demonstrates sensitivity to **that control’s effect**. It does not establish enough power for smaller effects, interactions or subgroups. Detecting a missing tree contribution does not prove that season effects could be detected among three bad owner shows.

A score-only probability model necessarily orders risk through that score. Its AUC ceiling is a property of that model form. A model using additional information can, in principle, reorder risk.

I also checked the variance claim using the ledger’s RMSE and the owner’s development rating variance. The pooled continuous predictor explains about **36.7%**, leaving **63.3%**, rather than 69%. More fundamentally, a sequential “public score first, fingerprint second” decomposition does not identify how much of someone’s taste is objectively “quality.” Public approval is itself preference data.

**Build implication:** stop expanding unsupported fingerprint models for now. Reopen questions when the labels or title descriptions change.

### 7. Random holdouts miss time, imports and several implementation limits

The harness appropriately hides the target member’s test ratings. Its main leaders use the allowed training labels and other-member ratings.

But random folds allow later ratings to inform earlier ones. They also use current public scores and season summaries, which may not have existed when the member made the choice.

I tested the owner’s last quarter by rating-write time. Baseline error was **0.864 points**, versus **0.840 averaged over ten random quarter splits of equal size**. The random results ranged from **0.768 to 0.903**, so this is not evidence of a significant time effect. It is evidence that a time-aware test is feasible.

Write time is not watch time. One timestamp accounts for **347 development ratings**, consistent with a bulk operation. Import batches must not be interpreted as viewing sequences.

In the random owner folds, **168 of 298 franchise titles** have another title from that franchise in training. That is useful for predicting another entry in a familiar franchise. Generalization to an unfamiliar franchise needs a separate test.

There is also a calibration weakness in `combine/best.py`: it calls scores “out-of-fold” after fitting stack weights and the franchise correction against those same rows. Its outer evaluation still hides test labels, but its calibration inputs are partly fitted values. The whole stack needs to be fitted without each calibration fold.

Finally, target-title Want to See or favorite membership is not **always** leakage. A current snapshot can leak later actions into a retrospective rating test. An action recorded before a recommendation is legitimate information for a task that permits it. Timing and task definition decide this.

**Build implication:** add time cutoffs, import grouping and familiar-versus-new-franchise checks. Archive the fitted feature transforms and predictions. Several leaders need omitted cache files, including named cluster assignments; source code alone is not the complete reproducible experiment.

## 2. New branches to explore

The expected gains below are engineering judgments or experiment targets. They are not measured GoodWatch gains.

### A. Measure unseen-title recommendations and build replayable exposure logs

**Hypothesis and evidence.** A better rating predictor may produce worse discovery if it recommends familiar, repetitive or unavailable titles. Selection-aware evaluation and randomized logging provide a way to compare recommendation policies. [Li and colleagues’ replay method](https://arxiv.org/abs/1003.5956) demonstrates this principle for logged recommendations.

**Data.** Ratings, watch events, settings, availability and PostHog exist. The brief does not establish that GoodWatch records complete recommendation exposures or selection probabilities. Add an event containing the candidate set, displayed titles, positions, surface, filters, availability state, model version and probability of the randomized choice. Record cards actually visible.

**Experiment.**

1. Compare today’s model, standardized fingerprints, calibrated public score and the frozen pooled predictor.
2. As a first diagnostic, rank the same held-out rated titles and measure top-ten quality. Label this explicitly as a selected-title test.
3. For genuine unseen titles, collect “already know,” “interesting,” and Want to See judgments on a blinded mixture of candidates from all models.
4. In a small exploration lane, randomize one position among eligible candidates and record its selection probability.
5. Replay alternatives on that supported action space, weighting observations by their exposure probabilities. Do not claim replay evaluates titles that the logger never offered.

Measure **worthwhile suggestions per discovery session** separately from **satisfied watches per session**. Also report repeats, unavailable suggestions and known titles. Clicks are an early signal, not the final outcome.

**Expected gain, cost and risk.** High confidence that this improves decisions about what to build; no direct score-error gain. A useful launch target is 10% more worthwhile suggestions per session. Allow roughly 1–2 engineering weeks plus data collection. At this scale, full-slate counterfactual estimates would have high variance; start with the small randomized action space.

### B. Ask for informative preferences, rather than waiting for more arbitrary ratings

**Hypothesis and evidence.** Five deliberately chosen answers can reveal more than five favorites. Pair comparisons can reduce differences in how members use rating scales. Adaptive rating elicitation has prior support, including [Personalized Embedding Region Elicitation](https://arxiv.org/abs/2406.00973).

**Data.** Fingerprints, public scores, title examples and an existing quiz are available. Add explicit pair preferences, “haven’t seen,” reasons and whether a preference is general or just for tonight. Do not turn “haven’t seen” into dislike.

**Experiment.**

- First reproduce elicitation offline among titles the member has rated. Keep evaluation titles separate.
- Compare random questions, popular questions and questions chosen to reduce uncertainty in the pooled model.
- For a linear model, a candidate question’s value can start with `xᵀΣx`, where `Σ` represents uncertainty about the member’s weights.
- For pairs, use titles with similar public approval but different characteristics. Ask only when the member knows both.
- Add a direct question such as “Which mattered more: the story’s ideas, its characters, or the action?” Store it as a declared preference, distinct from inferred evidence.

Then run a real onboarding test with a fixed question budget. Measure completion, useful recommendations and accuracy on subsequently collected ratings.

**Expected gain, cost and risk.** Medium confidence. Target five adaptive answers matching the usefulness of ten random answers. Roughly 1–2 engineering weeks. The main risk is asking obscure or tedious questions. Optimize information gained per completed answer, not information per displayed question.

### C. Collect explicit disappointment reasons and match them to title characteristics

**Hypothesis and evidence.** A low score often reflects a specific objection: an ending, pacing, cruelty, tone or unmet expectations. None is adequately captured by “this title is similar to your favorites.” The owner’s missed bad titles and the weak sequel heuristic justify investigating missing information.

**Data.** Ratings, watch states, tropes, text and fingerprints exist. Reasons do not. Ask an optional reason after a low rating or a member-initiated Drop: “lost interest,” “too disturbing,” “story stopped making sense,” “wrong mood,” “time commitment,” or free text.

Keep **Dropped**, **Not interested** and quiz **Skip** under their current domain rules. They must not silently become bad ratings or general taste signals.

**Experiment.**

1. Collect reasons from about 30 consenting members, with loved-title examples as well as disappointments.
2. Use a discovery subset to define at most six additional title characteristics.
3. Annotate a balanced title sample manually. Test whether annotators agree.
4. Only then add a fixed, rating-blind extraction pass to title analysis. Candidate characteristics might include unresolved endings, continuity dependence or tonal instability.
5. Fit a small pooled model with member-specific responses to those characteristics.
6. Test on later ratings and unseen-title choices. A held-out title’s own post-watch reason must never be an input to its prediction.

**Expected gain, cost and risk.** Medium confidence in more useful explanations; low-to-medium confidence in better bad-score prediction. Target a 0.1–0.2 point reduction in bad-title error without sacrificing ordinary error. Roughly 2–3 engineering weeks plus collection. The risks are vague annotations, spoilers and turning a handful of memorable failures into universal dislikes.

### D. Measure re-rating consistency before declaring an error floor

**Hypothesis and evidence.** Some unexplained error reflects changing opinions, memory or scale use. Some reflects missing model information. Re-ratings can distinguish these. [The Magic Barrier of Recommender Systems](https://ir.cwi.nl/pub/22576/22576B.pdf) studies this problem.

**Data.** The pack contains one current rating per member-title pair. It cannot measure repeatability. Collect repeated judgments without overwriting the member’s standing score.

**Experiment.**

- Recruit about 20 members, plus the owner separately.
- Ask each to rate 20 familiar titles in three short sessions, separated by 2–4 weeks.
- Sample low, middle and high ratings and both movies and shows.
- Hide the old rating, public score and predicted score.
- Ask whether they have rewatched the title and whether they are judging enjoyment or perceived quality.

Measure exact agreement, average absolute change, crossings of the ≤5 boundary and repeat pair preferences. Fit an ordinal model separating persistent member-title preference from session variation. Do not simply divide re-rating MAE by two and call it the prediction floor.

Hiding predictions matters: [Cosley and colleagues](https://www.cs.cornell.edu/~danco/research/papers/conform-chi2003.pdf) found that displayed predictions can shift ratings toward those predictions.

**Expected gain, cost and risk.** High confidence in resolving the uncertainty; no guaranteed predictive improvement. About 3–5 engineering days plus six weeks elapsed. Participation bias and real preference changes limit generalization. Report both instead of treating every change as noise.

### E. Test a readable, correctable Taste experience

**Hypothesis and evidence.** Members need recognizable examples and useful distinctions. Statistical replication alone does not establish that prose describes their taste faithfully. The owner document’s examples provide concrete reasons to test wording.

**Data.** Existing ratings, statement estimates and Sides are sufficient for a first test. Add member feedback on each claim: accurate, partly accurate, wrong, or only sometimes. Keep declared corrections distinct from measured rating effects.

**Experiment.**

Show about 20 members three versions in randomized order:

1. Existing Sides.
2. The statement list.
3. A combination of example-based Sides and a few supported statements.

For every statement, show supporting titles and an exception. Ask the member to explain it back, identify a poor example and use it to choose another title. Test whether they can identify their own description among matched descriptions from other members.

Measure recognition, unsupported-example rate, useful discoveries and corrections. Also compare profile stability as ten new ratings arrive.

For quantitative claims, refit the **entire statement-selection process** during resampling. Freeze a selected claim before testing it on new ratings. Avoid presenting nominal 90% intervals as if they accounted for all the searches and upstream estimates.

**Expected gain, cost and risk.** High confidence that examples and corrections expose misleading claims; medium confidence in better discovery. Target at least 80% of shown statements judged mostly accurate, with explicit exceptions allowed. About one engineering week plus interviews. Favorable reactions to flattering prose are a risk, so include matched alternative descriptions and behavioral tasks.

### F. Build a smaller pooled score-and-risk model with stronger controls

**Hypothesis and evidence.** The most reliable contribution is probably shared learning with restrained personalization. Much of the score improvement also comes from decision conventions. A small model may retain the useful gains with clearer behavior and lower operating cost.

**Data.** The pack is sufficient. This branch needs no new labels to begin.

**Experiment.**

Compare a fixed ladder:

1. Visible-history median.
2. Population-calibrated public score.
3. Pooled audience and critic response.
4. Pooled fingerprint residual.
5. Additional text features.

Use the same display convention for all models. Test both an owner-excluded population and a population fit that gives heavy raters less weight. For members with few ratings, pool the ordinal thresholds that describe scale use rather than fitting nine thresholds independently.

Fit calibration on predictions from the **whole model trained without each calibration fold**. Measure ordinary and band-balanced error, probability error and calibration by member, media type and history size. Add member-relative disappointment thresholds alongside the fixed ≤5 benchmark.

For future deployment, save population parameters and title transforms. Compute the member’s small update after an action. Score a candidate matrix in batches.

**Expected gain, cost and risk.** Medium-high confidence in retaining useful small-history gains. Target ordinary error within 0.02 points of the complex model, with better stability and easier maintenance. Roughly one engineering week. The risk is understating unusual members’ preferences; retain a flexible residual only where fresh validation supports it.

### G. Separate tonight’s choice from enduring taste, and diversify the shortlist

**Hypothesis and evidence.** Someone may like both demanding drama and easy comedy while wanting only one tonight. A shortlist should cover useful alternatives rather than repeat the same attraction. [Ziegler and colleagues](https://files.grouplens.org/papers/ziegler-www05.pdf) provide evidence that recommendation-list diversification matters.

**Data.** Mood, runtime, viewing-context flags, services and watch progress exist. The member’s current company, time budget and desired effort generally do not. Ask these briefly and optionally. Treat them as session context.

**Experiment.**

- Keep the stable rating predictor fixed.
- First restrict candidates by watchability and explicit requirements.
- Compare sorting by predicted score with a diverse shortlist.
- A first diversity rule can penalize similarity to titles already selected and cap repeated franchise entries.
- Compare a single list with several short rows serving different current choices.

Randomize presentation within members. Measure successful choices, time to choose, useful alternatives and satisfaction after watching. For shows, evaluate starting a show separately from continuing it.

**Expected gain, cost and risk.** Medium confidence in better choices; little expected benefit to unconditional rating MAE. Target a 10% improvement in successful choices or time to choose. Roughly one engineering week. Too much diversification can replace strong suggestions with weak ones, so apply a relevance floor.

### H. Obtain external collaborative information instead of waiting for local density

**Hypothesis and evidence.** Collaborative filtering failed partly because local overlap is thin. I verified that **1,278 of 2,111 titles with development ratings have only one rater**. A richer external item representation could capture distinctions absent from the fingerprints.

**Data.** MovieLens 32M supplies ratings and IMDb/TMDB mappings. It can be joined to GoodWatch movies. Its commercial use requires permission under the [dataset’s terms](https://files.grouplens.org/datasets/movielens/ml-32m-README.html). It does not solve show coverage. Member-authorized imports can add local ratings with provenance.

**Experiment.**

1. Measure mapping coverage before building a model.
2. Train a modest external factor model and export fixed movie vectors.
3. Add 8–16 factor columns to the pooled model.
4. Compare them with public scores and equally sized content representations.
5. Test both random rating holdouts and movies entirely absent from local training.
6. Recalibrate rating scale and population response on GoodWatch training data only.

Never assume an external account is the same person as a GoodWatch member. Imports need source-specific scale handling and deduplication.

**Expected gain, cost and risk.** Low-to-medium confidence; a plausible experiment target is 0.02–0.05 points of movie MAE improvement, or a clearer top-ten ranking gain. Roughly 1–2 engineering weeks, subject to permission. Population shift, familiar-title bias and licensing are material risks.

### I. Audit the title representation before adding more title features

**Hypothesis and evidence.** Models cannot learn reliable preferences from poorly defined or incorrect characteristics. The sequel example shows a known error. Correlated LLM attributes may also describe public reputation rather than distinct content.

**Data.** Existing fingerprints, essence text, tropes and metadata are enough to start. The [MovieLens Tag Genome](https://grouplens.org/datasets/movielens/tag-genome-2021/) offers an independent, though limited, movie-tag representation.

**Experiment.**

- Select about 200 titles across popularity, language, media type and model error.
- Have reviewers assess a small set of attributes using their definitions, without seeing member ratings.
- Measure factual errors, agreement and whether closely related attributes mean distinguishable things.
- Correct sequel identity from actual franchise relationships and keywords rather than title numbering alone.
- For season features, distinguish the whole show from the seasons a member actually watched.
- Compare existing features, corrected features and the independent tag representation under the same frozen predictor.

Preserve the current fingerprint-scoring ADR. This is a measurement audit; it does not justify changing the title-analysis model without evidence.

**Expected gain, cost and risk.** High confidence in better examples and fewer factual mistakes; uncertain rating improvement. About one engineering week for the audit. The main risk is mistaking a reviewer’s interpretation for ground truth, so use explicit definitions and record disagreements.

## 3. Ranking

1. **A — Unseen-title measurement and exposure logging.** It beats elicitation first because it establishes whether any subsequent change improves the product’s actual outcome.
2. **B — Informative preference elicitation.** It beats profile redesign because it adds information for the many members whose histories cannot yet support detailed inferred claims.
3. **E — Readable, correctable Taste.** It beats richer disappointment modeling because it can improve a current experience and detect misleading claims using data already available.
4. **C — Explicit disappointment reasons and matching title characteristics.** It beats re-rating research because it directly creates the missing information most likely to improve bad-score prediction.
5. **D — Re-rating consistency.** It beats another pooled-model refinement because it determines whether the remaining error calls for more modeling, better questions or more cautious output.

**Two things I would stop doing:**

- Stop broad model and feature sweeps against these same folds and repeatedly inspected locked ratings. Freeze candidates and collect new evidence.
- Stop using rating-error results to justify removing Sides, declaring taste structure absent, or presenting precise disappointment risks across unseen titles. Each needs its own validation.