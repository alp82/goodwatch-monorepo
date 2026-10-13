# Next branches: taste, recommendations and score prediction

Merged from three independent reviews of [the report](README.md) (Fable 5.1, GPT-6 Astra, GPT-6.1 Sol; full texts
in `reviews/`). Each branch names who proposed it. Gains are the reviewers' expectations, not measurements. Order is
the orchestrator's merge of their three rankings.

All three reviewers ranked measuring recommendations first or second, put asking members better questions and
measuring re-rating consistency in their top five, and said the same two things should stop.

## Stop

- Model and feature sweeps on the same ratings and the same locked quarter. Freeze the candidates: today's taste,
  standardized fingerprints, calibrated public score, the pooled predictor.
- Using rating error to decide about Sides of you, taste structure, or risk shown on unseen titles.
- Turning Skip, Want to See, Not interested or Dropped into invented ratings. Each keeps its own meaning.

## 1. A forward-in-time test, and predictions stored when a member rates

Proposed by Fable; Astra and Sol ask for time cutoffs and fresh ratings.

- **Why.** The benchmark hides random ratings. The product predicts the next ones, and members rate favourites
  first, in sessions. Every number in the report may be optimistic, by an amount the reviewers disagree on.
- **Data.** Have: `updated_at` on every rating. Add: a row per rating with the prediction, risk and taste match the
  server would have shown, the model version, and how many ratings the member had. No member-facing change.
- **Experiment.** Add a time-ordered split to `lab/harness.py`: sort by write time, group ratings written in one
  bulk session, predict each later block from everything before it. Re-score every frozen candidate. After a few
  hundred stored predictions, compare model versions on ratings nobody has looked at.
- **Expected.** Changes which model wins more than it changes a number. About a day for the harness, a day for the
  logging.
- **Risk.** Write time is not watch time; bulk imports must be treated as one moment.

## 2. Measure recommendations

Proposed by all three (Astra A, Sol A, Fable B2).

- **Why.** "Would pick this" and "would rate this highly, having picked it" are different. On a rough stand-in the
  rating predictor already loses to today's taste on standardized fingerprints.
- **Three steps, cheapest first.**
  1. **Offline, with data we have.** Add `user_not_interested` and Want to See dates to the data pull. For every
     candidate scorer, rank a member's unrated titles and measure how well Want to See separates from Not
     interested and quiz Skip, the lift in the top 50, and recall of the member's most recent Want to See adds.
     Fable's first numbers for the owner: 0.60 public score, 0.63 predicted rating, 0.66 standardized taste.
  2. **A blind judged pool.** About 30 members across history sizes. Each sees about 24 eligible unseen titles
     mixed from today's recommendations, the pooled predictor, Sides-based retrieval and a random sample, without
     knowing which method chose which. They answer: know it already, looks appealing, Want to See. Compare useful
     suggestions in the first ten.
  3. **Exposure logging.** Record what was shown: surface, position, candidate set, model version. Randomize one
     slot among eligible candidates and store the probability, so later methods can be replayed on real choices.
- **Expected.** High confidence it changes what gets built. One to two weeks plus recruitment.
- **Risk.** Want to See leans popular; clicks measure curiosity. Thirty members is a small panel.

## 3. Find the error floor

Proposed by all three (Astra D, Sol D, Fable B4).

- **Why.** Nobody knows how consistent a member is with themselves. If re-rating differs by 0.7 points, a predictor
  at 0.85 has little room left and modelling should stop; if 0.3, there is room.
- **Data.** Obtain: about 20 to 30 members re-rate 12 to 50 titles after two weeks or more, old rating and
  predictions hidden, sampled across low, middle and high. Derive first, for free: where `user_import_item` holds a
  rating of the same title from another service at another date, that pair is a natural re-rating. Count those
  pairs before recruiting anyone.
- **Experiment.** Average difference, crossings of the 5-or-less line, stability of pairwise order. Keep both
  ratings.
- **Expected.** Decides the research agenda. A few engineering days, several weeks elapsed.
- **Risk.** Genuine changes of opinion and rewatches look like noise. Shown predictions shift ratings, so hide them.

## 4. Ask informative questions

Proposed by all three (Astra B, Sol B, Fable B3).

- **Why.** 78% of the owner's ratings are 6, 7 or 8, and the median member has 15 ratings. A few chosen questions
  may say more than a few more ratings. Pairs also sidestep how differently members use the scale.
- **Data.** Obtain: a table of choices (chosen, rejected, context). Kinds of question: which of two known titles
  did you enjoy more; pairs across the six kinds at equal public score; "a widely loved title that disappointed
  you"; a direct question such as "ideas, characters or action". "Haven't seen it" is never a dislike.
- **Experiment.** Offline first: from five visible ratings, compare three more random ratings with three chosen
  questions simulated from held-out ratings; then fit pairs on top of the pooled score. Then an onboarding test
  with a fixed question budget, measured on later ratings and on step 2's outcomes.
- **Expected.** Medium confidence. Target: five chosen answers worth ten random ones. One to two weeks.
- **Risk.** Obscure titles, fatigue. Keep "enjoyed more" apart from "would watch tonight".

## 5. Sides as a way to compose a list, and a taste members can check

Proposed by Fable B5, Astra C and E, Sol E and G.

- **Why.** A list sorted by one score crowds out a member's lesser interests: comedy is 13% of what the owner
  loves and 9% of the top 50. Several interests may also find candidates one vector misses.
- **Experiments.**
  - Re-rank toward the member's own mix of kinds, cap franchise repeats, keep a relevance floor. Judge with step 2.
  - Retrieve candidates from three or four interests, score all with the same frozen predictor, compare coverage
    with one-vector retrieval.
  - Show members three versions: Sides, the statement list, a combination. Can they pick their own among three
    members' descriptions? Which lines are wrong? Let them correct a line.
- **First fix the facts.** Sequel membership from franchise data, trust numbers from held-out predictions, plain
  wording ("among titles you rated, you tend to rate these above their public score").
- **Expected.** The re-ranker is small; the reader test is about a week. Medium confidence on satisfaction.

## Further branches

- **Ask why on low ratings.** One tap after a rating of 5 or less: not my kind, boring, expected more, too long,
  bad ending, wrong mood. After about 200 answers it shows whether missed bad titles are about the title or the
  evening. (Fable B9, Astra F, Sol C.) A day to build.
- **Shows: watch state as the outcome.** Finishing, pausing and Dropped as separate outcomes, predicted from what
  was known at that episode. They are not ratings. (Fable B7, Astra H.) Needs `user_watch_state` and
  `user_watch_log` in the data pull; few members have logs yet.
- **Borrow collaborative structure.** MovieLens item factors mapped through TMDB ids, as columns in the pooled
  model. Movies only. Commercial use needs permission from GroupLens. (Fable B6, Astra G, Sol H.) Low to medium
  confidence.
- **Audit the fingerprint.** Analyse 200 well-known titles twice and compare attribute by attribute; check against
  an independent tag set. Noisy attributes would explain why only linear effects showed. (Fable B10, Sol I.)
- **A smaller pooled model with stronger baselines.** A fixed ladder from the member's median up to text columns,
  one output convention, an owner-excluded fit, pooled thresholds for members with few ratings. (Sol F, Astra I.)
- **An editable written taste.** A model writes the description from measured statements only; the member edits it;
  test whether it also predicts. (Fable B8.)
- **Tonight versus taste.** Mood, time available and company as session context on top of a fixed taste ranker.
  (Astra H, Sol G.)
- **Rating order in the model.** A member's average drifts as they move from favourites to the rest; an offset that
  depends on position in their history. (Fable B11.) Hours, once the forward-in-time test exists.

## Where the reviewers disagree

- **How large the time effect is.** Fable: large and clear, for the owner and the others. Sol: for the owner's last
  quarter, inside the spread of random splits. Branch 1 settles it.
- **How much of the few-ratings gain is personal.** Fable: little, a shrunk starting average does it. Astra: the
  full pooled model beat a model with only score, offset and slope in every group.
- **Whether to show risk.** All three want a forward-in-time calibration check first; Fable would still show risk
  instead of forcing low numbers, Astra and Sol would keep it internal for now.
