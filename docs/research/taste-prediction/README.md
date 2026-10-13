# Taste and rating prediction: what three rounds of experiments found

Research from October 12 and 13, 2026. It started from the question "people don't have just one taste vector, so
how do we build a more sophisticated taste?" and became a benchmark: given everything a member has rated, how well
can we predict their rating of a title they have not rated, including the bad ones?

**Short answer.** The best predictor learns from all members, gives each member a few personal weights that start
from the consensus, and answers with a rating distribution instead of one number. For the member with the most
ratings (the owner, 993 ratings with a fingerprint) it ranks titles clearly better than today's taste but improves the
predicted score only a little; bad scores can be ranked and given an accurate risk, not predicted. For members with
few ratings the gain is large: a personal prediction beats everyone's score from about 5 ratings instead of about 80.
Clusters of loved titles, the idea behind Sides of you, predict nothing; "quality, plus kinds of titles rated above
or below their quality" does, and reads well.

Everything here is measured on production data read once into a local file. Nothing was changed in production and no
product code was written.

> **Read section 11 with this report.** Three independent reviews (in `reviews/`) found errors and limits that
> change what the results support. In short: the benchmark predicts ratings of titles a member already chose to
> watch, in random order, so it does not measure recommendations and is optimistic about predicting a member's next
> ratings; the readable taste has factual errors; several statements below are worded more strongly than the
> evidence allows. Section 10 is superseded by section 11.

## 1. The benchmark

- **Data.** One read-only pull from production Crate and Qdrant: 245,760 titles with a fingerprint, every member's
  ratings (9,016 ratings, 231 members), and for the 4,446 titles any member rated or saved: the 74 fingerprint
  scores, every public score with its vote count, genres, keywords, tropes, essence text and tags, cast and crew,
  franchises, per-season scores for shows, and the two text embeddings.
- **Task.** Hide a member's rating of a title, predict it from their other ratings, compare.
- **Members.** The owner is the main case. 22 other members with 60 to 350 ratings each are the second check, and
  members with 5 to 59 ratings were used for the few-ratings question.
- **Development and locked ratings.** A quarter of every member's ratings (the owner: 249, of them 24 rated 5 or
  less) was locked away outside the experiment folder. Agents worked only on the other three quarters, with
  cross-validation. The locked ratings were looked at three times, once per round, by the orchestrator only.
- **Measures.**
  - Average error: mean absolute difference in rating points (1 to 10).
  - Error on bad titles: the same, on titles rated 5 or less. The owner rated 94 of 993 that low.
  - Balanced error: the mean of the error on bad (1 to 5), middle (6 to 7) and high (8 to 10) titles, so a method
    cannot win by ignoring bad titles.
  - Rank agreement: Spearman correlation between predicted and actual ratings.
  - Bad-title ranking: the chance a bad title is predicted below a title that is not bad (AUC).
  - Skill, for other members: 1 minus (average error / average error of always guessing that member's mean).

**How much to trust the numbers.** The owner's locked set is 249 ratings: its average error has a standard error
near 0.04, so it confirms only large effects. The 22 other members are steadier. Differences under about 0.02 in
development are noise. One round-2 predictor scored 0.757 in development and 0.899 on the locked ratings; that gap
is the reason every claim below says where it was measured.

## 2. Before the loop: one member, simple methods

All 993 owner ratings, 20-fold cross-validation, before any locked split existed.

| Method | Average error | Rank agreement | Error on bad titles | Predicted for bad titles |
|---|---|---|---|---|
| The member's usual rating (7.1) for everything | 1.01 | none | 2.69 | 7.1 |
| Today's taste (one vector over raw fingerprints, `2P - N`) | 1.01 | 0.21 | 2.52 | 7.0 |
| Best of 4 clusters of loved titles (Sides of you as built) | 1.01 | 0.22 | 2.50 | 6.9 |
| Best of 14 clusters of loved titles | 1.02 | 0.13 | 2.64 | 7.1 |
| 30 most alike rated titles | 0.95 | 0.39 | 2.29 | 6.7 |
| One vector over standardized fingerprints | 0.91 | 0.45 | 2.09 | 6.5 |
| Everyone's score alone (GoodWatch score) | 0.90 | 0.47 | 2.04 | 6.5 |
| Linear weights on the 74 attributes | 0.88 | 0.50 | 2.00 | 6.4 |
| Boosted trees on the 74 attributes | 0.88 | 0.51 | 1.89 | 6.3 |
| Boosted trees on attributes plus title facts | 0.82 | 0.56 | 1.74 | 6.1 |

- Today's taste, turned into a score, is no better than guessing the member's usual rating. Standardizing the
  fingerprint against the well-known catalog is the largest single improvement to it (0.21 to 0.45 rank agreement).
- More clusters make prediction worse. Clustering only what a member loved leaves out both quality and dislikes.
- Everyone's score alone beats nearly every fingerprint-only method. The eight craft attributes alone reach 0.92:
  much of what looked like taste is quality.

Before the benchmark, the owner also looked at two pages: five taste definitions with their top picks, and five ways
to split loved titles into named groups (k-means as built, bottom-up merging into 14, groups around anchor titles,
overlapping trait blends, rating rules). The owner found interesting directions and recommendations in them. A
density method found no separate islands in the loved titles: one blob of 344 and one small group. Any grouping is a
way of cutting a continuum.

## 3. The loop

Ten agents over three rounds, each with one direction, one shared harness and one data file.

### Round 1: five directions

| Direction | Result |
|---|---|
| Structure in the fingerprint: mixtures of experts, attribute interactions, per-attribute curves, several taste directions | Nothing beats linear weights. Liking is monotone in the attributes that matter; there are no sweet spots. |
| People and franchises: cast, directors, writers, composers, studios | Under 1% of the remaining error for the owner. A per-member franchise effect helps other members a little. |
| Other members' ratings: neighbors, factorization, title graph, wishlist and skipped counts | Nothing for the owner. Only 23% of the owner's titles have five or more other raters, and 11% of the bad ones have even three. |
| Text and tags: tropes, keywords, essence tags and text, embeddings | Better ranking (0.55 to 0.59 on locked ratings). The drop in average error seen in development did not show on locked ratings. Individual tags do not survive once the fingerprint is known. |
| Output shape: how to get real scores out, especially bad ones | The one clear win. See below. |

**The output shape.** Ratings are whole numbers scored by absolute error, so the right answer is a median, not a
mean; rounding alone gains about 0.04. Better: predict the chance of each rating from 1 to 10, then answer with the
median, with rare bands counted more (one knob, `alpha`; 0.5 is the setting where nothing gets worse). This held
on locked ratings for the owner and the other members.

**Why predictions squeeze toward 7.** The squeeze is what an honest model with rank agreement 0.55 must do, not a
fault of the loss or of the imbalance. A classifier trained only to find bad titles is no better at it than the
regressor. Weighting bad titles up, stretching predictions afterwards, hard band classifiers, quantile models, and
using skipped titles as weak dislikes all failed.

### Round 2: combine, pool, describe

- **Combine everything** (text columns, franchise stage, monotone scores, linear stack, shape). Development: 0.757
  average error for the owner. Locked: 0.899, worse than the starting point. Stacking many small ingredients on 744
  ratings fits noise. Its gain for other members held.
- **Pool across members.** A hierarchical ridge: consensus weights learned from all other members on 160 title
  columns (74 attributes, six public scores, year, facts, genres, 51 text columns); each member gets an offset and a
  slope on that consensus, then personal weights shrunk toward the population's instead of toward zero. One
  closed-form solve per member. Best transfer to locked ratings. Details in section 5.
- **A readable taste.** A short list of typed statements that is also the predictor. Details in section 6.

Failed in round 2: taste axes learned from ratings (axes from one half of the members do not match the other
half's; 7,200 ratings cannot pin down how members differ), a global tree model with member summary features.

### Round 3: scores

The owner's request: use the public scores more, given the owner follows audiences over critics.

- The six main scores were inputs from the start. New this round: vote counts for every source and per-season
  scores for all 2,093 shows.
- **Held, for other members:** each member gets a personal weight on an audience composite and on a critic
  composite, drawn from the population of such weights. Skill +0.006 in development, 16 of 22 members better, largest
  at 20 to 40 ratings.
- **Nothing:** score reliability by vote count, missing sources, scores relative to a title's kind or era, curved
  response, popularity against score, season-level scores, the audience lean by kind.
- **Risk:** thirteen score-based inputs (source disagreement, audience minus critics, vote counts, hype, season
  decline, sequel, kinds, model disagreement) add nothing to the chance of a bad rating once the predicted score is
  known, for the owner and for the others. A positive control was found at five standard errors, so the test could
  see an effect. One change held: a proportional-odds form for the distribution (10 numbers per member instead of
  18) helps other members.

## 4. Results on the locked ratings

Owner: 249 ratings, 24 bad. Others: 22 members.

| Predictor | Round | Owner average error | Balanced error | Error on bad | Predicted for bad | Rank agreement | Bad-title ranking | Others' skill |
|---|---|---|---|---|---|---|---|---|
| The member's usual rating | | 1.07 | 1.61 | 2.99 | 7.1 | 0 | 0.50 | 0.00 |
| Everyone's score alone | | 0.99 | 1.37 | 2.39 | 6.5 | 0.45 | 0.79 | 0.06 |
| Linear weights on the fingerprint | | 0.94 | 1.32 | 2.33 | 6.5 | 0.48 | 0.81 | 0.08 |
| Boosted trees on attributes plus facts (start of the loop) | 0 | 0.87 | 1.18 | 2.03 | 6.1 | 0.55 | 0.83 | 0.09 |
| Same, with the distribution output | 1 | 0.84 | 1.11 | 1.83 | 6.0 | 0.57 | 0.84 | 0.14 |
| Same, with text columns | 1 | 0.87 | 1.18 | 2.01 | 6.1 | 0.59 | 0.85 | 0.12 |
| Everything stacked | 2 | 0.90 | 1.17 | 1.92 | 6.0 | 0.57 | 0.84 | 0.14 |
| Readable statements only | 2 | 0.90 | 1.24 | 2.17 | 6.3 | 0.55 | 0.84 | 0.08 |
| Pooled across members, continuous | 2 | 0.85 | 1.16 | 2.01 | 6.1 | 0.61 | 0.87 | 0.12 |
| Pooled, with the distribution output | 2 | 0.85 | 1.09 | 1.75 | 5.8 | 0.61 | 0.87 | 0.14 |
| Pooled, proportional-odds distribution | 3 | 0.85 | 1.11 | 1.82 | 5.9 | 0.61 | 0.87 | 0.16 |
| Pooled, personal audience and critic weights, distribution | 3 | 0.83 | 1.08 | 1.75 | 5.8 | 0.61 | 0.87 | 0.15 |

What is established:

- Ranking improved for the owner: 0.55 to 0.61, and bad titles are ranked below the rest 87% of the time instead
  of 83%.
- The predicted score barely improved for the owner: 0.87 to about 0.85. The move to 0.83 is inside the noise.
- Error on the owner's bad titles went from 2.03 to 1.75. The average prediction for a bad title is still 5.8.
- Other members' skill went from 0.09 to about 0.15. This held in every variant with the distribution output.

Not done: the two round-3 gains (personal source weights and the proportional-odds form) are in separate
predictors and have not been combined.

## 5. The model that won

1. **Consensus.** A ridge of other members' ratings (centred and scaled per member) on 160 standardized title
   columns. It correlates 0.70 with the GoodWatch score. Members here weight IMDb and TMDB up, critics slightly
   down, and popular titles down.
2. **Population.** Every member has an offset (how generous they are) and a slope on the consensus (how much they
   follow what members here like), estimated across members by EM: offset 7.39 with standard deviation 1.25, slope
   0.61 with standard deviation 0.37.
3. **The member.** Offset and slope in closed form from their ratings, then a ridge on all columns for what is left,
   shrunk toward the population's weights. Round 3 adds two personal weights, on audience and on critic scores.
4. **Trees.** From 20 ratings on, per-member boosted trees with the text columns are blended in with weight
   `0.5 * n / (n + 100)`.
5. **Output.** A rating distribution from an ordinal model on the out-of-fold score; the answer is the
   band-weighted median (`alpha` 0.5), ties broken by the continuous score.

### Few ratings (development ratings only)

Skill against the mean of a member's visible ratings, 5-fold within each member.

| Method | 5 to 9 ratings (21 members) | 10 to 19 (53) | 20 to 39 (57) | 40 to 59 (14) |
|---|---|---|---|---|
| Everyone's score, calibrated per member | -0.19 | 0.01 | 0.01 | 0.08 |
| Boosted trees per member | 0.00 | 0.00 | 0.02 | 0.08 |
| Pooled model | 0.12 | 0.09 | 0.09 | 0.16 |

- Without pooling, a personal model needs about 80 ratings to clearly beat everyone's score.
- With pooling it wins from 5: better than the calibrated public score for 19 of 22 members at 5 and at 10
  visible ratings (subsampled from members with 60 or more).
- Pooling is worth about four times the ratings: 20 with pooling predict as well as 80 without.
- The 5-to-9 group was never looked at during development and shows the largest gain.
- At 5 ratings the main error is the member's own average and spread, not their taste.

These members have no locked check: the locked split only covers members with 40 or more ratings.

### Risk beside the score

The chance of a rating of 5 or less is accurate at every level (owner, cross-validated, development):

| Risk shown | Titles | Bad predicted | Bad observed |
|---|---|---|---|
| under 5% | 380 | 2.5% | 1.0% |
| 5 to 10% | 164 | 7.2% | 6.7% |
| 10 to 20% | 110 | 14.0% | 17.8% |
| 20 to 30% | 38 | 24.9% | 28.1% |
| 30 to 40% | 23 | 34.8% | 39.7% |
| 40 to 50% | 13 | 43.7% | 44.7% |
| 50 to 70% | 12 | 57.6% | 57.1% |
| over 70% | 5 | 76.3% | 78.6% |

- A predicted 4 is justified for 2 to 5 of 744 titles, a 3 never. A predicted 5 is justified for about 16.
- 15 of the owner's 70 bad titles have a risk under 10% and look good on every score (Tangled, The World's End,
  The Bourne Supremacy, The Raid, Star Wars: The Force Awakens). Nothing in the data separates them.
- Flagging titles at 20% risk or more catches 36 of 70 bad titles with 40% precision.
- For other members the risk is calibrated too; their full ten-way distribution is no sharper than their own
  histogram, so show the risk, not ten bars.

## 6. A readable taste

A short ordered list of typed statements. Each is measured on what the statements before it leave unexplained, so
the effects add up, and the list is itself a predictor.

| # | Statement | How it is computed |
|---|---|---|
| 0 | "Your usual rating is X" | Mean rating |
| 1 | "10 points more public score gives X more from you" and "you side with audiences / critics" | Least squares on the public score and the audience-minus-critic gap |
| 2 | "You rate [kind] X above / below what its quality predicts" | Mean leftover rating per kind, six shared kinds, shrunk |
| 3 | "Titles that are [a sequel, animated, a series, not in English, before 1990, ...]: X above / below the rest" | Difference in leftover rating; at most four shown |
| 4 | "More [theme], less [theme]: X points" | Slope on one of 16 description axes; at most two shown |
| 5 | "When these add up to a high score, you rated A on average and gave a low score to B%" | Ratings by third of the list's own prediction |

- **Six shared kinds**, fixed for everyone, from a clustering of the catalog without ratings: irreverent comedy and
  satire; warm human drama and romance; big spectacle adventure; strange, stylized and mind-bending; light,
  easygoing comedy; tense crime, thriller and war.
- **Six beat every alternative**: 8, 12, 16 or 20 shared kinds, per-member regions, genres, and clusters of loved
  titles (which added nothing for the owner and made other members worse).
- **Replication.** Written from half of a member's ratings and re-measured on the other half, statements keep their
  sign 86 to 100% of the time for the owner and 82 to 97% for other members, close to the ceiling the noise allows.
  Unshrunk effects come back at 0.3 to 0.5 of their size, so every effect is shrunk before it is shown.
- **Dropped:** single attribute dials and genres on top of the kinds. They do not replicate.
- **Rules for showing a statement:** 90% interval excludes zero, at least 8 titles on each side, effect at least
  0.15 points. "Well made" from 40 ratings, everything else from 80; kinds are solid from 160. Under 80 ratings a
  member gets zero or one statement.
- **Price of readability.** For the owner the list predicts as well as boosted trees in development (0.819 against
  0.818). On locked ratings it is behind (0.90 against 0.87 for the trees and 0.85 for the pooled model), and for
  other members it loses ranking (0.33 against 0.40 rank agreement).

Open: theme names are machine-made and read roughly. The statements have not been re-measured on the locked
ratings.

The owner's own list is in [owner-taste.md](owner-taste.md).

## 7. What the experiments say about the owner's taste

- **Quality first, and with audiences.** About 28% of the spread in ratings is "well made", about 3% is
  fingerprint taste beyond that, and about 69% is unexplained by anything tried. Audience scores carry 85% of the
  score weight, critics 15%.
- **That lean is not unusual.** The median member here gives audiences 78%, and 17 of 21 weight audiences over
  critics. The owner follows the public score more than most (rank agreement 0.48 against 0.26).
- **Above their quality:** strange and stylized (+0.3; The Matrix, Code Geass, Mulholland Drive), irreverent comedy
  and satire (+0.2; Hot Fuzz, Life of Brian, Idiocracy).
- **Below their quality:** big spectacle adventure (-0.3), the most-watched kind.
- **Sequels.** Rated half a point below the public; 25% of sequels got 5 or less, against 7% of everything else.
  By franchise entry: first or standalone 7.25, second 6.68, third 6.16.
- **Names are a symptom.** Bruckheimer, Bay and Emmerich titles are rated low, Zemeckis, Nolan and Miyazaki high,
  but what their titles are like explains it; the names add nothing.
- **Risk follows the audience score.** IMDb under 6.0: 40% bad. 6.0 to 7.0: about 20%. Above 7.5: 1 to 2%. Shows
  are safe (3% bad), probably because a show is rated only after choosing to keep watching.
- **High predictions are trustworthy, middling ones are risky.** No bad titles in the top third of predictions.

## 8. What did not work

- Clusters of loved titles as a predictor, with any number of clusters.
- Structure in the fingerprint beyond linear weights.
- Person effects for one member; studio effects; title-name families.
- Other members' ratings at today's density; the TMDB recommendation and similar graph.
- Individual tags and tropes after the fingerprint; the multilingual embedding.
- Skipped and Want to See titles as weak labels. A test title's own favorite or Want to See membership leaks the
  rating and must never be an input.
- Stretching predictions, band-weighted losses, hard band classifiers, quantile models.
- Stacking many small ingredients.
- More score detail: vote-count reliability, missing sources, relative scores, season scores, source disagreement
  as a risk input.
- Shared taste axes learned from ratings.

## 9. Limits

- One member carries the main result. The owner is unusual: far more ratings than anyone, and closer to the public
  score than most.
- 9,016 ratings in total. Anything that needs many raters per title could not be tested fairly.
- Members only rate what they chose to watch, so bad ratings are rare (the owner: 9%) and the benchmark says little
  about titles a member would never pick.
- The locked ratings were looked at three times. Each look makes small differences on them less trustworthy.
- The few-ratings result and the readable-taste replication are measured on development ratings only.
- How consistent a member is with themselves is unknown, so the lowest reachable error is unknown.
- Nothing here measures whether better predictions make better recommendations: no ranking-of-unseen-titles test,
  no click or watch outcome.

## 10. What to build, in order of confidence

1. The pooled model for members with few ratings, in place of today's single vector, with taste match shown from
   the first handful of ratings.
2. The risk of a low rating beside the predicted score, in place of forcing low numbers.
3. The statement list in place of Sides of you, behind the showing rules above, with hand-written theme names.
4. Standardized fingerprints wherever a single vector stays in use.

## 11. After review: corrections and what the results support

Three reviewers worked alone from this report, the lab code and the development ratings (Fable 5.1, GPT-6 Astra,
GPT-6.1 Sol; all at high effort). Their full reviews are in `reviews/`. Numbers here are theirs, measured on the
development ratings unless stated; none of it was re-run by the orchestrator.

### Corrections to this report

- **The sequel flag is wrong for some titles.** `agents/profile/feats.py` treats numbers in names as sequel
  evidence. It marks 8 Mile, District 9, Super 8 and Menace II Society as sequels; the last appears in
  `owner-taste.md` as a loved sequel. (Astra and Sol, both verified.)
- **"No bad titles in the top third" is 1 of 248**, shown as 0%. The trust statement in the readable taste is
  computed on the ratings it was fitted on. (Astra, Sol.)
- **"About 69% unexplained" is the figure for public scores plus fingerprint.** From the ledger, the pooled
  predictor explains about 37% of the owner's rating variance in development, leaving about 63%. A "quality first,
  taste second" split also depends on the order of fitting; public approval is itself preference data. (Sol.)
- **"Rounding alone gains about 0.04" mixed two changes.** The reference predictor also added monotone score
  constraints. Rounding the unchanged baseline moves owner error 0.818 to 0.785 and slightly worsens error on bad
  titles (1.65 to 1.67). (Sol.)
- **Skill is measured against three different baselines** in the main, few-ratings and locked tables (the mean of
  all development ratings, the mean of visible ratings, the development mean). They are not on one scale. A
  member's median is a stronger constant than their mean: it alone scores 0.053 skill for the 22 members. (Astra,
  Sol, Fable.)
- **The six kinds were clustered over the 4,446 titles in the data file**, not the catalog. (Sol.)
- **The band-weighted median is a decision rule, not a better estimate.** `alpha` is a product choice between
  ordinary error and error on rare bands. On the same pooled model, rounding gives other members 0.152 skill and
  the weighted distribution 0.123 (development). (Astra, Sol.)
- **Null results are limits of these tests.** "No sweet spots", "names add nothing", "nothing separates them" and
  "bad scores cannot be predicted" should read "the tested models did not find it". The owner has seven
  development ratings of 3 or less.

### Limits that change what should be built

- **Random holdouts are not the product's task.** Members rate favourites first and in large sessions: 88% of all
  ratings fall on each member's busiest day, and 401 of the owner's 744 development ratings on two days. Fable
  predicted the owner's later half from the earlier half with boosted trees: error 0.908 and rank agreement 0.451,
  against 0.869 and 0.522 on random halves; for the 22 others a ridge model's skill fell from 0.050 to -0.017. Sol
  tested the owner's last quarter and found 0.864 against 0.840 for random quarters, inside their range (0.768 to
  0.903). So the size of the effect is disputed; that the leaders were never tested forward in time is not. Rating
  write time is also not watch time.
- **Recommendation was not measured, and the rating predictor may be the wrong tool for it.** As a rough stand-in,
  Fable separated the owner's unrated Want to See titles (272) from titles passed in the taste quiz (132): GoodWatch
  score 0.60, predicted rating 0.63, today's taste on standardized fingerprints 0.66 (AUC). Titles the owner passed
  on get a predicted rating of 7.1 on average. A top 50 by predicted rating opens with Fight Club, GoodFellas and
  The Godfather, and is 58% shows and 40% animation, because the owner only rates shows they finished.
- **The few-ratings gain is mostly a sensible starting point, not personal taste.** With personal weights off, the
  pooled model keeps most of its gain at 5 to 9 ratings (Fable). Astra reproduced the gain against the stronger
  median baseline in every group (5 to 9 ratings: 1.25 against 1.35 error). Both agree pooling helps; it does not
  show that five ratings are enough for good recommendations.
- **The locked ratings are spent.** They were not untouched: the pre-loop comparison used all owner ratings, and
  each round's locked results were in the next round's brief. Choosing the best of about twelve predictors on 249
  ratings is worth roughly one standard error by itself, so 0.87 to 0.85 is what noise alone would show.
- **"Shows are safe" is the owner's pattern only.** Bad show ratings: owner 3%, the 22 others 26%.
- **Taste match would change meaning.** Today it is fingerprint fit within the member's own range. A pooled
  prediction includes public scores and generosity. Under a quality sort plus For you it could count public quality
  twice.
- **Sides of you was tested as a predictor, which it is not.** It is a description and a way to compose a list.
  Whether members recognise it, and whether a list drawn from several sides is better received, was not tested. The
  readable statements were not tested on readers either; half of them are true of nearly every member.

### What the results support

1. Standardized fingerprints wherever a single taste vector is used. Largest gain for the least work, and the best
   of the methods on the Want to See stand-in.
2. The pooled predictor as a candidate scorer, to be tested forward in time and on recommendation outcomes before
   it replaces anything.
3. A shrunk starting average on a consensus score for new members.
4. Risk of a low rating as a research output, pending a forward-in-time calibration check.
5. Not yet: replacing Sides of you, or showing the statement list, before its facts are fixed and members have
   judged it.

## Files

- `lab/harness.py`: the benchmark. Its docstring is the predictor contract.
- `lab/README.md`, `lab/ROUND1.md`, `lab/ROUND2.md`: the briefs the agents worked from.
- `lab/ledger.jsonl`: every scored run. Other members appear by the first 8 characters of their id.
- `lab/agents/<name>/`: each agent's code, and its report where one was saved.
  - Leaders: `pooled/pool.py`, `pooled/best.py`, `pooled/h_shape.py`, `scores/smodel.py`, `scores/best.py`,
    `risk/om.py`, `risk/best.py`, `badscores/shape.py`.
  - Readable taste: `profile/lib.py`, `profile/feats.py`, `profile/render.py`.
- `lab/build_pack.py`, `lab/add_scores.py`: the read-only pull that builds the data file. `lab/lock_eval.py`: the
  locked check. `lab/variants.py`, `lab/groups.py`, `lab/bench.py`: the pre-loop comparisons.
- Not in the repository: the data file with members' ratings, the locked ratings, and cached features. They were in
  a session scratchpad; `build_pack.py` rebuilds the data file, with a different random split unless the seed (11)
  and the ratings are unchanged.
