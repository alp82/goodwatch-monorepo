# Review of "Taste and rating prediction: what three rounds of experiments found"

Reviewer: Fable 5.1, working alone from the report, the lab code, the ledger, and read-only analyses of `pack.pkl` (7,210 development ratings, 231 members, 4,446 titles). Every number below marked **verified** was computed on the data file; **reasoned** means argued from the report and the code only.

## Part 1. Review

Ranked by how much each issue changes what should be built.

### 1. The benchmark measures the wrong direction of time, and it flatters every result (verified)

The harness shuffles a member's ratings into random folds. The product will do something else: learn from the ratings entered so far and predict the ones entered next. Those two tasks differ here because members do not rate in random order.

- 88% of all ratings were entered on each member's single busiest day. The 22 "other" members have a median of **one** distinct rating day. The owner has 73 days, but 289 and 112 ratings fell on two consecutive days. Ratings are retrospective memories (median gap between release and rating: 20 years; 93% of the owner's ratings are of titles released five or more years earlier), entered in catalog-browsing sessions.
- Members rate what they love first. The owner's oldest fifth of ratings averages 7.73 with 3.4% bad; the third fifth averages 6.66 with 13% bad.
- Owner, same training size (372 ratings), boosted trees on attributes plus facts: **first half to second half MAE 0.908, rho 0.451, bad-title AUC 0.802; random halves MAE 0.869, rho 0.522, AUC 0.822.** Removing the mean shift recovers only 0.01 of the MAE gap, so this is not just drift of the average; the ranking signal itself transfers worse forward in time.
- The 22 other members, ridge on the same columns: forward skill -0.017 against 0.050 on random halves; rho 0.288 against 0.377.

So the report's headline rank agreement of 0.61 and the "clearly better ranking" claim are measured under a protocol the product will never see. The forward-in-time numbers are roughly where the random-split baselines were. This does not say the pooled model is worse than the alternatives forward in time; it says nobody has checked, and the gap is bigger than any gain the report claims.

### 2. Nothing measures recommendation, and the rating predictor is the wrong tool for it (verified, with a caveat)

The report says this in its limits. It understates how much it matters. A rating is conditional on having chosen to watch. The product question is which unseen titles to show. I used the only proxy in the pack: the owner's unrated Want to See titles (272) against titles the owner passed on in the taste quiz (`user_skipped`, 132). Caveat: the glossary says quiz skip means "passed", not "Not interested"; `user_not_interested` is not in the pack, so this is a weak negative.

- GoodWatch score alone separates the two with AUC 0.599. Boosted-trees predicted rating: 0.626. Ridge: 0.563. Today's raw taste cosine: 0.609. **Standardized taste cosine: 0.657**, the best of the five.
- The predicted rating for titles the owner passed on averages 7.13; 61% of them are predicted 7 or above. The rating model cannot see "not for me" because no one rates what they did not pick.
- For 19 members with 20+ ratings and 10+ of each signal, the mean AUC of the ridge predicted rating is 0.58 (range 0.26 to 0.88); GoodWatch score 0.54.
- A top-50 list for the owner by predicted rating over the 3,700 unrated pack titles: mean GoodWatch score 88.5 (base 72.7), 29 of 50 are shows, 20 are animated, 13 anime, and it opens with Fight Club, GoodFellas, The Godfather. It has real value (13 of 50 are on Want to See, a 3.6x lift over the 7.3% base rate), but it is a canon list skewed toward whatever kinds the member rates safely. Comedy is 13% of the owner's loved titles and 9% of the list; thriller 7% and 3%; animation 7% and 15%.

The shows skew is the selection effect the report names ("shows are safe, 3% bad, probably because a show is rated only after choosing to keep watching") turned into a recommendation bias: the model will push unseen shows because the owner only rates shows they finished.

### 3. The few-ratings result is measured on a different, easier baseline, and is mostly not personal (verified)

The main tables define skill against the member's in-sample mean (harness `metrics`). The few-ratings table in section 5 uses `small()` in `agents/pooled/ev.py`, where the constant is the **out-of-fold** mean of the visible ratings. With 4 visible ratings that constant is a poor predictor, so skill is easier to earn. The report's wording ("the mean of a member's visible ratings") is correct but a reader will put the two tables on one scale.

I re-ran the pooled model with its personal weights off (`k=0, own=0`: consensus plus a shrunk offset and slope, two personal numbers) for members with 5 to 9 ratings: skill **0.083 against the out-of-fold mean, -0.089 against the harness definition**. The report's full pooled model scores 0.12 on the first scale. A plain "population offset shrunk toward 7.4 plus a fixed 0.6 slope on a consensus score" that I built independently lands at the same place (-0.10 on the harness scale). The out-of-fold MAE at 5 to 9 ratings is 1.44 points. The report concedes "at 5 ratings the main error is the member's own average and spread, not their taste"; the right conclusion is that for new members the product needs a shrunk generosity offset on a consensus score, which is a ten-line change, not a hierarchical EM model. The comparison baseline "everyone's score calibrated per member" (slope fitted on 4 ratings, -0.19) is a straw man; `everyone_shift` (offset only) exists in `preds.py` and is the fair one, but it is not in the table.

### 4. The locked set is spent, and the other members' skill is noisier than the tables suggest (reasoned, partly verified)

- Owner locked SE is about 0.045 MAE. About twelve predictors were scored on it across three looks and the best was chosen. Picking the minimum of twelve correlated noisy numbers buys roughly one SE for free, so 0.87 to 0.85, and 0.85 to 0.83, are what noise alone would show. The report says the second is noise; the first is too.
- Others' skill: per-member SD about 0.11 across the 22 members (from the ledger), so the SE of the mean is about 0.025. Development-to-locked rank order flips (everything-stacked 0.166 to 0.142; shape 0.125 to 0.144). The claim "0.09 to about 0.15 held" is plausible because it is a 2.5-SE jump reproduced by several variants, but the choice between variants at 0.14 against 0.16 is not supported.
- The 365 ratings of 1 are 47% from two members (97 and 76 ratings of 1). 24 of 94 members with 20+ ratings average 8.5 or higher. The mean of per-member skill is dragged by idiosyncratic raters; report the median and a paired test per member as well.

### 5. No error floor, and the floor may be most of what is left (verified in part)

The report says consistency is unknown. Two facts from the pack make the point sharper. The owner's between-rater disagreement with other members on shared titles, after removing each member's mean, is 1.3 to 1.7 points MAE (correlations 0.1 to 0.38); 51% of the owner's titles have no other rater at all. That is why collaborative methods found nothing, and it says nothing about self-consistency. The "69% unexplained" in section 7 could be mostly the member's own noise on a memory rating of a film seen twenty years ago, in which case every further modelling round is chasing a ceiling that is already near. Published re-rating studies on movie ratings (Amatriain et al., RecSys 2009, "Rate it again"; the "magic barrier" line of work, Said et al. UMAP 2012) find a substantial floor; the exact value for a 10-point memory scale here is unknown until measured. Note: the attributions above are from memory; check the originals.

### 6. "Clusters of loved titles predict nothing" is true and is the wrong test for Sides of you (reasoned, illustrated)

Sides of you is a description and a list-composition device, not a point predictor. The right question is whether a list drawn from several sides is better received than a list ranked by one score. Steck's calibrated recommendations (RecSys 2018) show that accuracy-ranked lists crowd out a member's lesser interests; my top-50 above does exactly that. The report's own six shared kinds (a fixed catalog clustering, not per-member) are the better frame, but the conclusion "build the statement list in place of Sides of you" throws away composition along with the clustering.

### 7. The readable taste has not been tested as readable (reasoned)

Replication of statement signs on random halves is a statistical test, not a reader test, and random halves share the same sessions (issue 1). Half the statements are near-universal ("you rate with the public", "you side with audiences": 17 of 21 members do). A member cannot tell whether a profile is theirs from such lines. Nothing checks whether members recognise their own list against another member's, or whether the examples ("Honey, I Blew Up the Kid") feel like a description or a data dump.

### 8. Smaller points

- Standardizing fingerprints is the one finding with the largest ratio of gain to cost (raw cosine rank agreement 0.235, standardized 0.452, verified) and it also wins the Want to See proxy. It should be the first ship, not the fourth.
- Spearman on a scale where 78% of the owner's ratings are 6, 7 or 8 is dominated by ties; the band-level AUCs are the more honest ranking measures.
- The `alpha` knob trades MAE for bad-title error; "0.5 is where nothing gets worse" is a development-set choice and a product decision, not a finding.
- The consensus score "correlates 0.70 with the GoodWatch score": the pooled model's core ingredient is largely the public score re-learned, which is consistent with "everyone's score alone beats nearly every fingerprint method".

## Part 2. New branches

Each branch: hypothesis and evidence; data (have, derive, obtain); experiment; expected gain and confidence; cost and risk.

### B1. Prospective logging: record the prediction at the moment a member rates

**Hypothesis.** The product can build its own forward-in-time test set for free. Every time a member rates, the server already has a predicted score, a risk and a taste match for that title; store them with the rating. After a few months there is a locked set that nobody has looked at, that reflects real order of entry, and that regrows forever. Issue 1 and issue 4 go away together.

**Data.** Obtain through instrumentation: a table `user_score_prediction (user_id, tmdb_id, media_type, model_version, predicted, risk, match, n_ratings_at_time, surface, created_at)`, written on every rating and every Want to See or Not interested action. No member-facing change.

**Experiment.** Offline now: add `cv_time()` to the harness that sorts by `updated_at` and predicts each later block from everything before it (the code in my analysis is twenty lines). Report forward MAE, rho and bad-title AUC beside the random-split numbers for every leader in the ledger. Online: once 500 logged ratings exist, the comparison between model versions is paired and prospective.

**Gain.** Changes which model wins, not the number itself; I expect the forward gap between today's taste and the pooled model to shrink. Confidence high that this changes decisions. **Cost** a day. **Risk** none.

### B2. Measure recommendation directly: a choice model and a replayable ranking metric

**Hypothesis.** "Would pick this" and "would rate this highly, having picked it" are different quantities, and the first is the product. A two-stage model (choice probability times conditional rating, or simply a choice ranker) will beat the rating predictor on any measure of what members actually add, click or start. Evidence: the proxies in issue 2; Cremonesi, Koren and Turrin, RecSys 2010, found rating-prediction gains do not translate into top-N gains; Steck (KDD 2010) and Schnabel et al. (ICML 2016) show how to evaluate and train when the missing ratings are informative.

**Data.** Have: `user_wishlist` with `created_at`, `user_not_interested`, `user_skipped`, `user_watch_log`, `search_history`, PostHog clicks. Add `user_not_interested` to `build_pack.py` (it is missing from the pack). Obtain: impression logging (surface, position, title, match shown, model version) in PostHog or a Crate table, so that "shown and ignored" becomes a label and counterfactual estimators become possible.

**Experiment.** Harness addition `rank_eval(D, score_fn, user)`: score every pack title the member has not rated; report AUC of Want to See against Not interested and quiz-skip, precision@50 lift over the Want to See base rate (owner today: 3.6x), and recall@50 of the member's most recent quarter of Want to See adds (time-ordered, from `created_at`). Then train a logistic choice model on Want to See versus Not interested and skip with the same 160 columns plus popularity and recency, and compare it and the standardized cosine with the pooled rating.

**Gain.** Large for recommendation ordering; this is the surface members see. Confidence medium-high that a choice model beats the rating predictor on these measures (the standardized cosine already does for the owner). **Cost** a week offline, a week of instrumentation. **Risk** proxy labels are themselves selected (Want to See is biased toward popular titles); impression logging is what removes that over time.

### B3. Choice elicitation: pairs and groups instead of more ratings

**Hypothesis.** Ratings compress: 78% of the owner's are 6 to 8. Two or three "which would you rather watch tonight" questions carry more taste information than one rating, and a few of them from a new member identify the taste that 5 ratings cannot. Evidence: Kalloori and Ricci (2018) on pairwise preferences where absolute ratings saturate; Graus and Willemsen on choice-based cold start (less effort, higher satisfaction, with a popularity bias to manage); Chang, Harper and Terveen (CSCW 2015) on group-based elicitation in MovieLens, described on the GroupLens blog. Rashid et al. (IUI 2002) on which items to ask about.

**Data.** Obtain through product: a pairs table `user_choice (user_id, chosen, rejected, context, created_at)`; pairs drawn (a) within the member's own loved titles to order the 8s and 9s, (b) across the six shared kinds at equal public score to measure kind offsets fast, (c) between an unseen title and a rated one.

**Experiment.** Offline first, no product change: simulate pairs from the owner's ratings (a 9 beats a 7), fit a Bradley-Terry layer on top of the pooled score, and measure rank agreement on held-out time blocks against adding the same number of ratings. Then a two-week product test with volunteers: 20 pairs each, measure forward-rated agreement and the Want to See lift.

**Gain.** Medium for the owner's ranking, large for members under 40 ratings and for the profile (kind offsets become estimable from 20 pairs instead of 160 ratings). Confidence medium. **Cost** a UI, two weeks. **Risk** members may not do pairs; the quiz already exists, so the entry point is cheap.

### B4. The error floor: re-rating and import cross-checks

**Hypothesis.** A good part of the "69% unexplained" is the member's own noise. Knowing the floor sets the stopping rule for modelling and decides whether to show a number at all.

**Data.** Two sources. Obtain: ask the owner and ten volunteers to re-rate 50 titles drawn stratified by original rating, at least two weeks later, without seeing the first rating. Derive for free: `user_import_item` holds imported IMDb, Letterboxd and Trakt ratings with `date_rated`; where a member rated the same title on GoodWatch and on another service at a different date, the pair is a natural re-rating. Count such pairs in production first.

**Experiment.** Test-retest MAE and correlation per band; compare with the model's forward MAE from B1. If the re-rating MAE is 0.7, the pooled model at 0.85 to 0.9 has little headroom and effort moves to B2 and B5; if it is 0.3, keep modelling.

**Gain.** Changes the whole research agenda. Confidence high that it informs; unknown which way. **Cost** days. **Risk** fatigue effects in re-rating; keep it to 50 titles.

### B5. Calibrated, multi-kind lists: Sides of you as list composition

**Hypothesis.** A list that reflects the member's mix of kinds (Steck, RecSys 2018, "Calibrated recommendations"; survey arXiv 2507.02643) is more useful and more trusted than one sorted by score, even if each item's predicted rating is slightly lower. The six shared kinds the report found are the right partition because they are fixed and comparable across members. Evidence: the genre shift in my top-50 above.

**Data.** Have everything: kinds from `agents/profile/feats.py`, the pooled score, Want to See.

**Experiment.** Offline: build top-50 lists with KL-calibrated greedy re-ranking toward the member's loved-kind proportions and measure Want to See precision and recall against the plain list (B2 metrics), per kind. Online: Watch next and Discover "Best match" with a calibrated order behind a feature flag; measure Want to See adds and Not interested per impression.

**Gain.** Medium on offline proxies, possibly large on satisfaction. Confidence medium. **Cost** small; the re-ranker is fifty lines. **Risk** none beyond the metric debate.

### B6. Borrow 25 million ratings: pretrain on MovieLens 25M via TMDB ids

**Hypothesis.** The round-2 finding that "7,200 ratings cannot pin down how members differ" is a data-size statement, not a truth about taste. MovieLens 25M (25,000,095 ratings, 162,541 users, 62,423 movies, half-star 0.5 to 5) ships `links.csv` with `movieId, imdbId, tmdbId`, so item factors and taste axes learned there map straight onto GoodWatch movies, and the Tag Genome (1,128 tag relevance scores per movie) is a public analogue of the fingerprint for validating it. Prior work shows content embeddings trained on MovieLens transfer to a different movie dataset with little overlap (arXiv 2404.13808).

**Data.** Obtain: download from GroupLens (research use; no redistribution). Derive: a regression from the 74 fingerprint attributes plus text embeddings to the MovieLens item factors, so that shows and unrated movies get factors too.

**Experiment.** In the harness: replace the EM-learned taste axes with the top 10 to 20 MovieLens item factors (projected onto every pack title), fit each member's weights on them with the pooled shrinkage, and compare forward-time rho and the B2 ranking metrics with the current leader. Second test: fingerprint reliability, by regressing Tag Genome dimensions on the 74 attributes; attributes that predict nothing in the genome are suspects.

**Gain.** Medium for ranking of movies; nothing for shows directly. Confidence medium-low for the owner (consensus dominates), medium for other members. **Cost** two to three days. **Risk** domain shift (MovieLens raters are not GoodWatch members; ratings are older); license forbids redistribution, not internal modelling.

### B7. Shows: use watch state, not ratings, as the outcome

**Hypothesis.** For shows the honest "bad" signal is Dropped, On hold, or stopping after a few episodes, not a rating that only finishers give. A show-risk model from `user_watch_state` and `user_watch_log` will catch the shows a member abandons, which the rating model calls safe (3% bad).

**Data.** Have in production: `user_watch_state` (Dropped, On hold, Seen), `user_watch_log` per episode with timestamps, `imdb_episode` and season scores. Not in the pack; add to `build_pack.py`.

**Experiment.** Label every started show per member as finished, still watching, or dropped; fit the pooled columns plus season-decline and episode-count features; measure AUC of dropped against finished, time-ordered. Compare with the rating-based risk for the same shows.

**Gain.** Large for the show half of the catalog. Confidence medium-high that the labels disagree with ratings; medium that they are predictable. **Cost** a week. **Risk** few members have watch logs yet; imports (Trakt, Letterboxd) are the way to get more, and that pipeline exists.

### B8. Profiles people can recognise and edit, with an LLM pass that is also a predictor

**Hypothesis.** A natural-language profile written from the statement list and the member's own titles, which the member can edit, is both a better taste page and a usable input to prediction. Radlinski et al. (SIGIR 2022) set out the case for scrutable natural-language profiles; the Language-based Factorization Model (arXiv 2402.15623) found an LLM-written profile fed to a decoder predicts MovieLens ratings about as well as matrix factorization in cold start and better than direct LLM prediction. Warning from Kang et al. (2023): zero-shot LLM rating prediction is no better than trivial baselines, so the LLM writes and reads profiles, it does not guess numbers.

**Data.** Have: the statement list, examples, kinds. Obtain: one LLM pass per member (231 members, cheap), plus edits members make.

**Experiment.** Recognition test: show ten members three profiles (theirs and two others with similar rating counts) and ask which is theirs; the statement list should pass this before it ships. Prediction test: an LLM decoder given the profile and a title's essence text outputs a 1 to 10 distribution; score it in the harness on time-ordered blocks against the statement-list predictor. Edit test: let the owner strike or add a line and re-score.

**Gain.** Large for the taste page; small to medium for prediction. Confidence medium. **Cost** two days plus an LLM budget of a few dollars. **Risk** hallucinated lines; constrain the writer to the measured statements and examples.

### B9. Ask why: one-tap reasons on low ratings

**Hypothesis.** The 15 unexplainable bad titles (Tangled, The Raid, The Force Awakens) are unexplainable because the data has no "why". Reasons are labels the fingerprint lacks (expectation, mood that night, company, seen too late). Collecting them is cheap and yields the first direct view into the 69%.

**Data.** Obtain: on any rating of 5 or less, a chip row ("not my kind", "boring", "expected more", "too long", "bad ending", "wrong mood") written to `user_score.review` or a small table.

**Experiment.** After 200 reasons: cross-tabulate with the risk the model gave; if "wrong mood" and "expected more" dominate the low-risk bad titles, the error floor is contextual and no title-side feature will fix it; if "not my kind" dominates, the kinds are too coarse and B3 is the fix.

**Gain.** Decides where not to spend. Confidence medium. **Cost** a day. **Risk** low response rate.

### B10. Fingerprint reliability as a ceiling

**Hypothesis.** The fingerprint is one LLM pass per title with 0 to 10 integers. If the same title analysed twice gives attribute scores that differ by 2 points, the taste model is regressing on noisy inputs and "liking is monotone and linear in attributes" is partly attenuation. The glossary already has a Fingerprint verdict concept for reviewers.

**Data.** Derive: re-run the title analysis on 200 well-known titles with a different seed or model, compare per-attribute.

**Experiment.** Test-retest correlation per attribute; drop or downweight attributes under 0.6; re-run the pooled model on the reliable subset and with averaged double passes for the pack's 4,446 titles; measure forward rho.

**Gain.** Medium if reliability is low; also improves taste match and moods everywhere. Confidence medium. **Cost** LLM budget for 200 to 4,446 titles. **Risk** none.

### B11. Session and drift terms in the model itself

**Hypothesis.** Because members rate favourites first and in sessions (issue 1), a member's offset is not one number: it drifts by entry order. A model with a session or order-indexed offset will predict the next ratings better than one with a fixed offset.

**Data.** Have: `updated_at` on every rating.

**Experiment.** In the forward harness from B1, add the rating's rank in the member's history and days since the first rating as member-side covariates for the offset only; compare forward MAE.

**Gain.** Small to medium on MAE (the owner's mean moved by 1.1 points between quintiles), nothing on ranking. Confidence medium-high. **Cost** hours. **Risk** none.

## Part 3. Ranking

1. **B1, prospective logging and a forward-in-time harness.** It costs a day and corrects the one flaw that makes every number in the report optimistic, so every other branch is measured right from now on.
2. **B2, a choice model and a replayable ranking metric, with impression logging.** It measures the product's actual task, where the rating predictor already loses to a standardized cosine on the owner's own Want to See; nothing else can be judged without it.
3. **B4, the error floor from re-rating and import cross-checks.** A few days of data decide whether another modelling round can gain anything, which beats starting that round.
4. **B3, choice elicitation.** It changes what data exists at the point where the report finds the least signal (new members, compressed 6 to 8 ratings), and it feeds B2 and the profile directly.
5. **B5, calibrated multi-kind lists.** It is the cheapest product-visible change, it uses the report's one durable descriptive result (six shared kinds), and it repairs the crowding-out that the rating ranker produces; B6, B7 and B8 follow it because each needs either new data pulls or budget.

**Stop doing.**

- Stop racing owner MAE on random-split cross-validation with new title-side ingredients and stacks. The locked results already showed that development gains under about 0.05 do not transfer, and the forward-time test shows the protocol itself is wrong by more than any gain claimed.
- Stop using the locked quarter as the arbiter. It has been looked at three times across a dozen predictors and cannot confirm anything smaller than its own standard error; retire it and let prospective logging replace it.

Sources used for prior work: [MovieLens 25M README](https://files.grouplens.org/datasets/movielens/ml-25m-README.html), [MovieLens 25M](https://grouplens.org/datasets/movielens/25m/), [Tag Genome 2021](https://grouplens.org/datasets/movielens/tag-genome-2021/), [Steck 2010 on MNAR training and testing (talk)](https://new.videolectures.net/videos/kdd2010_steck_ttrs), [Schnabel et al. 2016, Recommendations as Treatments](https://arxiv.org/html/1602.05352), [Estimating Error and Bias in Offline Evaluation Results](https://ar5iv.arxiv.org/html/2001.09455), [Cremonesi, Koren and Turrin 2010](https://puma.uni-kassel.de/bibtex/04cb3373b65b03e03225f447250e7873), [Calibrated Recommendations survey](https://arxiv.org/pdf/2507.02643), [Steck 2018 slides](https://www.slideshare.net/slideshow/calibrated-recommendations/118205343), [Radlinski et al. 2022](https://arxiv.org/pdf/2205.09403), [Language-Based User Profiles for Recommendation](https://arxiv.org/abs/2402.15623v1), [Kang et al. 2023, Do LLMs Understand User Preferences](https://arxiv.org/abs/2305.06474v1), [Rashid et al. 2002, Getting to know you](https://www.academia.edu/11573721/Getting_to_know_you), [GroupLens on onboarding by groups](https://grouplens.org/blog/onboarding-new-users-in-recommender-systems/), [Kalloori and Ricci 2018 on pairwise preferences](https://ceur-ws.org/Vol-2140/paper5.pdf), [Graus and Willemsen on choice-based elicitation](https://ceur-ws.org/Vol-1679/paper4.pdf), [magic barrier, Said et al.](https://dai-labor.de/?p=6928), [Critique on Natural Noise in Recommender Systems](https://publiweb.femto-st.fr/tntnet/entries/17494/documents/author/data), [General Item Representation Learning for Cold-start](https://arxiv.org/pdf/2404.13808).
