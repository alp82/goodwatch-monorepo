# Taste research loop: the plan a new session starts from

Merged on October 13, 2026 from three independent designs (Fable 5.1, Opus 5.5, GPT-6 Astra; all high effort; full
texts in `designs/`). A fourth design, by GPT-6.1 Sol, was stopped by the machine running low on memory and is not
part of this merge. The designs start from the verdict on the first loop:
[`../taste-prediction/README.md`](../taste-prediction/README.md) section 11 and
[`../taste-prediction/next-branches.md`](../taste-prediction/next-branches.md).

Where the designs agree, this plan states the choice. Where they disagree, section 7 names the disagreement and
the choice made here. Numbers marked **verified** were computed by a designer on the old data file; the designer is
named.

Terms are from `CONTEXT.md`: Taste, Taste match, Side of you, Want to See, Not interested, Skip, Dropped, For you,
Best match, fingerprint. Terms defined here:

- **Entry order**: the order in which a member wrote their ratings.
- **Sitting**: ratings by one member with less than 6 hours between neighbours.
- **Bulk write**: 5 or more of a member's ratings written within 2 seconds of each other (an import or a transfer).
- **Pack**: one dated, immutable data file built from a read-only pull of production.
- **T0**: the time of the first new pull. Everything written after T0 is unseen by construction.
- **Frozen candidate**: a scorer whose code hash is in the ledger before the data it is judged on exists or is opened.
- **Paired difference**: candidate minus reference on the same members and titles, per member, then averaged.
- **Smallest detectable effect**: the paired difference this data can find four times out of five.
- **Worthwhile suggestion**: a title the member finds appealing, did not know, and can watch on their services.

## 1. Goal

A member finds a worthwhile suggestion sooner: the first ten titles under Best match and For you hold more titles
they want to watch and did not know. A new member gets a useful Taste from their first sitting. And what GoodWatch
tells a member about themselves (a Taste match, a predicted score or a risk if one is ever shown, Sides of you or any
other description) holds on what they do next, and they recognise it.

The loop is not trying to lower rating error on titles members already chose to watch, to find a better model form
on the same 9,000 ratings, or to write product code. Its outputs are decisions with evidence, and specifications
for the product work those decisions need.

Three decisions. Today's behaviour stays until a challenger passes; when candidates cannot be told apart, the
simpler one is kept.

| | Decision | Candidates | Evidence that settles it |
|---|---|---|---|
| D1 | Which scorer orders titles under Best match and For you | Today's taste (`2P - N` on raw fingerprints); the same on standardized fingerprints; the pooled predictor | Hidden-title ranking (T2a) and ranking of later Want to See adds (T2b), offline. Blind judged pools (T3) with 20 or more members before a change reaches everyone |
| D2 | Whether a member is shown a personal predicted score or a risk of a low rating | Nothing new; public score plus the member's offset; the pooled predictor with a risk | Forward rating error (T1) and hidden-title error (T2a); calibration of the risk on ratings written after T0 |
| D3 | How a member's Taste is described | Sides of you as built; the statement list with its facts fixed; both | Can a blind reader tell whose description it is (T5); then can members, and which lines they mark wrong |

## 2. Benchmark

One harness, one predictor contract. T1, T2a and T2b run offline on a pack and need nothing from the owner. T3
needs members. T5 runs offline with model readers, then with members.

### 2.1 Facts that shape it

- 201 of 231 members rated on one day only. Only 24 have a later rating day after five or more earlier ratings;
  of 1,117 such target ratings, 711 are the owner's (Astra, Opus, verified). A "predict the next sitting" test on
  existing data is mostly an owner test.
- Most ratings were typed one at a time, seconds apart; only 760 of 7,210 sit in bulk writes (Opus, verified). So
  entry order inside a sitting is real. Predicting each block of a member's ratings from everything before it gives
  5,520 targets from 158 members other than the owner, 117 of them with 10 or more targets (Opus, verified).
- With 117 members that test resolves about 0.11 rating points, about 8% of other members' error (Opus, verified).
  Most differences the first loop argued about are smaller than this.
- For two simple baselines, predicting in entry order is no worse than in random order: 0.025 points
  (-0.01 to 0.06) and -0.014 (Opus, verified). The disputed time effect is about fitted models and the owner's
  later sittings.
- Want to See is an input to today's taste (weight 0.5). A test that uses Want to See as the label must build the
  taste only from what was written before the labels.
- Stand-in for recommendations, 19 members: the chance a Want to See title is scored above a quiz Skip is 0.54 for
  GoodWatch score, 0.55 for today's taste, 0.59 on standardized fingerprints; standardized minus raw is +0.038
  (0.009 to 0.068) (Opus, verified). The stand-in is confounded: the quiz shows well-known titles.
- Proxy labels exist for more members than ratings do: 142 members have unrated Want to See titles, 167 have
  Skips, 28 have 10 or more of each (Fable, verified).
- Under equal, independent noise on a whole-number 1 to 10 scale, the best possible predictor's average error is
  0.71 times the average difference between two ratings of the same title (Opus, simulated).

### 2.2 Tasks

**T1. Forward rating prediction.** Feeds D2 and the few-ratings part of D1.

> Amended October 13, 2026 after review (Sol 6.1, Fable). As implemented, a block may start anywhere two ratings are
> 2 seconds or more apart, not only at sitting boundaries; with sitting boundaries only 18 members other than the
> owner would qualify instead of 72. So for other members 93% of targets are typed in the same sitting as the
> history, a median of 6 seconds later. T1 therefore measures **learning from the ratings a member has entered so
> far in a sitting**, which is the first-sitting case. It is weak evidence about ratings of titles watched later:
> that stratum has 16 members and 276 targets on this pack and is reported apart, never pooled into a claim.

- Per member, sort ratings by write time. Block boundaries at 5, 10, 20, 40, 80, 160, 320, 640 ratings, moved to
  the nearest sitting or bulk boundary. Predict each block from everything the member wrote before it. Bulk writes
  are history, never targets.
- Other members' ratings are all visible (leave one member out), as in the product. Finalists run once more with
  only what others had written before the block; the gap is reported.
- Eligible: members with 6 or more ratings; every rated title, with a declared fallback for titles without a
  fingerprint, and the fingerprint-covered subset reported beside it.
- Always reported apart: target in the same sitting as the history; target in a later sitting; by block; movies
  and shows; the owner alone; a population fit with the owner left out; typed, bulk and imported ratings.
- Primary: average error of the rounded prediction, per member, averaged over members with 10 or more targets, as
  a paired difference against the reference rung.
- Guards: share of a member's target pairs with different ratings ordered correctly; low-rating AUC within
  member; Brier score of the chance of a rating of 5 or less against the member's own share so far, with a
  reliability table that shows counts; error on low, middle and high ratings, reported, never optimised.
- Prospective version: ratings written after T0, predicted by frozen candidates (tier C, 2.3).

**T2a. Hidden-title test.** The owner's idea, and the main offline test for D1 and for predicted scores.

- For each title a member rated: remove that one rating, treat the title as unwatched, and let the scorer place it
  among every title in the reference pool the member has not rated. Then compare with the real rating. Every other
  rating of the member stays visible. For fitted scorers this is done in folds of 20 titles, which gives the same
  answer at a fraction of the cost.
- Recommendation measures, per member, by real rating: where the hidden title lands in the list (percentile rank;
  1.0 is the top) for titles rated 8 or more, 6 to 7, and 5 or less; the share of titles rated 8 or more that land
  in the first 50 and the first 200; the share of titles rated 5 or less that land there too (lower is better).
- Primary: mean percentile rank of titles rated 8 or more minus that of titles rated 5 or less, paired against
  today's taste. A good scorer puts what the member loved near the top and what they disliked further down.
- Score measures: error of the predicted rating, as in T1, on the same hidden titles.
- Guards: GoodWatch score alone and vote count alone as scorers (a member's loved titles are mostly well-rated
  titles, so a scorer must beat a plain quality list); the same measure after removing each title's public score
  rank, so that what is left is personal; share of shows, animation and franchise repeats in the first 50.
- What it cannot see: it only tests titles the member chose to watch. It says where a known favourite lands, not
  whether the unrated titles above it are any good. T2b and T3 cover that.
- Eligible: members with 20 or more ratings, at least 5 of them rated 8 or more; the owner reported alone.

**T2b. Ranking later Want to See adds, offline.** A second screen for D1.

- Per member, sort Want to See adds by `created_at`. A sitting of 10 or more adds is a transfer: history only.
  Targets are the adds in the last 40% of the member's add sittings, at least 3. History is everything the member
  wrote before the first target.
- Candidates: every title in the reference pool (poster, GoodWatch score, 1,000 or more votes) that the member
  had not rated, watched, added, skipped or marked Not interested before the cutoff. The whole pool is ranked; no
  sampled negatives. Targets outside the pool are dropped and their share reported.
- Primary: mean percentile rank of the targets (0.5 random, 1.0 perfect), per member, paired against today's taste.
- Guards: targets in the first 50; median vote count of the first 50; share of shows and of animation in the
  first 50 against the member's own mix; repeats of one franchise; titles the member has Seen in the first 50
  (must be none); mean percentile of titles later marked Not interested; Want to See against Skip and against Not
  interested AUC, reported apart and labelled a stand-in.
- Reading it: members add what they were shown, so the result leans toward popular titles and toward whatever
  ordered the lists then. A challenger that loses by less than the smallest detectable effect is not eliminated.

**T3. Blind judged pool.** Confirms D1 before a change reaches everyone. Not needed from the owner.

- For one member: from the eligible titles take the first 12 from each scorer (today's taste, standardized taste,
  pooled predictor, GoodWatch score alone) and 8 at random. Remove duplicates, shuffle, hide which scorer chose
  which. Every frozen candidate's full ranking is hashed into the ledger before the member sees the pool.
- The member marks each title: Seen it (then rates it); Want to See, knew it; Want to See, new to me; Not for me;
  Can't tell. Nothing is written to production.
- Primary: hits in a scorer's first 10, where a hit is an unseen title marked Want to See, paired against today's
  taste. Guards: new-to-me hits; Not for me in the first 10; seen titles rated 8 or more; franchise repeats;
  availability on the member's services where known.
- Run with 20 or more members, and only when T2a and T2b point to a challenger worth confirming, or disagree.

**T4. Re-rating consistency.** Not run. The owner decided on October 13, 2026 that re-rating is not needed. The
"rate again" card in 2.7 stays as an option for other members only if D2 is ever pursued.

**T5. Whose Taste is this.** Screens D3.

- For each member with 40 or more ratings, write each description from the first 70% of their ratings in entry
  order. A blind reader gets one description and three lists of 15 later ratings: the member's own and two from
  members matched on rating count and mean rating. Titles named in the description are removed from the lists.
- Readers: Haiku 5.5 and GPT-6 Astra, run apart; both must agree on direction. Primary: share picked correctly
  against 33% chance, per format, paired across members.
- Before T5: fix the statement list's known errors (sequel from franchise data, trust figures from held-out
  predictions, the six kinds clustered over the reference pool).
- T5 shows whether a description carries anything personal. Whether members find it true and useful needs
  members: pick yours among three, mark each line right, partly right or wrong.

### 2.3 Splits, and a final test that cannot be spent

There is no locked quarter. The old one measured the wrong task and is spent; its ratings go back into the pack.

| Tier | What it is | Who may read it | Use |
|---|---|---|---|
| A, open | 65% of members (seeded, stratified by number of ratings) and all of the owner's ratings up to T0 | Every agent | Development under pre-registration and run budgets |
| B, gate | The other 35% of members, in a separate file outside the lab folder | Only `gate.py`, run by the orchestrator | One look per pre-registered comparison, 8 looks per pack. Agents and briefs learn "replicated" or "not replicated", never the numbers |
| C, sealed | Everything written after T0, and every member judgment collected after a candidate is frozen | Only `sealed.py`, at a registered checkpoint | The final test. Frozen candidates only |

- Tier C cannot be spent because it does not exist when candidates are frozen and it keeps growing. A window is
  used once: registered, analysed once at closure, every registered outcome published, then it becomes development
  data. A rating window opens when 300 or more new ratings from 15 or more members exist, or after 6 weeks,
  whichever is later. At most two confirmation attempts per decision, each on a fresh window.
- Tier B is a replication check: same sign as on tier A and at least half its size. With about 40 gate members it
  resolves only about 0.2 points. It exists to catch a 0.757-in-development, 0.899-held-out failure early.
- The owner has no gate; every old owner rating has been looked at. For the owner, confirmation comes only from
  ratings written after T0.
- T2b has no gate: too few members have dated Want to See adds. T2a uses the gate like T1.
- Whenever anyone is about to label anything (a pool, a re-rating, a checkpoint), the frozen candidates' code
  hashes and outputs go into the ledger first.
- `pull.py --until <time>` builds a pack from rows written up to that time. Packs are dated and never rewritten.
  A rating that differs between two packs is an observed change of mind and is kept as a pair.

### 2.4 Fixed ladder, one output convention, uncertainty

Nothing joins the ladder unless a pre-registered item brings new information (new labels, new title data), not a
new model form on the same ratings.

| Rung | Scorer | Role |
|---|---|---|
| B0 | Median of the member's ratings so far | The one skill reference, everywhere |
| B1 | GoodWatch score plus the member's offset, shrunk toward the population's | Calibrated public score |
| B2 | Today's taste, ported exactly from `taste/formula.server.ts` | The incumbent for D1 |
| B3 | The same on fingerprints standardized against the reference pool | The first challenger |
| B4 | Consensus score with a shrunk offset and slope per member (`pooled/pool.py`, personal weights off) | Settles how much of the few-ratings gain is personal |
| B5 | The pooled predictor (`pooled/pool.py`, personal weights on, no trees) | The frozen leader |
| BP | Vote count | Ranking tasks only |
| BR | Random eligible titles | Judged pools only |

A predictor is one file with one function, run in its own process on a view file from which hidden labels are
physically removed:

```
predict(view) -> {"rank":  float per target, higher is shown earlier (required),
                  "score": float per target in 1..10, the rating expected if watched (or None),
                  "p_low": float per target, chance of a rating of 5 or less (or None)}
```

- The harness turns `score` into the number compared: rounded, clipped to 1 to 10. A scorer without `score` gets
  one from the harness's calibrator: a monotone fit of rating on `rank` from the member's history only.
- Decision rules such as a band-weighted median are policies on top of a distribution. They never enter an error
  comparison.
- Skill is always 1 minus error divided by B0's error on the same targets.
- Population claims: paired difference per member, bootstrap over members (10,000 draws, registered seed), 95%
  interval, with the median member and the count of members improved. Owner claims: bootstrap over sittings, with
  one check resampling whole franchises. Fold seeds are not new observations.
- Every result line carries the smallest detectable effect for that comparison.

### 2.5 Win, null and stop, decided now

- **Win on development.** The 95% interval of the paired difference on tier A excludes zero; the effect is at
  least the floor for its task (T1: 0.05 points; T2a and T2b: 0.03 mean percentile rank; T3: one hit per ten; T5: 10 points
  of share correct); no guard is worse with an interval that excludes zero.
- **Replicated.** Tier B shows the same sign and at least half the size, in one look.
- **Established.** Holds on tier C, or on member judgments from 20 or more members. Only established results
  change what members see.
- **Null.** Anything else after the registered run, recorded as "the test could have seen X or more and did not".
- **Indistinguishable.** Two candidates closer than the smallest detectable effect. The simpler one is kept and
  the question is closed until the data changes.
- **Stop a branch.** Two nulls in a row, or the run budget is used up.
- **D2 threshold.** A personal score is worth showing only if B5 beats B0 and B1 forward by 0.05 points or more
  for other members, replicated on tier B, and the risk is calibrated on tier C: every reliability bin with 30 or
  more ratings within 5 percentage points, Brier score better than the member's own share of low ratings.
### 2.6 The data pull

- **Tables.** `user_score` (with `created_at` and `updated_at`; no review text, a has-review flag);
  `user_wishlist`, `user_skipped`, `user_not_interested`, `user_favorite` with dates; `user_watch_state`;
  `user_watch_log`; `user_import` and `user_import_item` (source, source rating and scale, date rated, prior and
  applied scores; no titles as typed, no payload); `user_setting` (country and streaming services only). Not
  pulled: search history, lists, accounts, emails, handles.
- **Titles.** The columns of `taste-prediction/lab/build_pack.py` and `add_scores.py`, plus `movie_series_id`
  and release date, for every title any member touched and for the whole reference pool. Fingerprints for the
  whole catalog. Both text embeddings for the same titles, memory permitting.
- **Provenance on every rating:** `import`, `bulk` or `typed`; an `edited` flag; sitting number; position in
  entry order. Unknown stays unknown. Public scores and fingerprints are as of the pull, not as of the rating;
  the harness reports results again on titles released two or more years before the rating.
- **A census comes with the pull,** as counts only: members and rows per table, dated Want to See adds per
  member, Want to See titles later rated, Not interested rows, import pairs with two ratings, titles Seen but not
  rated, members with watch logs and show statuses. It decides which later branches are possible.
- **Where it lives.** `~/goodwatch-research/taste/packs/<date>/`, mode 700, outside the repository and outside
  `/tmp`. The repository gets `MANIFEST.json` (file hashes, row counts, pull time, code commit) and `CENSUS.md`.
  The first loop's data file, locked ratings and caches are already in `packs/old/`.
- **Privacy.** Member ids become a keyed hash at pull time; the key stays in the data folder. The owner is
  flagged. No rows of other members in any committed file; other members appear only as aggregates. Research
  reads production through one helper that refuses anything but a select, and never writes to it.

### 2.7 What needs members or instrumentation, smallest version first

| Missing | Smallest version |
|---|---|
| Whether suggestions suit members other than the owner | A page behind a flag showing 24 titles with the five T3 answers, stored in a new table; 20 members by invitation |
| What members were shown and passed over | Per list render: surface, sort, For you state, model version, the first 30 title keys with position and Taste match shown. Later: fill one slot at random from ranks 5 to 30 and log the probability |
| Why a rating was low | One tap after a rating of 5 or less: not my kind, boring, expected more, too long, bad ending, wrong mood |
| How consistent other members are | A "rate again" card: 12 titles, old rating hidden, stored beside the first, never over it |
| Whether members recognise a description | Three descriptions side by side, "which is yours", a wrong-line tap; 20 members |
| Whether chosen questions beat more ratings | An onboarding variant with a fixed budget of questions, judged on tier C |
| Whether a suggestion led to a watch the member liked | No build: Want to See adds later rated, counted at each checkpoint |

Each ships through normal development. The loop writes the issue and its acceptance test. What was shown cannot be
rebuilt later, so the exposure log is the instrumentation that matters most.

## 3. The loop

**Phase 0. Foundations (session 1).** Produces the durable pack with census; the harness with T1, T2a, the ladder
and its controls; issue drafts for the exposure log and the reason tap. Exit: a red
team from another model family has tried to make the harness report a win that is not one, and every finding is
fixed or answered; a second family has reviewed `PROTOCOL.md`; the ladder table rebuilds from the ledger with one
command. No experiment result is believed before this exit.

**Phase 1. Measure with the data that exists (sessions 2 and 3).** Produces the ladder under T1 and T2a; T2b for every
rung. Exit: every cell of the decision table
in `DECISIONS.md` holds a number with an interval or the words "not measurable yet, needs X"; two reviewers that
are not the orchestrator's model have answered a gate review. The owner then confirms the direction of phase 2.

**Phase 2. Obtain new information (sessions 4 to 6, and calendar time).** Separate items: an offline simulation
of chosen questions against more ratings; a list-composition re-ranker (toward the member's own mix of kinds,
franchise cap, relevance floor) judged by T2a and T2b; the statement list with its facts fixed, and T5 for
the three formats; the specifications of 2.7 as issues; member recruitment; the first sealed checkpoint. Exit: D1
is decided offline and either established with the panel or blocked on a named panel size; D2 is decided by
the thresholds in 2.5; D3 has a T5 result.

**Phase 3. Decide, hand over, sleep.** Decision records with evidence; issues for whatever ships. The loop then
wakes only for a sealed checkpoint or when an instrument has gathered enough: 200 reasons, 300 new ratings, 20
panel members.

Parked: watch state as the outcome for shows (opens if the census finds 30 or more members with 5 or more started
shows that have a status); MovieLens item factors (movies only; commercial use needs permission); a fingerprint re-analysis audit; an editable written taste (a fourth
format for T5). Dropped from this loop: tonight versus taste (session context is a product feature); rating order
in the model (reopens only if T1 shows an entry-order penalty for B5).

### First three work items

**Item 001. Durable pack and census.** Builder. About 3 hours.

- Do: write `lab/pull.py` from the old `build_pack.py` and `add_scores.py` with the columns, provenance and
  privacy rules of 2.6. Run it once; that time is T0. Write the member split for tiers A and B with a fixed seed.
- Accept when: the pack is under `~/goodwatch-research/taste/packs/<date>/` with mode 700; `MANIFEST.json` and
  `CENSUS.md` are committed; rating and member counts match a `count(*)` taken at T0 (about 9,000 ratings, not
  7,200); every rating has both dates and a provenance value; a search of the pack for a raw member id finds
  none; a second run with the same `--until` gives the same hashes; the gate file is outside the lab folder.

**Item 002. Harness, ladder and controls.** Builder, then red team and protocol review. About 4 hours.

- Do: implement the contract, T1, B0 to B5 (B4 and B5 ported from `pooled/pool.py` unchanged), `run.sh`, the
  ledger, `gate.py`, `verify.py`, the table script. Write `PROTOCOL.md`.
- Accept when: each predictor runs in its own process from a view file that holds no hidden label; the T1 ladder
  table rebuilds from the ledger with intervals and smallest detectable effects; a shuffled-label run scores no
  skill against B0; a planted effect of 0.15 points is found; a predictor that tries to read target ratings or
  target times gets nothing; two predictor files with the same module name run without clashing; `verify.py`
  reproduces a run exactly; the full ladder runs in under 10 minutes on 2 threads; the red team's report and the
  protocol review are filed and each finding is marked fixed or answered.

**Item 003. The hidden-title test.** Builder, after item 002. About 3 hours.

- Do: implement T2a in the harness for the whole ladder plus vote count, over the reference pool.
- Accept when: for the owner, each rung reports where titles rated 8 or more, 6 to 7 and 5 or less land, with
  intervals, and the share of each in the first 50 and first 200; the same for members with 20 or more ratings,
  owner apart; GoodWatch score alone and vote count alone are in the table; a scorer that is given the hidden
  rating by mistake is caught by the leak canary; the orchestrator has read the first 20 titles each rung would
  show the owner; the result is written into `DECISIONS.md` under D1 as win, null or indistinguishable per rung.

Item 001 runs first. Then item 002, then item 003.

## 4. Orchestration

### Who orchestrates

**Claude Opus 5.5 at high effort, in short sessions: one phase step per session, restarted from `STATE.md`.**

- The first loop's costly errors were errors of judgment at the start (the wrong task, no analysis by the
  orchestrator, no review before round 1), made at low effort in one very long session. The fix is high effort,
  short sessions and reviews before experiments, not more throughput.
- Two of three designs chose Opus 5.5 high (Fable's and Astra's); Opus's own design chose Fable 5.1 high, because
  Opus already ran the first loop and Fable's review found the two analyses that changed the verdict. This plan
  keeps Opus as orchestrator so that Fable stays an independent reviewer of the orchestrator's choices; Fable
  cannot be both. If the owner prefers Fable as orchestrator, every mechanism below is unchanged and Opus takes
  Fable's reviewer seat.
- Not low effort: that is what let the orchestrator relay agents' tables untested. Not xhigh or max: the deep
  thinking is delegated to high-effort reviewers. Not Sonnet: saving on
  the judgment step risks repeating the first loop.
- Cost: the orchestrator's share stays a minority of tokens only if agents hand back files and sessions are short.

### Roles

| Role | Model and effort | Rules |
|---|---|---|
| Builder of the pull and the harness | Opus 5.5, high | A silent bug here corrupts every later number. The orchestrator runs the acceptance checks itself |
| Builder of pages, ports, issue drafts | Sonnet 5.5, medium to high | Checked by acceptance tests |
| Experimenter | Opus 5.5, medium to high, fresh context per brief | One pre-registered question; own folder; development tier only |
| Red team | GPT-6 Astra, high, through `codex exec` | Another family than the builder. Task: make the harness report a win that is not one; run analyses, do not only read |
| Protocol and gate reviewers | GPT-6.1 Sol, high, and Claude Fable 5.1, high, in parallel, no coordination | Two families at every gate; each runs at least one analysis of their own on tier A |
| Readers for T5 | Haiku 5.5, low, by Workflow fan-out; repeated with GPT-6 Astra | Two families so the result is not one model's habit |
| Writer | Sonnet 5.5, medium | Prose around tables a script builds from the ledger; types no number by hand |

### How agents are run

- **How many.** At most two agents that compute, at 2 threads each; reviewers and readers do not count. The
  machine has 8 cores and 16 GB shared with other sessions, and it stopped a job for low memory on October 13.
  `run.sh` takes one of two lock slots, sets thread limits, runs under `timeout` and `nice`, records a memory cap,
  and writes the ledger line. Check free memory and load before launching. Computation outside `run.sh` is not a
  result.
- **Briefs.** One folder per item in the repository, `items/NNN-name/`, with `BRIEF.md` in fixed sections: the
  question; the decision it feeds; inputs by path; what is forbidden; the pre-registration; the run budget; the
  hand-back. A brief never contains a tier B or tier C number.
- **Pre-registration.** `PREREG.md` is committed before the first registered run: hypothesis, task, candidate and
  reference rung, primary measure, guards, effect floor, the one analysis that will be reported, the stop rule.
  The harness refuses a registered run whose pre-registration is not committed.
- **Ledger.** `ledger.jsonl`, append-only, written only by the harness: run id, item, mode (`explore` or
  `registered`), commit, predictor hash, pack hash, tier, task, measures with intervals, seconds. Exploratory runs
  are logged too and cannot be cited as a win. Budget per item: 20 exploratory and 3 registered runs.
- **Hand-back.** `result.json`, written by the harness. The agent's final message is a report of at most 60
  lines: what was run, the verdict, what failed, what would overturn it. Subagents often cannot save report
  files, so the orchestrator saves that message as `REPORT.md` as its first act after the agent returns.
- **Verification before belief.** (1) Every number in a report carries a run id. (2) `verify.py` reruns the
  registered command in a fresh process and must match. (3) The orchestrator's own checks below. (4) For a win,
  one look at tier B. (5) For anything written as a finding, a reviewer from another family reads the item and
  reruns a part of it.
- **Review timing.** Before: red team and protocol review close phase 0. During: each claimed win gets step 5.
  After: a gate review of each phase's write-up before it is committed as findings. Codex reviews are saved with
  `-o`; Claude reviewers' final messages are saved by the orchestrator.
- **Over-running.** `run.sh` timeouts and slots; briefs forbid sleep loops, polling loops and background jobs; a
  wall-clock limit per item; after every agent the orchestrator lists lab processes and stops what is left.
- **State across sessions.** In the repository under `docs/research/taste-loop/`: `PLAN.md` (this file),
  `PROTOCOL.md` (the benchmark as implemented; a change needs a review), `STATE.md` (one page: phase, open items,
  next action, what the owner owes; read first, rewritten last), `DECISIONS.md`, `ledger.jsonl`, `items/`,
  `lab/`, `MANIFEST.json`, `CENSUS.md`. Data stays in `~/goodwatch-research/taste/`.

### The orchestrator's own checks

At every phase exit and for every claimed win, the orchestrator itself, not an agent:

1. Reads 20 raw input and output rows of the winner.
2. Prints the first 20 titles each scorer would show the owner and reads them.
3. Reruns the shuffled-label control.
4. Writes one sentence, "this would be wrong if ...", and runs that test.
5. Checks the effect by stratum: same sitting and later sitting, movies and shows, owner in and out.

## 5. Failure modes of the first loop, and what prevents each

| First-loop failure | Mechanism |
|---|---|
| The benchmark measured rating error on random holdouts of chosen titles | Five tasks tied to three decisions; T1 in entry order; ranking and judged pools decide D1; the protocol is reviewed before any experiment |
| The locked set was spent in three looks, and briefs published its results | Tier C regrows and each window is used once; tier B has a look budget and reports only replicated or not; briefs carry no held-out numbers |
| No pre-registration, unledgered sweeps | `PREREG.md` enforced by the harness; every run in the ledger; run budgets |
| Different output conventions and skill baselines | One contract; the harness rounds and calibrates; B0 is the only reference |
| Reports lived only in chat | The harness writes `result.json`; the orchestrator saves the final message as `REPORT.md` at once |
| Module-name clashes corrupted a scoring run | Each predictor runs in its own process, loaded by path |
| Stray wait loops, runs over budget, load 13 to 17, a job stopped for low memory | `run.sh` slots, timeouts, thread and memory limits; two computing agents at most; process sweep after each agent |
| Data and locked ratings in a temporary folder | Packs in `~/goodwatch-research/taste/`, manifest in the repository |
| The orchestrator ran no analysis of its own | The five checks above are exit conditions |
| Reviews came at the end | Red team and protocol review before any experiment; a reviewer on each win; a gate review per phase |
| Nulls written as "it cannot be done" | Every null carries its smallest detectable effect; a planted-effect control shows what the test can see |
| One member carried the main result | Owner and others always apart; a population fit without the owner; a panel decides D1 |
| An honour rule kept agents off hidden labels | Hidden labels are not in the file the predictor receives |
| Labels used as inputs (Want to See in the taste, a title's own favorite membership) | T2 builds the taste from history before the labels; Seen titles in the first 50 is a guard; a leak canary in item 002 |

## 6. Decisions for the owner

Each with the recommended answer.

1. **Does the owner label anything?** Decided by the owner on October 13, 2026: no re-rating, and the owner's
   existing ratings are the test, one hidden title at a time (T2a). Judged pools are for other members, later.
2. **May the exposure log and the low-rating reason tap ship before the loop has results?** Yes. Both only pay
   with calendar time, and neither depends on which scorer wins.
3. **May standardized fingerprints ship before a panel judges them?** Behind a flag, once T2 confirms the
   direction on T2a and T2b. It changes every Taste match value, so it needs the
   stored-taste version bump. Not as an automatic rollout.
4. **What would a predicted score mean beside Taste match?** Taste match keeps its meaning. A predicted score,
   if D2 ever says yes, is a second number with its own glossary entry.
5. **May models outside the Claude family read members' data?** Decided by the owner on October 13, 2026: yes,
   full access to whatever they need. Hashing ids in the pack stays as a default, not as a limit on reviewers. The
   rule that no rows of other members are committed to the repository is unchanged.
6. **When does member recruitment start?** As soon as phase 1 shows a challenger wins on T2a or T2b. If the
   scorers do not differ there, take the default and do not recruit for D1.
7. **Who guards the gate and sealed files?** A folder the agents are not told about is not an access boundary.
   Recommended: accept that for tier B, and for tier C rely on the data not existing yet; revisit if a result
   depends on it.
8. **Is the owner the target population?** No. The owner debugs instruments and supplies examples. No decision
   is established on the owner alone.
9. **What if the answer is "the scorer hardly matters at this scale"?** Treat "indistinguishable" as a result,
   keep the simple default, and move the effort to information: questions, reasons, exposure.
10. **Risk shown to members?** Internal until it is calibrated on tier C. Then as a plain phrase with the count
    behind it, not a percentage.

## 7. Where the designs disagreed

| Question | Fable | Opus | Astra | This plan |
|---|---|---|---|---|
| Orchestrator | Opus 5.5 high | Fable 5.1 high | Opus 5.5 high | Opus 5.5 high; Fable reviews |
| Forward test on existing data | By sittings: 11 members, mostly the owner | By entry-order blocks: 158 members | By rating days: 24 members | Entry-order blocks, with later-sitting targets reported apart |
| Held-out data before new ratings exist | None; time only | A gate of 35% of members | None; single-use batches only | The gate, as a replication check with a look budget |
| Predictions stored at rating time | A product table, the most important ticket | Not needed: frozen code plus sealed windows give the same test | Prospective logging | Frozen code and sealed windows first; the exposure log is the ticket that cannot be rebuilt later |
| Re-rating as a stop rule | Stop if forward error is within 0.1 of re-rating error | Floor is 0.71 times the re-rating difference; room decides | No automatic rule; it informs | Dropped: the owner decided against re-rating |
| Standardized fingerprints before a panel | Yes, behind a flag, once exposure is logged | Yes, behind a flag, once T2 and the owner's pools agree | No automatic rollout | Behind a flag once T2a and T2b agree; the owner decides |
| Concurrency | Two experimenters and a reviewer | Three computing agents | Two workers, one thread each | Two computing agents, 2 threads each |
| Sides of you by default | Decide by recognition test | Keep; use sides to compose lists if T3 shows it helps | Keep until a challenger passes | Keep until a challenger passes |
