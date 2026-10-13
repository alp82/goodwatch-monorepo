# A research loop for taste, recommendations and score prediction

Design by Opus 5.5, working alone from the brief, the report, the three reviews, the lab code and read-only
analyses of the old data file. Product terms follow `CONTEXT.md`. Numbers marked **verified** were computed by me
on `pack.pkl` (7,210 development ratings, 231 members, 4,446 titles); everything else is taken from the report or
the reviews, or is a design choice.

Terms used below, defined once:

- **Entry order**: the order in which a member wrote their ratings, by write time.
- **Moment**: ratings written less than 2 seconds apart. A moment of 5 or more ratings is a bulk write (an import
  or a guest transfer), not a sitting.
- **Forward test**: predict a member's later ratings from their earlier ones, in entry order.
- **Pack**: one dated, immutable data file built from a read-only pull of production.
- **T0**: the time of the first new pull. Everything written after T0 is unseen by construction.
- **Frozen candidate**: a scorer whose code hash is recorded in the ledger before the data it is judged on exists
  or is opened.
- **Paired difference**: candidate minus reference, computed per member (or per title for one member), then
  averaged. Uncertainty always belongs to this difference, never to each method's number alone.
- **Smallest detectable effect**: the paired difference this data can find four times out of five. The harness
  prints it for every comparison.

## 1. Goal

The loop exists so that three things become true for members. The titles GoodWatch puts first under For you and
Best match are more often titles the member wants to watch and did not know. A new member gets a useful Taste
from their first sitting. And what GoodWatch tells a member about themselves (a Taste match, a predicted score or
a risk if one is ever shown, Sides of you or any other description) is true: it holds on what they do next, and
they recognise it. The loop is **not** trying to lower rating error on titles members already chose to watch, to
find a better model form on the same 9,000 ratings, or to write product code. Its outputs are decisions with
evidence, and specifications for the product work those decisions need.

The loop must be able to make three decisions. Each has a default that stands when the evidence cannot tell the
candidates apart: the simplest candidate wins.

| | Decision | Candidates | Evidence that settles it | Default if indistinguishable |
|---|---|---|---|---|
| D1 | Which scorer orders titles under For you and Best match | Today's taste (`2P - N` on raw fingerprints), the same on standardized fingerprints, the pooled predictor | Offline ranking of later Want to See adds (task T2) as a screen; blind judged pools (T3) as the decider: the owner first, then a panel of 20 or more members | Standardized fingerprints: smallest change, keeps the meaning of Taste match |
| D2 | Whether GoodWatch shows a member a personal predicted score or a risk of a low rating | Nothing new; public score plus the member's offset; the pooled predictor with a risk | Forward rating error (T1) against the member's own re-rating consistency (T4); calibration of the risk on ratings written after T0 | Show nothing new |
| D3 | How a member's Taste is described | Sides of you as built; the statement list with its facts fixed; both together | Can a blind reader tell whose description it is (T5), then can members, and which lines they mark wrong | Keep Sides of you; use sides to compose lists only if T3 shows it helps |

A standing question steers the loop itself: **is there room left to predict ratings at all?** T4 answers it for the
owner in the first session. If the room is small, rating models stop for good and the effort goes to D1, to asking
members better questions, and to instrumentation.

## 2. Benchmark setup

### 2.1 What I verified on the old data file, and what it changes

1. **Most ratings were typed one at a time, seconds apart.** Only 760 of 7,210 ratings sit in bulk writes (one
   member has 347 at a single instant). Typical gaps inside a sitting are 3 to 15 seconds. So entry order inside a
   sitting is real and can be tested. The "88% on the busiest day" figure means long sittings, not imports.
2. **A later-day test is almost only the owner.** Only 30 members have ratings on two or more days. Ratings that
   have 5 or more ratings from earlier days: 1,117, of which 711 are the owner's and 130 are one other member's.
   A forward test "predict the next sitting" cannot support a claim about members in general. Only ratings written
   after T0 can.
3. **An entry-order test has enough data.** Predicting each block of a member's ratings from all ratings before it
   (blocks start at 5, 10, 20, 40, 80, 160, 320, 640 ratings) gives 5,520 targets from 158 members other than the
   owner, 117 of them with 10 or more targets, and 739 targets for the owner. Only 322 of the others' targets fall
   in a later sitting.
4. **What that test can see.** For two simple baselines (the member's median so far; GoodWatch score plus a shrunk
   offset) the per-member paired difference in average error has a standard deviation of 0.43 rating points. With
   117 members the smallest detectable effect is about 0.11 points. Other members' error is about 1.45, so this is
   about 8%. Most differences the old loop argued about are smaller than this benchmark can resolve.
5. **Simple baselines show no entry-order penalty.** Median so far: 0.025 points worse in entry order than in
   random order (95% interval -0.01 to 0.06, 107 members). Score plus offset: -0.014 (-0.04 to 0.01). The disputed
   time effect is therefore about fitted models and about the owner's later days, not about the whole population.
   Others' mean rating falls only from 7.38 in the first fifth of entry order to 7.00 in the last.
6. **The Want to See stand-in, across members.** For the 19 members with a taste and 10 or more each of unrated
   Want to See and quiz Skip titles, the chance that a Want to See title is scored above a skipped one (AUC) is:
   GoodWatch score 0.54 (0.50 to 0.58), today's taste on raw fingerprints 0.55 (0.48 to 0.62), on standardized
   fingerprints 0.59 (0.52 to 0.65). Standardized minus raw: +0.038 (0.009 to 0.068). Standardized minus GoodWatch
   score: +0.049 (-0.012 to 0.11), not settled. The stand-in is confounded: skipped titles are more popular than
   Want to See titles (popularity AUC 0.46), because the quiz shows well-known titles. It resolves about 0.03
   between similar scorers and only 0.06 to 0.08 between dissimilar ones.
7. **Want to See is an input to today's taste** (weight 0.5 in `taste/formula.server.ts`). Any test that uses
   Want to See as the label must build the taste only from what was written before the labels.
8. **Re-rating error converts to an error floor by a fixed factor.** Simulated on a 1 to 10 whole-number scale
   with equal, independent noise on both ratings: the best possible predictor's average error is 0.71 times the
   average difference between two ratings of the same title, at every noise level from 0.3 to 1.3 points.

### 2.2 Tasks

One harness, one predictor contract (2.4), five tasks. T1 and T2 run offline on a pack. T3 and T4 need the owner
for about 15 minutes each. T5 runs offline with model readers, then with members.

**T1. Forward rating prediction.** Feeds D2 and the cold-start part of D1.

- Protocol: per member, sort ratings by write time. Block boundaries at 5, 10, 20, 40, 80, 160, 320, 640 ratings,
  moved to the nearest moment boundary. Predict each block from everything the member wrote before it: ratings,
  Want to See, Skip, Not interested, each with its time. Bulk writes count as history and are never targets.
- Other members: all their ratings are visible (leave one member out). This matches the product, where a new
  member is scored with today's population. Finalists are also run once with only what others had written before
  the block; the gap is reported.
- Labels: the whole-number rating. Eligible titles: those with a fingerprint. Eligible members: 6 or more ratings.
- Strata, always reported apart: target in the same sitting as the history (the onboarding case); target in a
  later sitting, 6 hours or more after the last history rating (the returning case, mostly the owner); by block;
  movies and shows; the owner alone; a fit with the owner left out of the population.
- Primary measure: average error of the rounded prediction, per member, averaged over members with 10 or more
  targets, as a paired difference against the reference rung of the ladder.
- Guards: (a) pair accuracy: among a member's target pairs with different ratings, the share ordered correctly
  (replaces rank agreement, which ties dominate); (b) low-rating AUC within member, for members with 5 or more
  low and 5 or more other targets; (c) Brier score of the chance of a rating of 5 or less, against the member's
  own smoothed share of low ratings so far, with a reliability table that shows counts; (d) average error on low,
  middle and high ratings, reported, never optimised.

**T2. Ranking of unseen titles, offline.** A screen for D1, not the decider.

- Protocol: per member, sort Want to See adds by `created_at` and group them into moments. A moment of 10 or more
  adds is a transfer: history only. Targets are the adds in the last 40% of the member's moments, at least 3.
  History is everything the member wrote before the first target.
- Candidates: every title in the reference pool (a poster, a GoodWatch score, 1,000 or more votes; about 58,600
  titles) that the member had not rated, watched, added, skipped or marked Not interested before the cutoff.
  Targets outside the pool are dropped and their share is reported. The whole pool is ranked; no sampled
  negatives.
- Primary measure: the mean percentile rank of the targets (0.5 is random, 1.0 is perfect), per member, averaged
  over members; paired against today's taste.
- Guards: targets in the first 50; median vote count of the first 50 (a scorer must not win by being a popularity
  list; vote count alone is on the ladder); share of shows and of animation in the first 50 against the member's
  own mix; mean percentile of titles later marked Not interested (should be low); Want to See against quiz Skip
  AUC as in 2.1, labelled as a stand-in.
- How to read it: members add what they were shown, so the result leans toward popular titles and toward whatever
  ordered the lists at the time. A challenger that beats today's taste here has done so against that lean. A
  challenger that loses by less than the smallest detectable effect is not eliminated. Record the date the
  taste-sorted surfaces went live and report adds before and after it apart.

**T3. Blind judged pool.** The decider for D1.

- Protocol: for one member, take the eligible titles (reference pool, Not seen yet applied). Take the first 12
  from each scorer (today's taste, standardized taste, pooled predictor, GoodWatch score alone as the
  non-personal control) and 8 drawn at random. Remove duplicates, shuffle, hide which scorer chose which. Every
  frozen candidate's full ranking is hashed into the ledger before the member sees the pool.
- The member marks each title: Seen it (then rates it); Want to See, knew it; Want to See, new to me; Not for me;
  Can't tell. Nothing is written to production.
- Primary measure: hits in a scorer's first 10, where a hit is a Want to See title the member has not seen,
  paired against today's taste. Guards: new-to-me hits; Not for me in the first 10; seen titles rated 8 or more
  (right, but no discovery); repeats of one franchise.
- The owner does one fresh pool per session (about 45 titles, 15 minutes). Three pools give 30 slots per scorer.
  That is evidence about one member. The population answer needs the panel (2.7).

**T4. Re-rating consistency: the error floor.** Steers the loop and feeds D2.

- Protocol: the owner rates again 120 titles rated 14 or more days ago: 40 rated 5 or less, 40 rated 6 or 7, 40
  rated 8 or more, drawn by a seeded script. The page shows poster, title and year only: no old rating, no score,
  no prediction. Buttons: 1 to 10, Don't remember, Rewatched since. Both ratings are kept; production is not
  changed.
- Measures: average difference weighted back to the owner's rating mix, exact agreement, crossings of the
  5-or-less line, share of pairs whose order flips. Floor = 0.71 times the average difference (2.1 item 8; the
  harness repeats the simulation with the observed spread).
- Free additions, counted on day one: pairs in `user_import_item` where `prior_score` and the imported rating
  both exist; later, ratings whose value differs between two packs.

**T5. Whose Taste is this.** Screens D3.

- Protocol: for each member with 40 or more ratings, write each description (Sides of you, statement list, both)
  from the first 70% of their ratings in entry order. A blind reader gets one description and three lists of 15
  later ratings: the member's own and two from members matched on rating count and mean rating. The reader picks.
  Titles named in the description are removed from the lists.
- Readers: Haiku 5.5 and gpt-6-astra, run apart. Primary measure: share picked correctly against 33% chance,
  per format, paired across members. Guard: both readers must agree on direction.
- Before T5 runs, fix the statement list's known errors: sequel from franchise data, trust figures from held-out
  predictions, the six kinds clustered over the reference pool.
- T5 shows whether a description carries anything personal. It does not show that members like it; that needs
  members (2.7).

### 2.3 Splits, and a final test that cannot be spent

There is no locked quarter. A random quarter of old ratings measures the wrong task and is spent. Its ratings go
back into the pack (9,016 ratings instead of 7,210). Three tiers replace it:

| Tier | What it is | Who may read it | Use |
|---|---|---|---|
| A, open | 65% of members (seeded, stratified by number of ratings) and all of the owner's ratings up to T0 | Every agent | Development under pre-registration and run budgets |
| B, gate | The other 35% of members, in a separate file outside the lab folder | Only `gate.py`, run by the orchestrator | One look per pre-registered comparison, 8 looks per pack. Agents and briefs get "replicated" or "not replicated", never the numbers |
| C, sealed | Everything written after T0: new ratings, new members, new Want to See and Not interested | Only `sealed.py`, at a registered checkpoint | The final test. Frozen candidates only |

- **Why tier C cannot be spent.** It does not exist when the candidates are frozen, and it keeps growing. A
  checkpoint opens when 300 or more new ratings from 15 or more members exist, or every 6 weeks, whichever is
  later. After a checkpoint its rows join the next pack, and the next window is already filling. Windows may be
  pooled for candidates that stayed frozen across them.
- **Tier B is a replication check, not a significance test.** With about 40 gate members the smallest detectable
  effect is near 0.2 points. The rule is: same sign as on tier A and at least half its size. It exists to catch
  the old loop's 0.757 to 0.899 kind of failure early, not to crown anything.
- **The owner has no gate.** Every old owner rating has been looked at. For the owner, confirmation comes only
  from fresh labels: T3 pools, T4 re-ratings, ratings of titles in My library under Not rated, and ratings
  written after T0.
- **T2 has no gate.** Only 36 members have 10 or more unrated Want to See titles (verified). All of them are in
  tier A for T2; T3 and tier C confirm.
- **How new ratings enter.** `pull.py --until <time>` builds a pack from rows written up to that time. Packs are
  dated and never rewritten. A rating that differs between two packs is an observed change of mind and is kept as
  a pair.
- **Predictions before labels.** Whenever anyone is about to label anything (a pool, a re-rating, a checkpoint),
  the frozen candidates' code hashes and outputs go into the ledger first.

### 2.4 Fixed baselines, one output convention, uncertainty

The ladder is fixed. Nothing joins it unless a pre-registered item brings new information (new labels, new title
data), not a new model form on the same ratings.

| Rung | Scorer | Role |
|---|---|---|
| B0 | Median of the member's ratings so far | The one skill reference, everywhere |
| B1 | GoodWatch score plus the member's offset, shrunk toward the population's | "Calibrated public score" |
| B2 | Today's taste, ported exactly: `2P - N` on raw unit fingerprints, Want to See at 0.5 | The incumbent for D1 |
| B3 | The same on fingerprints standardized against the reference pool | The cheapest challenger |
| B4 | Consensus score with a shrunk offset and slope per member (`pooled/pool.py`, personal weights off) | Settles how much of the few-ratings gain is personal |
| B5 | The pooled predictor (`pooled/pool.py`, personal weights on, no trees) | The frozen leader |
| BP | Vote count | Ranking tasks only |
| BR | Random eligible titles | Judged pools only |

**Contract.** A predictor is one file with one function. It runs in its own process and receives a view file with
the hidden labels physically removed:

```
predict(view) -> {"rank":  float per target, higher is shown earlier (required),
                  "score": float per target in 1..10, the rating expected if watched (or None),
                  "p_low": float per target, chance of a rating of 5 or less (or None)}
```

- The harness, not the predictor, turns `score` into the number compared: rounded, clipped to 1 to 10.
- A scorer without `score` (B2, B3) gets one from the harness's standard calibrator: a monotone fit of rating on
  `rank` using the member's history only. All scorers then share one scale.
- Decision rules such as the band-weighted median are policies on top of a distribution. They are judged by their
  own costs and never enter an error comparison.
- Skill is always 1 minus error divided by B0's error on the same targets.

**Uncertainty.**

- Population claims: the paired difference per member, bootstrap over members (10,000 draws), 95% interval. Report
  the median member beside the mean, and how many members improved.
- Owner claims: bootstrap over sittings, not over ratings. Check once with whole franchises resampled together.
- Fold seeds are not new observations and are never pooled into a table.
- Every result line carries the smallest detectable effect for that comparison.

### 2.5 Win, null and stop, decided now

- **Win on development.** The 95% interval of the paired difference on tier A excludes zero; the effect is at
  least the floor for its task (T1: 0.05 points of average error; T2: 0.03 mean percentile rank; T3: 1 hit per
  10; T5: 10 points of share correct); no guard is worse with an interval that excludes zero.
- **Replicated.** Tier B shows the same sign and at least half the size, in one look.
- **Established.** Holds on tier C, or on member judgments (T3 with the panel, T5 with members). Only established
  results change the product. One exception: standardized fingerprints may ship behind a flag once T2 and the
  owner's pools agree, because the change is small and reversible.
- **Null.** Anything else after the registered run. A null is recorded with its smallest detectable effect and
  reads "the test could have seen X or more and did not".
- **Indistinguishable.** Two candidates whose difference is under the smallest detectable effect. The simpler one
  is kept and the question is closed until the data changes.
- **Stop a branch.** Two nulls in a row, or the run budget is used up.
- **Stop rating models.** Let the floor be 0.71 times the owner's re-rating difference, and the room be B5's
  forward error for the owner minus the floor. Room under 0.10 points: no more rating-model work, D2 stays at
  "show nothing new" unless risk alone earns a place. Room of 0.25 or more: one modelling item may open, and only
  with new information (answers to questions, reasons for low ratings). In between: no modelling.
- **D2 threshold.** A personal score is worth showing only if B5 beats B1 forward by 0.10 points or more for
  other members, replicated on tier B, and the risk is calibrated on tier C: every reliability bin with 30 or
  more ratings within 5 percentage points, Brier score better than the member's own share of low ratings.

### 2.6 The data pull

**Tables and columns** (checked against `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`):

- `user_score`: user, title key, `score`, `created_at`, `updated_at`. Not the review text; keep a has-review flag.
- `user_wishlist`, `user_skipped`, `user_not_interested`, `user_favorite`: user, title key, `created_at`,
  `updated_at`. The old pull had none of the dates and no Not interested.
- `user_watch_state`: `state`, `state_changed_at`, `pass`, dates.
- `user_watch_log`: title and episode keys, `watched_at`, `watched_at_precision`, `origin`, `import_id`, `pass`.
- `user_import`: `id`, `source`, `status`, `created_at`, `finished_at`. `user_import_item`: `import_id`, title
  key, `raw_rating`, `imdb_score`, `date_rated`, `prior_score`, `applied_score`, `applied_at`, `outcome`, `kind`.
  No titles as typed, no payload.
- `user_setting`: only country and streaming services.
- Not pulled: `search_history`, `user_list`, accounts, emails, handles.
- Titles: the columns in `lab/build_pack.py` and `lab/add_scores.py`, plus `movie_series_id` for both the sequel
  fix and franchise resampling, for every title any member touched **and** the whole reference pool. Fingerprints
  for the whole catalog as before. Both text embeddings from Qdrant for the same titles.

**Provenance, added to every rating:** `import` (matches an applied import item), `bulk` (in a moment of 5 or
more), `typed` (the rest); an `edited` flag when `created_at` and `updated_at` differ; sitting number and position
in entry order. Public scores and fingerprints are as of the pull, not as of the rating. That leak cannot be
removed; the harness reports results again on titles released 2 or more years before the rating.

**A census comes with the pull**, as counts only: members and rows per table, dated Want to See adds per member,
Want to See titles later rated, Not interested rows, import pairs with two ratings, titles Seen but not rated,
members with watch logs and show statuses. The census decides which later branches are possible at all.

**Where it lives.** `~/goodwatch-research/taste/packs/<date>/`, outside the repository and outside `/tmp`, mode
700. The repository gets `MANIFEST.json` (file hashes, row counts, pull time, code commit) and the census. The old
`pack.pkl`, `locked.pkl` and the feature caches are copied into `packs/old/` so the old results stay
reproducible.

**Privacy rules.**

- Member ids are replaced by a keyed hash; the key stays in the data folder; the mapping is never written. The
  owner is flagged, not named.
- No pack rows in the repository. Repository files show other members only as aggregates. The owner's own titles
  may appear.
- Research never writes to production, and reads only through the one helper that refuses anything but a select.
- Models outside the Claude family may read the pack with hashed ids, as in the review round. They never get raw
  ids or anything from the tables not pulled.

### 2.7 What cannot be measured offline, and the smallest version of each

| What is missing | Why offline cannot give it | Smallest version |
|---|---|---|
| Whether suggestions suit members other than the owner | Nobody has judged an unseen list | A page behind a flag showing 24 titles with the five T3 answers, stored in a new table; 20 members by invitation |
| How consistent other members are with themselves | One rating per title | A "rate again" card: 12 titles, old rating hidden, stored beside the first, never over it |
| What members were shown and passed over | No exposure record exists; the poster-impression endpoint serves title processing, not this | Log for members, per list render: surface, sort, For you state, model version, and the first 30 title keys with position and Taste match shown. Next step: fill one slot at random from ranks 5 to 30 and log the probability |
| Why a rating was low | No reason is stored | One tap after a rating of 5 or less: not my kind, boring, expected more, too long, bad ending, wrong mood |
| Whether a suggestion led to a watch the member liked | Needs time | No build: Want to See adds that are later rated, counted at each checkpoint |
| Whether members recognise a description | Model readers are not members | Three descriptions side by side, "which is yours", a wrong-line tap; 20 members |
| Whether chosen questions beat more ratings for real new members | Simulation overstates how answerable a question is | An onboarding variant with a fixed budget of questions, judged on tier C |

Predictions stored at the moment of rating are **not** on this list. Frozen code plus sealed windows give the
same test with no product work. What was shown cannot be rebuilt later, so the exposure log is the instrumentation
that matters. Each row above ships through normal development; the loop writes the issue and the acceptance test.

## 3. The loop

### 3.1 Phases

**Phase 0. Foundations (session 1).**
Produces: the durable pack with census; the harness with T1, the ladder and its controls; the owner's first error
floor; issue drafts for the exposure log and the reason tap, because both need calendar time before they pay.
Exit test: a red team from another model family has tried to break the harness and every finding is fixed or
answered; a second family has reviewed `PROTOCOL.md`; the ladder table rebuilds from the ledger with one command.
No experiment result is believed before this exit.

**Phase 1. Measure the right things with the data that exists (sessions 2 and 3).**
Produces: the ladder under T1 (settles the time dispute for fitted models, and whether B5 beats B4 and B1); T2
for B1 to B5 and BP; the owner's first two judged pools; the room left for rating models.
Exit test: every cell of the decision table in `DECISIONS.md` holds a number with an interval or the words "not
measurable yet, needs X"; a gate review by two models that are not the orchestrator's has been answered. The owner
then confirms the direction of phase 2 in one conversation.

**Phase 2. Obtain new information (sessions 4 to 6, and calendar time).**
Produces, as separate items: the offline question simulation; the list-composition re-ranker judged in the
owner's pools; the statement list with its facts fixed and T5 for the three formats; the specifications in 2.7 as
issues; the first sealed checkpoint.
Exit test: D1 is decided for the owner and either established with the panel or blocked on a named panel size;
D2 is decided by the thresholds in 2.5; D3 has a T5 result and the owner's line-by-line marks.

**Phase 3. Decide, hand over, sleep.**
Produces: decision records with evidence; issues for whatever ships. The loop then wakes only for a sealed
checkpoint or when an instrument has gathered enough: 200 reasons, 300 new ratings, 20 panel members.

### 3.2 Where the branches of `next-branches.md` go

| Branch | Phase | Note |
|---|---|---|
| 1. Forward-in-time test | 0 and 1 | As T1 in entry order. Stored predictions are replaced by frozen code and sealed windows |
| 2. Measure recommendations, step 1 offline | 1 | T2, with the time split that 2.1 item 7 requires |
| 2. Step 2, blind judged pool | 1 (owner), 2 (panel) | T3 |
| 2. Step 3, exposure logging | Issue in 0, data from 2 on | Randomised slot is the second step, not the first |
| 3. Error floor | 0 (owner, import pairs), 2 (members) | Moved first: it is 15 owner minutes and it decides how much modelling is allowed |
| 4. Informative questions | 2, offline only | A real onboarding test waits for tier C volume |
| 5. Sides as list composition | 2 | Judged only by T3 |
| 5. A taste members can check | 2 | T5, then the owner, then members |
| Ask why on low ratings | Issue in 0 | It only pays with time |
| A smaller pooled model with stronger baselines | 0 and 1 | This is the ladder. It is the only modelling in the first two phases |
| Shows: watch state as the outcome | Parked | Opens if the census finds 30 or more members with 5 or more started shows that have a status |
| Borrow collaborative structure (MovieLens) | Parked | Opens only if the room is 0.25 or more and the owner has permission for commercial use. Movies only |
| Audit the fingerprint | Parked | Opens with the same room condition; it costs model budget and ships through title analysis |
| An editable written taste | Parked | A fourth format for T5 once the three have a result |
| Tonight versus taste | Dropped from this loop | It is session context and a product feature, not a property of a scorer |
| Rating order in the model | Dropped | Verified: no entry-order penalty in simple baselines; others' mean drifts 0.4 points over a whole history. Reopens only if T1 shows a penalty for B5 |

**What I add:** the entry-order test with its measured sample sizes; the three tiers with a gate held out by
member and a sealed tier that regrows; the smallest detectable effect printed with every result and the
"indistinguishable, so the simpler wins" rule; the time-split reading of Want to See; the blind model reader for
descriptions; predictions hashed before any label is collected; the owner's 15 minutes per session as a standing
instrument; the room-left rule that can end rating-model work in session 1.

### 3.3 The first three work items

**Item 001. Durable pack and census.** Builder. About 3 hours.

- Do: copy the old lab data out of the scratchpad first. Write `lab/pull.py` from `build_pack.py` and
  `add_scores.py` with the columns, provenance and privacy rules of 2.6. Run it once; that time is T0. Write the
  member split for tiers A and B with a fixed seed.
- Accept when: the pack is under `~/goodwatch-research/taste/packs/<date>/` with mode 700; `MANIFEST.json` and
  `CENSUS.md` are committed; rating and member counts match a `count(*)` taken at T0; every rating has both dates
  and a provenance value; a search of the pack for a raw member id finds none; a second run with the same
  `--until` gives the same hashes; the gate file is outside the lab folder and no committed file names its path.

**Item 002. Harness, ladder and controls.** Builder, then red team and protocol review. About 4 hours.

- Do: implement the contract, T1, B0 to B5 (B4 and B5 ported from `pooled/pool.py` unchanged), `run.sh`, the
  ledger, `gate.py`, `verify.py`, and the table script. Write `PROTOCOL.md`.
- Accept when: each predictor runs in its own process from a view file that holds no hidden label; the ladder
  table for T1 rebuilds from the ledger with intervals and smallest detectable effects; a shuffled-label run
  scores no skill against B0 within its interval; a planted effect of 0.15 points is found; a predictor that
  tries to read target ratings or target times gets nothing; `verify.py` reproduces a run exactly; B0 and B1 for
  other members land near 1.5 and 1.45 points on the old development ratings (my figures, as a sanity anchor);
  the full ladder runs in under 10 minutes on 2 threads; the red team's report is filed and each finding is
  marked fixed or answered.

**Item 003. The owner's error floor.** Builder for the page, the owner for 15 minutes, orchestrator for the
analysis. About 2 hours plus the owner.

- Do: draw the 120 titles of T4 with a seeded script. Generate a single static page in the data folder that
  stores the answers as a JSON file. Count the import pairs from the census.
- Accept when: the page shows no rating, score or prediction; the draw's seed and title hashes are in the ledger
  before the owner starts; the report gives the average difference with an interval, exact agreement, crossings
  of the 5-or-less line, each by band, and the counts of Don't remember and Rewatched since; the floor and, once
  item 002 is done, the room are written into `DECISIONS.md` with the action the rule in 2.5 prescribes.

Item 001 runs first. Items 002 and 003 then run side by side.

## 4. Orchestration

### 4.1 The orchestrator

**Fable 5.1 at high effort, in sessions of one phase step each, never one long session.**

- The old loop's costly errors were errors of judgment at the start: the wrong task, no analysis by the
  orchestrator, no review before round 1. Agents did not cause them. The orchestrator is where the strongest
  model pays. In this project's own record, the Fable review ran the two analyses that changed the verdict (the
  forward split and the Want to See stand-in).
- **Why high and not low.** Low effort is what let the orchestrator relay agents' tables without testing them.
  The orchestrator here must run checks itself (4.4).
- **Why not xhigh or max.** The owner is in the session for T3 and T4, and slow turns cost their time. More
  thought does not replace a missing analysis; the checks in 4.4 and the reviews by other models do that work.
  Where depth helps, the orchestrator spawns a one-shot gate reviewer at xhigh.
- **Why not Opus 5.5.** It is the fallback, at high effort, with every mechanism below unchanged. It ran the old
  loop, so its reading of this problem is the one already tried; a different orchestrator is one more independent
  view. Its 1M context is no advantage once sessions are short and state lives in files.
- **Why not Sonnet 5.5.** Orchestration is the judgment step. Saving there risks repeating the first loop.
- **Cost.** The orchestrator's share stays small only if agents hand back files and a short summary, and
  sessions are short. Under those rules I expect it to be about a third of the tokens of a session; experiment
  and build agents are the larger part. This is an estimate, not a measurement. The old loop's waste was ten
  agents sweeping on the wrong benchmark, not the orchestrator's tokens.

### 4.2 Roles

| Role | Model and effort | Why |
|---|---|---|
| Builder of the pull and the harness | Opus 5.5, high | A silent bug here corrupts every later number. Done once |
| Builder of pages and ports | Sonnet 5.5, medium | Mechanical, checked by acceptance tests |
| Experimenter | Opus 5.5, medium | One pre-registered question inside a harness that enforces the conventions |
| Red team | gpt-6-astra, high, through `codex exec` | Must be another family than the builder. Task: make the harness report a win that is not one; run small analyses, do not only read |
| Protocol and gate reviewer | gpt-6.1-sol, high, and one Claude model that is not the orchestrator's (Opus 5.5 at high when Fable orchestrates) | Two families at every gate. Each must run at least one analysis of their own on tier A |
| Reader for T5 | Haiku 5.5, low, by Workflow fan-out; repeated with gpt-6-astra | Hundreds of small independent judgments; two families so the result is not one model's habit |
| Writer | Sonnet 5.5, medium | Writes prose around tables that a script builds from the ledger. Types no number by hand |

Different families on purpose in three places: the red team against the builder, one gate reviewer against the
orchestrator, and the second T5 reader against the first.

### 4.3 How agents are run

- **How many.** At most 3 agents that compute, at 2 threads each. Reviewers and readers do not count. `run.sh`
  enforces it: it takes one of 3 lock slots, sets the thread limits, runs under `timeout 900` and `nice`, and
  writes the ledger line. Computation outside `run.sh` is not a result.
- **Briefs.** One folder per item in the repository, `items/NNN-name/`, with `BRIEF.md` in fixed sections: the
  question; the decision it feeds; inputs by path; what is forbidden; the pre-registration; the run budget; the
  hand-back. A brief never contains a tier B or tier C number, only "replicated" or "not replicated".
- **Pre-registration.** `PREREG.md` is committed before the first registered run: hypothesis, task, candidate and
  reference rung, primary measure, guards, effect floor, the one analysis that will be reported, the stop rule.
  The harness refuses a registered run whose pre-registration is not committed or whose predictor hash is not
  listed.
- **Ledger.** `ledger.jsonl`, append-only, written only by the harness: run id, item, mode (`explore` or
  `registered`), commit, predictor hash, pack hash, tier, task, measures with intervals, seconds. Exploratory
  runs are logged too. Budget per item: 20 exploratory and 3 registered runs; the harness refuses more.
- **Hand-back.** `result.json`, written by the harness, with a fixed schema: item, run ids, the registered
  comparison, effect, interval, smallest detectable effect, guards, verdict (win, null, indistinguishable). The
  agent's final message is a report of at most 60 lines: what was run, the verdict, what failed, what would
  overturn it. Subagents cannot save report files, so **the orchestrator saves that message as `REPORT.md` as
  its first act after the agent returns**. Code stays in the item folder.
- **Verification before belief.** In order: (1) every number in a report must carry a run id; (2) `verify.py`
  reruns the registered command in a fresh process at the item's commit and must match exactly; (3) the
  orchestrator's own checks in 4.4; (4) for a win, one look at tier B; (5) for anything that will be written as
  a finding, one reviewer from another family reads the item and reruns a part of it.
- **Review timing.** Before: red team and protocol review close phase 0. During: each claimed win gets step 5.
  After: a gate review of each phase's write-up before it is committed as findings. Reviews are saved by
  redirecting the reviewer's output into `REVIEW-<model>.md`.
- **Against overfitting.** The fixed ladder; run budgets; the gate held out by member; hidden labels removed
  from the view file instead of forbidden by a rule; no gate or sealed numbers in briefs; nulls recorded with
  their smallest detectable effect.
- **Against over-running.** `run.sh` timeouts and slots; briefs forbid sleep and polling loops and background
  jobs; a wall-clock limit per item, after which the orchestrator stops the agent; after every agent the
  orchestrator lists lab processes and kills what is left.
- **State across sessions.** In the repository, on branch `research/taste-loop`, under
  `docs/research/taste-loop/`: `PLAN.md` (the merged design), `PROTOCOL.md` (the benchmark; a change needs a
  review), `STATE.md` (one page: phase, open items, next action, what the owner owes; read first, rewritten
  last), `DECISIONS.md` (D1 to D3 with evidence and status), `ledger.jsonl`, `items/`, `lab/`, `MANIFEST.json`,
  `CENSUS.md`. Data stays in `~/goodwatch-research/taste/`. A session ends by committing.

### 4.4 The orchestrator's own checks

At every phase exit and for every claimed win, the orchestrator itself, not an agent:

1. Reads 20 raw input and output rows of the winner.
2. Prints the first 20 titles each scorer would show the owner and reads them.
3. Reruns the shuffled-label control.
4. Writes one sentence, "this would be wrong if ...", and runs that test.
5. Checks the effect by stratum: same sitting and later sitting, movies and shows, owner in and out.

### 4.5 Failure modes of the old loop and what prevents each

| Old failure | Mechanism |
|---|---|
| The benchmark measured rating error on random holdouts | Five tasks tied to three decisions; T1 in entry order; ranking and judged pools decide D1 |
| The locked set was spent in three looks | Tier C regrows; tier B has a look budget and reports only replicated or not |
| Briefs published locked results | Briefs carry no gate or sealed numbers; the harness prints none to agents |
| No pre-registration, unledgered sweeps | `PREREG.md` enforced by the harness; every run in the ledger; budgets |
| Different output conventions and skill baselines | One contract; the harness rounds and calibrates; B0 is the only reference |
| Reports lived only in chat | The harness writes `result.json`; the orchestrator saves the final message as `REPORT.md` at once |
| Module-name clashes corrupted a scoring run | Each predictor runs in its own process, loaded by path |
| Stray wait-loops, runs over budget, load 13 to 17 | `run.sh` slots, timeouts and thread limits; process sweep after each agent |
| Data and locked ratings in a temporary folder | Packs in `~/goodwatch-research/taste/`, manifest in the repository, old files copied first |
| The orchestrator ran no analysis of its own | The five checks in 4.4 are exit conditions |
| Reviews came at the end | Red team and protocol review before any experiment; a reviewer on each win; a gate review per phase |
| Nulls written as "it cannot be done" | Every null carries its smallest detectable effect; a planted-effect control shows what the test can see |
| One member carried the main result | Owner and others always apart; a population fit without the owner; the panel decides D1 |
| An honour rule kept agents off hidden labels | Hidden labels are not in the file the predictor receives |

## 5. Kickoff prompt

Start Claude Code in `/home/alper/projects/goodwatch-monorepo` with model Fable 5.1 at high effort, then paste:

```
You are the orchestrator of the GoodWatch taste research loop. Work without asking permission questions; stop
only at the owner checkpoints named below.

Read first, in this order:
1. docs/research/taste-loop/PLAN.md (the merged design; if it is missing, stop and ask me for it)
2. docs/research/taste-loop/STATE.md if it exists; if it does, continue from its "next action" and skip to the
   rules below
3. docs/research/taste-prediction/README.md section 11, then docs/research/taste-prediction/next-branches.md
4. CONTEXT.md (use its terms: Want to See, Not interested, Skip, Taste, Taste match, Side of you, Movie)
5. docs/research/taste-prediction/lab/harness.py, build_pack.py, add_scores.py, gw.py, agents/pooled/pool.py
6. goodwatch-webapp/app/server/taste/formula.server.ts

What this loop is for: three decisions. D1: which scorer orders titles under For you and Best match. D2:
whether a member is shown a personal predicted score or a risk. D3: how a member's Taste is described. It is
not for lowering rating error on titles members already chose to watch, and it writes no product code.

Rules that hold in every session:
- Production is read only. Use one helper that refuses anything but a select. Never write to production.
- Data lives in ~/goodwatch-research/taste/ (mode 700), never in the repository or /tmp. Member ids are keyed
  hashes. No rows of other members in any committed file.
- Work on branch research/taste-loop, created from main. Commit there at the end of each item. Do not push and
  do not open a pull request unless I ask. Leave unrelated working changes alone.
- No experiment result is believed before the phase 0 exit: red team by gpt-6-astra and protocol review by
  gpt-6.1-sol (both through `codex exec -m <model> -c model_reasoning_effort=high`, read-only sandbox), plus one
  review by Opus 5.5 at high effort.
- Every experiment has a committed PREREG.md before its registered run, runs only through lab/run.sh, and
  lands in ledger.jsonl. At most 3 computing agents at once, 2 threads each.
- A subagent's final message is its report. Save it as items/NNN-name/REPORT.md before you do anything else.
- Never put a gate or sealed number in a brief. Agents learn only "replicated" or "not replicated".
- Before you accept a win, do the five orchestrator checks in PLAN.md section 4.4 yourself.
- A null is written with the smallest effect the test could have seen. Two candidates closer than that are
  "indistinguishable" and the simpler one stays.
- End every session by rewriting STATE.md (phase, open items, next action, what the owner owes) and committing.

First session, in this order:
0. If <scratchpad>
   still exists, copy its lab/ and taste/ folders to ~/goodwatch-research/taste/packs/old/ before anything else.
   Commit docs/research/taste-prediction/ on the new branch.
1. Item 001, durable pack and census (PLAN.md section 3.3). Builder: Opus 5.5 at high effort.
2. Item 002, harness, ladder and controls, and item 003, the owner's error floor, side by side.
3. Draft two GitHub issues, without filing them: the exposure log and the one-tap reason on low ratings
   (PLAN.md section 2.7). Show me the drafts.

Owner checkpoints (stop and wait for me):
- When the re-rating page of item 003 is ready: I rate 120 titles, about 15 minutes.
- When the phase 0 exit test has passed: show me the ladder table, the error floor, the room left, and the
  action the stop rule prescribes.
- Before anything is sent to a member other than me, and before any issue is filed.

Tell me in one short message when an item is accepted or fails, with the path of its REPORT.md.
```

## 6. Risks and open questions

1. **The old data is in a session scratchpad and will vanish.** Decide now. Recommended: before the current
   session ends, copy `scratchpad/lab/` and `scratchpad/taste/` (the pack, `locked.pkl`, the feature caches) to
   `~/goodwatch-research/taste/packs/old/`. The kickoff prompt repeats this, but it may be too late by then.
2. **Will the owner give about 15 minutes per session to labelling?** Recommended: yes. Re-rating in session 1,
   one judged pool per session after that. It is the cheapest new information available and the only fresh test
   for the member the product is tuned on.
3. **May models outside the Claude family read members' ratings with hashed ids?** They did in the review round.
   Recommended: yes for the hashed pack; never raw ids, never the tables left out of the pull.
4. **When does panel recruitment start?** It is slow and D1 and D3 cannot be established without it.
   Recommended: ask 20 to 30 members as soon as phase 1 shows the scorers differ in the owner's pools. If they do
   not differ there, do not recruit for D1; take the default.
5. **Should instrumentation ship before the loop has results?** Recommended: yes for the exposure log and the
   reason tap. Neither changes what members see by much, both only pay with calendar time, and neither depends on
   which scorer wins.
6. **May standardized fingerprints ship before the panel?** Recommended: yes, behind a flag, once T2 confirms the
   direction and the owner's pools do not contradict it. Evidence so far: +0.038 AUC over today's taste on the
   stand-in (0.009 to 0.068, 19 members, verified) and the owner's rank agreement 0.21 to 0.45 in the report. It
   changes every Taste match value, so it needs the stored-taste version bump.
7. **What would a predicted score mean beside Taste match?** Recommended: Taste match keeps its meaning, fit of
   the fingerprint within the member's own range. A predicted score, if D2 ever says yes, is a second number with
   its own glossary entry. The loop does not redefine Taste match.
8. **The first sealed window is thin.** Ratings arrive at about 300 a month, mostly from new members and the
   owner. A window of 6 weeks confirms only large effects. Recommended: accept it, pool windows for candidates
   that stay frozen, and do not open a window early.
9. **The answer may be "the scorer hardly matters at this scale".** With 117 usable members the forward test sees
   0.11 points or more. Recommended: treat "indistinguishable" as a result, take the simple default, and move
   the effort to information (questions, reasons, exposure), where the reviews agree the gain is.
10. **The owner is both the main judge and 11% of the ratings.** Recommended: no decision is "established" on the
    owner alone; every table shows the owner and the others apart, and one population fit leaves the owner out.
11. **Public scores and fingerprints in the pack are today's, not those at rating time.** This flatters every
    scorer that uses them, B1 most. Recommended: accept, report the older-titles subset beside each result, and
    rely on tier C, where the gap is weeks, not years.
12. **Fable 5.1 as orchestrator costs more per session than the old setup.** Recommended: accept for phases 0
    and 1, where the protocol is set. If the owner wants to cut cost later, phase 2 items are narrow enough for
    Opus 5.5 at high effort to orchestrate with the same files and rules.
13. **MovieLens needs permission for commercial use.** Recommended: do not ask yet. It is parked behind the
    room-left rule; ask only if that rule opens it.
14. **Guests have a taste too, and none of their data is on the server.** Recommended: out of scope. Findings for
    members with 5 to 9 ratings are the nearest evidence.
