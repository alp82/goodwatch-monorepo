**1. Review**

The report supports testing a pooled rating predictor. It does **not** yet support replacing Sides of you, treating predicted ratings as Taste match, or showing precise disappointment probabilities across unseen titles.

I checked the supplied code and ledger and ran read-only development-data analyses. I did not access the locked ratings, production databases, or paid APIs. The pack contains **7,210 development ratings from 231 members over 4,446 titles**. Locked-set numbers below remain the report’s results, not independently reproduced results.

The issues below are ordered by how much they change what should be built.

**1. The product recommendations exceed what the benchmark measured.**

The benchmark predicts ratings of titles that members already chose to watch and rate. It does not measure discovery, willingness to watch, availability, or the usefulness of a recommendation list.

That distinction changes three proposed decisions:

- A higher Spearman correlation among rated titles does not establish better top-ten recommendations among unseen titles.
- A cluster can be useful for browsing, naming interests, or retrieving candidates without improving rating error. Rejecting Sides of you on this benchmark is premature.
- Today’s Taste match is a fingerprint-fit percentile. It is neither a predicted rating nor a probability of enjoyment. Substituting a quality-heavy predictor changes its meaning. Under Top rated plus For you, it could also reinforce public quality twice.

The appropriate conclusion is “the pooled model is a candidate recommendation component.” It is not “replace the existing recommendation experience.”

This is a known measurement problem: prediction accuracy covers only part of recommender user experience. [Knijnenburg et al., 2012](https://pure.tue.nl/ws/portalfiles/portal/3484177/724656348730405.pdf)

**2. The locked set is a reused validation set, and it was not pristine initially.**

Keeping individual locked ratings away from experiment agents was useful. However:

- The report’s initial comparisons used all 993 owner ratings before the split existed. Those comparisons informed subsequent directions.
- Round-one and round-two locked results appear in the next round’s briefs. Later choices therefore adapt to that set, even without seeing individual labels.
- The ledger contains 50 scored runs. Experiment scripts and agent reports document additional sweeps outside it. Fifty is not the full number of comparisons.

Cross-validation inside `predict` protects against many direct label leaks. It does not protect against repeatedly selecting features, models, and thresholds using the same validation results.

The report’s fixed “differences below 0.02 are noise” rule is also unjustified. Uncertainty belongs to the **paired difference between methods**, not each method’s error separately. Conversely, trying many alternatives can make an apparently larger difference unreliable.

Freeze the candidates now. Use future ratings and newly recruited members for confirmation. Report paired intervals, resampling members for population results and checking sensitivity to franchises and rating sessions. Repeated fold seeds are not new independent observations. Adaptive holdout reuse is a well-established source of overconfidence. [Dwork et al., 2015](https://proceedings.neurips.cc/paper/2015/hash/bad5f33780c42f2588878a9d07405083-Abstract.html)

**3. “High predictions are safe” is both statistically unsupported and numerically misleading.**

I reproduced the readable profile’s top third:

| Check | Titles | Ratings of 5 or less |
|---|---:|---:|
| Profile fitted and evaluated on the same owner ratings | 248 | 1 |
| Owner ten-fold out-of-fold profile predictions | 248 | 1 |

The displayed **0% is 1/248, or 0.4%, rounded to a whole percent**. It is not zero bad titles. Moreover, [the profile code](/home/alper/projects/goodwatch-monorepo/docs/research/taste-prediction/lab/agents/profile/lib.py) computes its displayed trust statements on its training ratings.

The separate risk model has more credible cross-validated evidence, but “accurate at every level” still overstates it:

- The highest-risk bin contains only about five titles.
- Its table pools repeated predictions of the same titles across split seeds.
- It describes selected, historically rated titles, not the recommendation catalog.
- The supplied locked evaluation measures point predictions; it does not establish locked-set probability calibration.
- Below 15 visible ratings, `risk/best.py` returns the member’s smoothed rating histogram for every title. Its risk estimate is then not title-specific.

Keep risk as a research output. Before displaying it, test calibration prospectively and show counts or uncertainty rather than implied precision.

**4. Several “wins” change the decision rule rather than improve preference prediction.**

The conditional median minimizes expected absolute error. That is true whether ratings are integers or continuous. Rounding a prediction does not universally improve error.

More importantly, the band-weighted median with `alpha=0.5` optimizes a different objective. It intentionally makes errors on rare rating bands more expensive. That can be useful, but it is a product tradeoff, not a more truthful estimate of the member’s likely rating.

The ledger makes the distinction visible:

| Same pooled model, different output | Owner development MAE | Other members’ mean skill |
|---|---:|---:|
| Continuous | 0.789 | 0.137 |
| Rounded | 0.758 | 0.152 |
| Distribution, `alpha=0.5` | 0.774 | 0.123 |

The weighted distribution improves balanced error, but it does not dominate the rounded predictor. Those rounded results need their own prospective comparison.

The constant baseline is also weak for absolute error. Using each member’s **training-set median**, with the harness’s folds, gives **0.053 mean skill across the 22 comparison members**, without any title information.

Nevertheless, the cold-start result survives stronger controls. I reproduced the small-history experiment:

| Development history | Members / ratings evaluated | Visible-mean MAE | Visible-median MAE | Pooled MAE |
|---|---:|---:|---:|---:|
| 5–9 ratings | 21 / 136 | 1.414 | 1.346 | 1.252 |
| 10–19 | 53 / 731 | 1.358 | 1.293 | 1.233 |
| 20–39 | 57 / 1,745 | 1.378 | 1.369 | 1.260 |
| 40–59 | 14 / 700 | 1.402 | 1.371 | 1.174 |

These are rating-weighted MAEs, using five-fold validation and `pool.pooled_predict(k=0, own=300)`. A separate hierarchical model using only public score, a member offset, and a member slope also lost to the full pooled model in every group.

This is substantive evidence for pooling. It does not establish “five ratings are enough for good recommendations” or a general “four times the ratings” exchange rate.

**5. The readable Taste contains factual errors and overinterpreted effects.**

I verified that [the sequel feature](/home/alper/projects/goodwatch-monorepo/docs/research/taste-prediction/lab/agents/profile/feats.py) treats numbers in names as sequel evidence. It marks **8 Mile, District 9, Super 8, and Menace II Society** as sequels despite having neither a sequel keyword nor a collection ID in the pack. The last title appears as a supporting example in the owner’s profile.

Other problems are conceptual:

- Public agreement is called “quality” or “well made.” It measures agreement with particular audiences and critics, not objective quality.
- Explaining 28% of rating variance with public scores does not mean 28% of the person’s taste is quality.
- Sequential residual fitting assigns shared effects according to the chosen order. “Sequel penalty after kinds” is not an order-independent account of why the member dislikes sequels.
- Ninety-percent intervals follow feature selection and estimated shrinkage. They do not automatically retain nominal coverage.
- Repeated split-half sign agreement is useful stability evidence. It does not validate the wording, interval coverage, or semantic meaning of a machine-named theme.

Hand-writing better names for latent text components will not fix misleading examples or uncertain meanings.

**6. Population and time effects limit transfer more than the report’s headline suggests.**

The owner supplies about **10% of development ratings**, so they do not numerically dominate the entire dataset. They dominate the research objective and model selection.

Their viewing and rating pattern is unusual:

- Owner shows: **3 low ratings among 105 ratings**, or 2.9%.
- Other members’ shows combined: **475 among 2,298**, or 20.7%.

The second number weights ratings, not members. It still demonstrates why “shows are safe” cannot become a general rule.

I also found **401 of the owner’s 744 ratings have update dates on just two days**. This is consistent with bulk entry or importing. `updated_at` must not be treated as watch time.

Random rating splits answer a legitimate historical-completion question. They do not simulate future recommendations, changing taste, or newly released titles. Current public scores and whole-series fingerprints may also contain information unavailable at the historical decision time.

Finally, selection occurs at several stages: exposure, choice, watching, completion, and rating. Correcting only rating imbalance leaves those stages untouched. [Schnabel et al., 2016](https://proceedings.mlr.press/v48/schnabel16.html)

**7. The null results justify restraint, not impossibility claims.**

Replace these conclusions:

- “There are no sweet spots” → “The tested nonlinear models did not improve this benchmark.”
- “Names add nothing” → “These person-effect encodings provided little incremental value after the existing features.”
- “Nothing in the data separates them” → “The tested models missed these disappointments.”
- “Bad scores cannot be predicted” → “Very low conditional medians are rare under the current models and observed histories.”

The owner has only **seven development ratings of 3 or less**. That is insufficient evidence about the general predictability of extreme disappointment.

The positive control in the risk experiment demonstrates sensitivity to that injected effect. It does not establish adequate power for every smaller, sparse, or nonlinear effect.

Also, the winning pooled model itself uses other members’ ratings. The failed branch is primarily direct neighbor or co-rating information at current density—not collaborative information generally.

---

**2. New branches to explore**

The gains below are expectations, not measured forecasts. Numerical success thresholds are proposed experiment criteria. Costs are rough engineering estimates, excluding participant recruitment.

**A. Establish a recommendation benchmark, then collect data for offline replay**

**Hypothesis and evidence.** A method that improves rating prediction may fail to improve worthwhile suggestions. GoodWatch already defines the relevant outcome: appealing, unfamiliar titles available on the member’s services.

**Data.** Existing eligibility rules, country, services, seen status, and title features can construct candidates. New data must record what was actually shown, its position, candidate set, policy version, and the probability of showing it. Page views and clicks alone do not provide this.

**Experiment.**

Recruit approximately 30 members across history sizes. For each, assemble a judged pool of about 24 eligible unseen titles from current recommendations, pooled predictions, Side-based retrieval, and a random eligible sample. Randomize presentation and hide model identity. Ask whether each title is familiar and appealing, then offer Want to See.

Compare useful suggestions among the first ten and NDCG@10: a measure that rewards placing appealing titles early. This measures ranking **within the judged pool**, not across the whole catalog. Follow up separately on actual watches.

Next, randomize one recommendation slot among a modest eligible candidate pool. Log its selection probability. Evaluate supported alternative policies through replay or probability-weighted estimates. Deterministic historical clicks cannot provide unbiased replay, and a narrow exploration pool cannot validate policies outside that pool. [Li et al.](https://arxiv.org/abs/1003.5956)

**Expected gain/confidence.** High confidence that this changes model-selection decisions; unknown recommendation uplift. A useful initial target is one additional worthwhile suggestion per ten shown.

**Cost/risk.** About one engineering week plus recruitment and follow-up. Main risks are low traffic, participant selection, and confusing curiosity clicks with useful discovery. Avoid ranking against a handful of random “negative” titles and calling it catalog performance; sampled ranking metrics can reverse model comparisons. [Krichene and Rendle, 2020](https://research.google/pubs/on-sampled-metrics-for-item-recommendation/)

**B. Ask informative questions instead of waiting for more incidental ratings**

**Hypothesis and evidence.** Three carefully chosen responses may reveal more than three arbitrary ratings, especially about disagreements with public scores. Pairwise preference learning and active question selection have established precedents. [Salimans et al., 2012](https://www.microsoft.com/en-us/research/publication/collaborative-learning-of-preference-relations/)

**Data.** Existing ratings and features suffice for an offline simulation. Production needs explicit pairwise choices, “haven’t seen it,” ties, and response time. Share-list order is another existing source of pairwise evidence, conditional on its list prompt.

**Experiment.** Start from five visible ratings. Compare three additional random known-title ratings with three queries chosen to distinguish plausible member models. Select recognizable titles on which the models disagree—not merely obscure titles with high uncertainty.

Then test with real members. Include one optional prompt for a widely liked title that disappointed them. Keep “which did you enjoy more?” separate from “which would you watch tonight?”

Measure held-out preference accuracy, useful unseen suggestions, and improvement per minute of member effort. Reserve evaluation titles before choosing questions.

**Expected gain/confidence.** Medium confidence of improved cold-start learning; stronger confidence that it exposes missing preferences. Require it to beat ordinary rating collection at the same time cost.

**Cost/risk.** About one week. Recognition failures, fatigue, and leading questions can erase the benefit. Simulations over already-rated titles overestimate answerability.

**C. Test Taste as something members read, recognize, and can correct**

**Hypothesis and evidence.** A faithful description and an effective predictor need not be the same artifact. A Side can summarize loved titles while a pooled model predicts ratings. The current sequel errors and awkward theme examples show why semantic validation is necessary.

**Data.** Existing histories support descriptive summaries. New feedback should capture accurate, inaccurate, unsurprising, and useful statements, with optional corrections.

**Experiment.** Compare three presentations: current Sides, corrected residual statements, and a combination. Include a generic-profile control and occasional statements from a matched different member to detect agreeable but nonspecific prose.

Measure recognition of one’s own Taste, factual errors, usefulness in choosing a title, and useful suggestions reached through a statement or Side. Separately test statement stability on held-out ratings.

Rewrite claims as observed associations: “Among titles you rated, you tend to rate these above the public-score prediction.” Show actual supporting and contradictory titles. Replace the sequel heuristic with verified membership and order. Use out-of-fold predictions for trust statements.

**Expected gain/confidence.** High confidence in improving factual trustworthiness; medium confidence that the combined presentation beats either alone.

**Cost/risk.** Several days for corrections and roughly one week for a study. Member agreement alone can reward flattering generalities. Do not demand prediction gains from purely descriptive statements.

**D. Measure rating consistency and preserve rating provenance**

**Hypothesis and evidence.** Some remaining error may come from unstable ratings, changed opinions, or incompatible import scales. Re-rating research has measured substantial inconsistency and tested selective re-rating. [Amatriain and colleagues](https://nuriaoliver.com/projects/recsys/)

**Data.** Existing ratings and import records provide a starting point. New observations need the original source and scale, original rating date when available, re-rating date, recent rewatch status, and confidence.

**Experiment.** Ask about 30 members to re-rate 12 previously rated titles after a delay, without showing their old rating or GoodWatch’s prediction. Sample across low, middle, and high ratings, then weight results back to their histories.

Measure absolute re-rating differences, movements across the low-rating threshold, and pairwise preference stability. Preserve both observations. Do not overwrite the first simply because it disagrees with the model.

Estimate an error floor only under stated assumptions. For example, half the mean squared difference between two independent, equally noisy ratings estimates single-rating noise variance. There is no equivalent universal shortcut from re-rating MAE to model MAE.

**Expected gain/confidence.** High confidence in better investment decisions; uncertain direct prediction gain.

**Cost/risk.** Two to four engineering days plus several weeks elapsed time. Memory, rewatches, and genuine preference changes complicate interpretation. Hide predictions because displayed recommendations can influence reported ratings. [Cosley et al., 2003](https://www.cs.cornell.edu/~danco/research/papers/conform-chi2003.pdf)

**E. Use multiple interests for candidate retrieval and list diversity**

**Hypothesis and evidence.** Several interest directions may find worthwhile titles that a single aggregate misses, even if they do not improve rating regression. Multi-interest retrieval explicitly separates candidate discovery from aggregation. [Cen et al., 2020](https://arxiv.org/abs/2005.09347)

**Data.** Existing Sides, fingerprint vectors, text embeddings, TMDB neighbors, and catalog filters. Full-catalog evaluation needs a later approved snapshot beyond the 4,446-title pack.

**Experiment.** Retrieve candidates from three or four member interests, public quality, and nearby unexplored interests. Merge them, then rank with the same frozen pooled model. This isolates retrieval from scoring.

Compare candidate coverage and useful top-ten suggestions against one-vector retrieval. Test a simple diversity reranker that penalizes similarity to titles already selected, plus a franchise cap. MMR provides a simple starting algorithm. [Goldstein and Carbonell, 1998](https://aclanthology.org/X98-1025/)

Evaluate Discover and Wishlist ordering separately. Discovery needs unfamiliarity; Wishlist already expresses interest.

**Expected gain/confidence.** Medium confidence in broader candidate coverage; uncertain satisfaction gain. I expect more benefit in discovery than in predicting exact scores.

**Cost/risk.** Three to five days after branch A exists. Diversity can become irrelevant variety. This does not justify training a large neural multi-interest model on 7,210 ratings.

**F. Collect disappointment reasons and improve the title representation**

**Hypothesis and evidence.** Generic themes describe subject matter better than the reasons a particular execution disappointed someone. More elaborate models cannot recover information absent from their inputs.

**Data.** Collect short, optional reasons after low ratings: unearned ending, repetitive plot, humor mismatch, tonal inconsistency, excessive violence, or another reason. Include positive contrasts too. Existing synopsis, tropes, advisories, and title analysis provide candidate evidence.

**Experiment.** Use an exploratory set to define six to ten concrete attributes. Freeze their definitions before evaluation. Annotate a few hundred titles, blind to member ratings, using human review or a local-model pass with cited supporting text. Distinguish unknown from absent.

Fit strongly shrunk member preferences for those attributes on top of the pooled baseline. Test held-out members and titles. Report low-rating precision at a fixed flagging budget, ordinary MAE, and probability calibration.

Audit the existing fingerprint on matched loved/disliked titles before expanding it. The current title-analysis prompt describes shows by their overall identity and reputation, which may miss the experience being rated.

**Expected gain/confidence.** Medium confidence in better explanations; low-to-medium confidence in better disappointment prediction. Small gains are more plausible than a dramatic MAE reduction.

**Cost/risk.** One to two weeks. Hindsight labeling and model-generated explanations can manufacture apparent signal. Never let title annotators see the target member’s rating.

**G. Import collaborative structure rather than wait for local co-ratings**

**Hypothesis and evidence.** The local collaborative null is partly a coverage result. I verified that only **23% of owner-rated titles have five other development raters**, and only **7% of the owner’s low-rated titles do**.

**Data.** Obtain member-authorized rating exports and preserve source metadata. Separately investigate MovieLens item factors as an external prior. MovieLens 32M contains roughly 32 million ratings over 87,585 movies and provides cross-service identifiers. Its terms require permission for commercial use. [Official dataset README](https://files.grouplens.org/datasets/movielens/ml-32m-README.html)

**Experiment.** Learn fixed movie factors externally. Fit a small, regularized GoodWatch member vector from their visible ratings. Blend this prediction with the existing content model using training-only validation.

Evaluate mapped movies separately, retain a content fallback, and report performance by mapping coverage and local rating density. Use a source-only comparator to learn whether factors add anything beyond public consensus.

**Expected gain/confidence.** Medium confidence that this makes collaborative testing informative; low confidence of transfer gains before trying it. It offers little direct coverage for shows.

**Cost/risk.** Around one engineering week, plus any permission delay. Main risks are domain mismatch, selection bias, title mapping errors, and importing more acclaim rather than personal preference.

**H. Model tonight’s choice and show continuation as separate outcomes**

**Hypothesis and evidence.** “I would rate this highly” differs from “I want this tonight.” A whole-show score also mixes early enjoyment, later decline, and completion decisions.

**Data.** Country, services, Mood, runtime, release events, episode watches, and show state already exist in production. Their usable historical coverage is unverified. Add session-level context and optional reasons for stopping.

**Experiment.** For movie discovery, compare the frozen taste ranker with a small contextual reranker using explicitly chosen Mood and time available.

For shows, predict whether a member wants to continue after a specified episode, using only information available then. Compare first-season information with whole-series features. Distinguish recorded activity from missing logs; no new episode, unavailable streaming, and failure to log a watch are not dislike.

Keep domain rules intact: Dropped and Not interested remain exclusions, not synthetic low ratings. Any new enjoyment signal should be explicit.

**Expected gain/confidence.** Medium confidence in improving immediate choice; low confidence in retrospective measurement until event provenance is audited.

**Cost/risk.** One to two weeks. Sparse watch logging and mistaken timestamps can make a convincing but invalid temporal model.

**I. Separate rating estimation, disappointment risk, and recommendation decisions**

**Hypothesis and evidence.** The experiments mix three jobs in one output. Separating them allows honest score evaluation and explicit control of bad recommendations.

**Data.** Existing development ratings suffice for implementation. Fresh ratings are needed for confirmation. Add metadata recording whether a prediction was shown before the member rated.

**Experiment.** Freeze the pooled point model and compare:

- Its continuous and rounded predictions.
- An unweighted ordinal median.
- A pooled ordinal distribution whose thresholds borrow strength across members.
- The existing weighted decision rule, evaluated as a decision policy.

Extend the harness to return probabilities as well as point scores. Evaluate MAE for the score, Brier score for low-rating probability, and precision/recall at a fixed warning budget. Report member-level and rating-level aggregates, history-size groups, owner-excluded results, and films versus shows.

For five-rating members, require improvement over a smoothed personal histogram. Add an unfamiliar-feature-region check so confident extrapolation is visible.

**Expected gain/confidence.** High confidence in clearer evaluation; medium confidence in better small-history probabilities. I expect little additional owner MAE gain from output shaping alone.

**Cost/risk.** Three to five days plus prospective collection. Probability calibration can drift under new candidate selection. Productionize cached features and member parameters; do not put model fitting or database lookups on the card path.

---

**3. Ranking**

1. **A — Measure actual unseen recommendations and enable replay.** It beats B because every subsequent optimization needs a trustworthy definition of a useful suggestion.
2. **B — Ask informative preference questions.** It beats D because it actively creates missing preference evidence and can improve cold start while the reliability study runs.
3. **D — Measure consistency and preserve provenance.** It beats C because it establishes whether apparent errors and unstable descriptions reflect the model, the labels, or genuine changes.
4. **C — Test and repair the readable Taste.** It beats E because there are verified factual and confidence errors to fix, and replacing an existing product surface requires direct member evidence.
5. **E — Use multiple interests for retrieval and diversity.** It beats further rating-model elaboration because it tests a distinct, unmeasured benefit using data and infrastructure GoodWatch already has.

I would stop doing two things:

- **Stop broad model and feature sweeps on the same owner ratings and reused locked set.** Freeze the shortlist and spend the next experimental budget on new outcomes and observations.
- **Stop converting Skip, Want to See, Not interested, or Dropped into invented numerical ratings.** Preserve what each action means and collect explicit enjoyment evidence when that is the target.