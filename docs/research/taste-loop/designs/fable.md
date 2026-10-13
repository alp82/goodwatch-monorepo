# A research loop for taste, recommendations and score prediction (design by fable)

Terms are from `CONTEXT.md`: Want to See, Not interested, Skip (passed in the taste quiz), Seen, Dropped, Taste, Taste
match, Side of you, Fingerprint, For you, Best match, Discover, Watch next, worthwhile suggestion (appealing, unfamiliar,
available on the member's services). "Verified" means I computed it on the old data file today; everything else is
design.

Facts verified today that shape the design (development ratings: 231 members, 7,210 ratings, 4,446 titles):

- Only 11 members (the owner and 10 others) have 10 or more ratings before a later rating session with 5 or more
  ratings. Every other member rated in one sitting: median one session, one day. So a forward-in-time test on the
  data we have is an owner test plus a handful of members. The forward test the product needs must come from new
  ratings.
- 88.6% of all ratings fall in each member's single biggest 6-hour session. 407 ratings share one exact timestamp with
  20 or more others of the same member (bulk entry or import). The owner has 80 sessions over 73 days and 869 days of
  span; the three biggest sessions hold 289, 112 and 77 ratings. The owner's fifths by time average 7.73, 7.15, 6.66,
  6.88, 7.17 with 3.4%, 10.1%, 13.4%, 11.4%, 8.8% rated 5 or less.
- Recommendation proxy labels exist for more members than ratings do: 142 members have unrated Want to See titles
  (1,904 entries; 36 members with 10 or more; the owner 272) and 167 members have Skips (13,509 entries; 113 with 10
  or more; the owner 132). 28 members have 10 or more of each; 45 have 5 or more of each.
- 4.0% of ratings are of titles released within a year of the rating. Ratings are memories, not reactions to a
  recommendation. 4,807 ratings are of movies, 2,403 of shows.

## 1. Goal

The loop exists so that a member of GoodWatch finds a worthwhile suggestion sooner: the first ten titles under Best
match or For you contain more titles they want to see and fewer they would pass on; the Taste page says things about
them that they recognise as theirs and that are factually right; and any number shown beside a title (taste match, a
predicted score, a risk) means what it says when checked against what the member does next. It is not trying to lower
rating error on random holdouts, to beat the public score at predicting ratings of titles a member already chose to
watch, to replace Sides of you on rating-error evidence, or to build a new recommendation model inside a research
session. Product code ships through normal development from tickets the loop writes.

The loop must be able to make three decisions. Each names its evidence in advance.

| Decision | Evidence that settles it |
|---|---|
| **D1. Which scorer orders unseen titles** under Best match and For you on Discover and Watch next: today's taste (raw cosine, `2P - N`), the standardized-fingerprint taste, the calibrated public score, or the frozen pooled predictor. | Offline: the ranking task T1 on 28 or more members, paired against today's taste. Online: a blind judged pool of 20 or more members (T1-online), worthwhile suggestions in the first ten, paired per member. A scorer replaces today's taste only if it wins both, or wins online with offline not worse. |
| **D2. Whether to show a predicted score and a risk of a low rating**, and from how many ratings. | The forward rating task T2 and the risk task T3 on ratings written after the freeze date with the prediction stored at the time (nobody has seen them), 300 or more ratings from 15 or more members; plus the error floor T5. Show a number only if it beats the member's median by the margin in 2.4 and the risk is calibrated forward; show nothing if the forward error is within 0.1 of the re-rating error. |
| **D3. What the Taste page shows**: Sides of you, the statement list, or a combination; and whether new members are asked questions instead of more ratings. | The recognition test T4 (a member picks their own description among three) and per-line accuracy judgments from 15 or more members; for questions, the offline simulation then an onboarding test measured on later ratings and T1-online. |

## 2. Benchmark setup

### 2.1 Tasks

Every task has a protocol, labels, eligible members and titles, one primary metric and guard metrics. The harness
computes all metrics; predictors return raw outputs only (2.3).

**T1. Ranking unseen titles (the recommendation task, offline).**
Protocol: for each eligible member, the predictor sees the member's ratings only (no Want to See, no Skip, no Not
interested; today's taste runs with its Want to See weight off, because the label would otherwise be an input). It
scores every title in the candidate universe U the member has not rated. U is the set of presentable titles with
enough votes to cover at least 90% of all members' Want to See adds; W1 measures the vote threshold that achieves it
(expected: a few tens of thousands of titles). Labels: positive = the member's unrated Want to See titles; negative =
Not interested titles and quiz Skips, reported separately and together (Skip means passed in the quiz, a weaker
negative). Members: 10 or more positives and 10 or more negatives (28 today, verified). Primary metric: AUC of
positives against negatives, per member, then paired differences against today's taste. Second metric: recall at 50 of
the member's most recent quarter of Want to See adds (by `created_at`) among all unrated titles in U; this is the
only full-universe metric and the one closest to the product. Guards: share of shows in the top 50 against the share
of shows among the member's rated titles; most repeats of one franchise in the top 50 (cap 3); mean GoodWatch score of
the top 50 (a quality-only list is a failure mode, not a win); share of the top 50 the member has Seen (must be 0;
leak check).

**T1-online. Judged pool.** Protocol as in `next-branches.md` branch 2 step 2: each member sees about 24 unseen,
eligible titles, mixed in equal numbers from today's taste, the standardized taste, the frozen pooled predictor and a
random eligible sample, order randomised, method hidden. Answers per title: know it already; looks appealing; Want to
See. Primary: worthwhile suggestions (appealing and unfamiliar) among a method's six, paired per member across methods.
Guard: "know it already" rate per method. Smallest version: the owner alone, on day 2 of the loop (section 2.6).

**T2. Forward rating prediction.**
Protocol: sort a member's ratings by write time; cut into blocks: a new block starts after a 6-hour gap, and every set
of 20 or more ratings with one identical timestamp is one bulk block whose internal order is unknown. Predict each
block from all earlier blocks, never from inside the same block; require 10 or more earlier ratings. Members: anyone
with a block to predict (11 today, verified; the owner supplies most of the ratings). Prospective version: ratings
written after the freeze date F0, predicted by the frozen candidates as of F0 (section 2.2), which is the real T2 and
is replenished by the prospective log. Primary metric: mean absolute error of the rounded prediction, as a paired
difference against baseline B0 (the member's median of earlier ratings). Secondary: Spearman within each block, pooled
across blocks. Guards: error on titles rated 5 or less; mean prediction for those titles; both reported, neither
optimised. Skill is reported once, against B0 only, on one scale.

**T3. Risk of a low rating.**
Protocol as T2; the predictor returns `p_bad`, the probability of a rating of 5 or less. Primary: Brier skill against
the member's own base rate from earlier ratings. Guards: reliability table in bins of 10 points with the count per
bin (a bin under 30 titles is shown greyed, not interpreted); precision and recall at a fixed flag budget (the 20% of
titles with highest risk). Owner-excluded aggregates alongside.

**T4. Taste a member recognises (not offline).**
Protocol: a member sees three descriptions with titles named but not the member's rating of them: their own and two
from members with a similar number of ratings; they pick theirs, then mark each line of their own as right, partly
right or wrong, and name one wrong example. Three presentations in randomised order across members: Sides of you as
built, the corrected statement list, a combination. Primary: recognition rate (chance is 33%). Guards: share of
lines judged right; share of examples judged wrong; the owner-only result reported separately.

**T5. Error floor (re-rating).**
Protocol: a member re-rates 20 to 60 titles they rated two or more weeks ago, old rating, public score and prediction
hidden, sampled across low, middle and high original ratings and both movies and shows, with "rewatched since?" asked
per title. Both ratings are kept; nothing is overwritten. Derived for free first: pairs where `user_import_item`
holds a rating of the same title from another service on another date. Metrics: mean absolute difference, exact
agreement, crossings of the 5-or-less line, pairwise order stability. The floor is used as a stop rule in D2, not
divided by two and called a model limit.

### 2.2 Splits and the final test that cannot be spent

- **Freeze date F0** is the day of the new pull. Everything written before F0 is development data, including the old
  locked quarter: it was looked at three times, so it is retired into development and never called a test again.
- **The final test is time, not a sample.** It is the ratings, Want to See adds and Not interested marks written
  after F0, together with the stored prediction each frozen candidate made for that member and title before the
  action (the prospective log, section 2.5). Nobody looks at it except the orchestrator, once per phase, for
  pre-registered candidates only. Each confirmation run consumes its window: the next confirmation uses only actions
  written after the previous confirmation. Results go to `results/`, never into a brief for an agent still working.
- **Who sees what.** Experimenters: the development pack only, pinned to F0 by file name and checksum. The
  orchestrator: both. Reviewers: both, after the confirmation they review. The owner's own ratings written after F0
  are in the final test like anyone's; the owner does not see predictions for titles before rating them (nothing is
  shown in the product).
- **How new ratings enter.** `pull.py --until <date>` writes `pack-<date>.pkl` and a manifest line (counts, checksums).
  The development pack stays `pack-F0.pkl` for the whole loop. A new development pack is cut only at a phase boundary,
  and then F0 moves forward and the old final-test window becomes development.
- **Development folds inside F0.** For T2 the block-forward protocol above. For T1 there is no fold: labels are not
  inputs. Model selection within an agent's work uses nested folds on development data; the harness offers
  `bench.inner_folds()` so nobody writes their own.

### 2.3 Fixed baselines, one output convention, uncertainty

Five frozen candidates, each a file under `bench/baselines/` with its commit hash in `CANDIDATES.md`; none is edited
after the design review:

| Id | Candidate | Role |
|---|---|---|
| B0 | The member's median of visible ratings | Constant; the skill reference (verified stronger than the mean: 0.053 skill alone) |
| B1 | GoodWatch score shifted by the member's offset (`everyone_shift`) | The public-score baseline every personal method must beat |
| B2 | Today's taste: raw-fingerprint cosine, `2P - N`, Want to See off, mapped to a score by the member's own range | What the product does |
| B3 | Standardized-fingerprint cosine, same mapping | The one change all reviewers back |
| B4 | The frozen pooled predictor (round 3 leader, `lab/agents/scores/best.py`, continuous output, caches rebuilt from the pack) | The research candidate |

One output convention. A predictor is `predict(D, user, tr_idx, tr_y, te_idx) -> {'score': float[1..10], 'p_bad':
float[0..1] or None, 'rank': float or None}`. The harness rounds `score` to a whole number for error metrics, uses
`rank` (default `score`) for ranking, and `p_bad` for T3. No `alpha`, no band-weighted median: a decision rule is a
product choice and is evaluated separately as one if the owner wants it. A predictor that returns anything else fails
the run.

Uncertainty. Every comparison is a paired difference against the named baseline, per member, then resampled:
for the 22-plus other members, a bootstrap over members (1,000 draws) giving the mean, the median and a 90%
interval; for the owner, a block bootstrap over rating blocks (sessions), never over single ratings, because ratings
in one session are not independent. Tables show the baseline value, the difference and its interval; never two
unpaired columns. "Differences under 0.02 are noise" is retired; the interval decides.

### 2.4 What counts as a win, a null and a stop

Decided now, written into `prereg.jsonl` per experiment before it runs.

| Task | Win | Null | Stop |
|---|---|---|---|
| T1 offline | AUC difference against B2 at least +0.02 with the 90% interval above 0, recall at 50 not worse, guards within limits | Interval includes 0 | Guards fail (show share off by more than 15 points, franchise repeats above 3, Seen titles in the top 50), or B1 wins |
| T1 online | At least one more worthwhile suggestion per ten, interval above 0, 20 or more members | Interval includes 0 | "Know it already" above 50% for the method |
| T2 prospective | MAE at least 0.05 below B0 and 0.03 below B1, intervals above 0, 300 or more ratings from 15 or more members | Otherwise | Forward MAE within 0.1 of the T5 re-rating MAE: stop modelling the score |
| T3 | Brier skill above 0 with interval above 0; reliability within 5 points in every bin of 30 or more titles | Otherwise | Any populated bin off by more than 10 points: risk stays internal |
| T4 | Recognition at least 60% over 15 or more members and 80% of lines judged right | Otherwise | Recognition at chance: the description is not personal; do not ship it |
| Phase | Two pre-registered attempts in a row return null | | The phase ends; the orchestrator writes why |

A null at these sizes reads "not shown at this size", never "no effect". An exploratory run (no pre-registration id)
is logged but cannot be cited as a win.

### 2.5 The data pull

One read-only pull from production Crate and Qdrant, `loop2/bench/pull.py`, rebuilt from `lab/build_pack.py` and
`lab/add_scores.py`. Never a write to production. Columns per table:

- `user_score`: user_id, tmdb_id, media_type, score, created_at, updated_at. **New:** created_at.
- `user_wishlist`: plus created_at (exists, undeclared in `crate_schemas.py`; 2,015 rows had it in September). **New.**
- `user_not_interested`: user_id, tmdb_id, media_type, created_at. **New.**
- `user_skipped`: plus created_at. `user_favorite` as before.
- `user_import`, `user_import_item`: source service, source rating and scale, date rated, matched tmdb_id and media
  type, import time. **New;** provenance and natural re-ratings.
- `user_watch_state` (show status and its time) and `user_watch_log` (episode watches with timestamps). **New;**
  pulled now, used from phase 4.
- `user_setting`: country and saved services only, for the "available" half of worthwhile suggestion in T1-online.
  **New.** No other settings.
- `movie`, `show`: the columns of `build_pack.py`, plus release_date, `movie_series_id` and the TMDB collection for
  sequel order (the sequel flag comes from this, never from digits in a name), per-season scores as in round 3. For
  the universe U: fingerprint, genres, year, media type, popularity, every public score with its vote count, franchise
  id for every title in U; text columns and embeddings for titles any member interacted with (as before) and for U if
  the pack stays under about 500 MB, else for the 20,000 most-voted titles of U.
- Qdrant: the two text embeddings, as before.
- `streaming_availability`: not in the pack; T1-online eligibility is computed at pool-building time by a separate
  read for the panel members' countries.

Provenance. Every rating gets `block_id` and `block_kind`: `import:<service>` when an import item of the same member
and title matches the score and the import time; `bulk` when 20 or more ratings share one timestamp; `session`
otherwise (6-hour gap rule). T2 never predicts inside a block. Reports break results down by block kind.

Where it lives. Outside the repository and outside `/tmp`, in `~/research-data/taste-lab/` (owner confirms the
path): `pack-<date>.pkl`, `MANIFEST.json` (date, row counts per table, sha256, the vote threshold of U, the pull
script's commit). The repository holds the scripts and the manifest copy, never the pack. A rebuild with the same
`--until` date must reproduce the manifest counts.

Privacy. Member ids are replaced by a salted hash at pull time (the salt stays in the data folder); the owner is
`owner`. No emails, handles, review text or free text of any member enter the pack. Reports name members only by the
hash's first 8 characters. Judged-pool and re-rating answers are stored in the same folder as CSV with the hashed id.

### 2.6 What cannot be measured offline, and the smallest version of each

| Need | Why offline fails | Smallest version | Full version |
|---|---|---|---|
| Whether a list has more worthwhile suggestions | Want to See leans popular and curious; nobody logged what was shown | The owner judges three blinded lists of 24 on day 2 (one hour); the result is provisional and owner-only | 20 to 30 members through a one-page in-product judged pool (ticket), two to four weeks |
| The error floor | One rating per member and title | Count natural re-rating pairs from `user_import_item` (free, day 2); the owner re-rates 60 titles after two weeks, blind | 20 members re-rate 20 titles each, two sessions, two to four weeks apart |
| A forward test nobody has seen | 11 members have later sessions | The prospective log: on every rating, Want to See and Not interested write, store the five frozen candidates' outputs for that member and title with model version and rating count (a Crate table or PostHog event; no member-facing change) | The same, plus exposure logging: surface, position, candidate set, model version, one randomised slot with its probability |
| Whether members recognise their taste | Statistical replication is not recognition | The owner and five members pick their own among three (a document, an hour each) | 15 or more members, three presentations, per-line judgments |
| Why a low rating happened | No "why" exists | One-tap reason after a rating of 5 or less (ticket, a day) | Analyse after 200 answers |
| Whether questions beat ratings | Simulation on rated titles overstates answerability | Offline: from 5 visible ratings, 3 chosen pairs against 3 random ratings, measured on the member's later blocks | Onboarding test with a fixed question budget, measured on later ratings and T1-online |

## 3. The loop

Phases in order. Each names what it produces and its exit test. One phase per session where possible; a phase that
waits on members is calendar time with short check-in sessions.

### Phase 0: Foundations (session 1, about one day)

Produces: `loop2/bench/` (pull, harness v2 with T1, T2, T3, the output contract, baselines B0 to B4, paired bootstrap,
pre-registration and ledger), `pack-F0.pkl` with manifest, the baseline table, and a design review by two reviewers
from a different model family before any experiment. Branches: none yet; branch 1's offline half (the forward split)
is part of the harness. Exit: the three work items below pass their acceptance checks; the reviewers' blocking
findings are fixed or logged with a reason; `loop2/README.md` says "Phase 0 done" with the baseline table.

### Phase 1: Measure what we already have (session 2, one to two days)

Produces: the offline half of D1 and the offline part of D2. Branches: 1 (forward test on the owner and the 10
members, all five candidates); 2 step 1 (T1 offline on 28 members, all five candidates, plus the Seen leak check);
3 derive (count and analyse import pairs; if 200 or more pairs exist, report the natural re-rating MAE at once); 5
"fix the facts" (sequel from franchise data, trust numbers from out-of-fold predictions, plain wording); further
branch "rating order in the model" as a B4 variant with a position-indexed offset (hours, pre-registered); further
branch "smaller pooled model" (Sol F) as the production-shaped form of B4 with pooled thresholds, one agent, judged
on T1 and T2 only against B4. Dropped from phase 1: every new title-side feature or model family. Exit: a decision
memo for D1-offline (win, null or stop per candidate with intervals); a go or no-go for showing any number offline;
the T5 pair count; the corrected statement list regenerated for the owner. The owner judges the three blinded lists
(T1-online smallest version) during this phase.

### Phase 2: Obtain new information (weeks 1 to 4 elapsed; sessions of an hour)

Produces: the instrumentation tickets, written as specs from the harness's contract, and the member studies. Tickets:
the prospective log (branch 1 logging), exposure logging with one randomised slot (branch 2 step 3), the in-product
judged pool page (branch 2 step 2), a re-rating page that hides the old rating (branch 3), the one-tap reason on a low
rating (further branch "ask why"), and a flag for standardized fingerprints in today's taste (what the results
support, item 1; measured through the exposure log, not assumed). Studies: the owner's re-rating at two weeks; the
recognition test with the owner and five members by document; recruiting 20 to 30 members for the judged pool and
recognition test. Branches: 1 logging, 2 steps 2 and 3, 3 obtain, 5 reader test, ask why. Exit: the prospective log
has 300 or more post-F0 ratings from 15 or more members, or six weeks have passed; 20 or more members judged a pool;
T5 has 20 or more members or the owner's 60 plus the import pairs.

### Phase 3: Decide (session after phase 2's data, one day)

Produces: D1, D2 and D3 as decision memos in `DECISIONS.md`, each with the pre-registered thresholds, the measured
differences with intervals, and the ship list as tickets. The confirmation runs on the final test happen here, once.
A reviewer from a different family reads the memos and the code before the owner acts. Exit: each decision is win,
null or stop with its evidence; the owner has signed the ship list; nulls say what size would have shown an effect.

### Phase 4: Only what the decisions open (conditional)

If D2 says the floor leaves room: nothing new on the score model until the prospective log has 1,000 ratings. If D3
says descriptions are recognised: branch 4 (ask informative questions), offline simulation first, then the onboarding
test. If D1 picks a scorer: branch 5's re-ranker (calibrated toward the member's mix of the six shared kinds, franchise
cap, relevance floor) judged by T1-online. Branch "shows: watch state as the outcome" (B7) once `user_watch_log`
covers 30 or more members with 5 or more started shows. Parked, not dropped: MovieLens item factors (licence, movies
only, low confidence until T1 exists), the fingerprint audit (reopen if a result depends on attribute reliability),
the editable written taste (a D3 variant after recognition is established), tonight versus taste (the product collects
no session context yet).

### The first three work items (session 1)

**W1. The pull and the pack.** Write `loop2/bench/pull.py` from `lab/build_pack.py` and `lab/add_scores.py` with the
tables and columns of 2.5, provenance blocks, hashed ids, `--until`, the universe U and `MANIFEST.json`. Acceptance:
runs end to end in under 15 minutes against production read-only; the manifest counts match independent `count(*)`
queries; every rating has `block_id` and `block_kind`; every Want to See, Not interested and Skip row has
`created_at`; the retired locked quarter is inside the pack (total ratings about 9,000, not 7,200); U's vote
threshold is recorded with the share of Want to See adds it covers (at least 90%); no clear member id or email
appears in the file (a grep over a JSON dump finds none); the pack sits in `~/research-data/taste-lab/` and the
manifest copy in the repo.

**W2. Harness v2.** Write `loop2/bench/` with `Data` (offering `D.hide(user)` so a predictor cannot read the predicted
member's ratings even by accident), T1, T2, T3, the output contract, `inner_folds`, baselines B0 to B4 (B4's caches
rebuilt from the pack in a setup step), the paired bootstrap, `prereg.jsonl`, `ledger.jsonl` (every run, quick runs
flagged), and `run.py` that runs one predictor file per process with `python -I`, `OMP_NUM_THREADS=2`, `nice`, and a
360-second timeout. Acceptance: all five baselines complete T1 and T2 in under 5 minutes each with 2 threads; the
owner's forward T2 for a boosted-trees reference lands within 0.02 of the review's 0.908 MAE and 0.451 rank
agreement; T1 for the owner reproduces 0.60 (B1), 0.63 (predicted rating) and 0.66 (B3) within 0.02; a leak canary
predictor that tries to read the hidden ratings raises; a canary that returns a float array instead of the dict is
rejected; two predictor files with the same module name run without clashing; the ledger row carries the pack checksum
and the pre-registration id.

**W3. Design review, then the baseline table.** Before any experiment, send the benchmark (sections 2.1 to 2.5 as
implemented, the harness code and W1's manifest) to two reviewers: GPT-6.1 Sol via `codex exec` at high effort and
Claude Fable 5.1 at high effort, each with the checklist: label leakage into inputs, time order, block definition,
baseline strength, metric choice, sampled-metric traps, privacy. Fix blocking findings. Then run the pre-registered
comparison of B1 to B4 against B0 and B2 on T1 and T2, and write `results/baseline-<F0>.md` with paired intervals.
Acceptance: both reviews are saved under `reviews/design/`; each blocking finding has a fix commit or a logged
reason; the baseline table exists with intervals; D1-offline is answered as win, null or stop per candidate; the
orchestrator has run its own three sanity checks and written them into the results file: the block structure
(members with later blocks, share of ratings in bulk blocks), the Seen leak check on every candidate's top 50, and B0
against the mean.

## 4. Orchestration

### Who orchestrates

**Claude Opus 5.5 at high effort.** The orchestrator's job is bookkeeping, judgment and confirmation: pin the
pack, write briefs, launch at most a few agents, re-run their predictors itself, run the confirmation, write decision
memos, keep `README.md` current. The old loop's failures were judgment failures (no time-order check, published
locked results, no pre-registration) made at low effort in one very long session; the fix is high effort for the
orchestrator and short sessions, not more throughput. Why not the alternatives: Sonnet 5.5 is fine for builders but
the loop failed on judgment, not speed; Fable 5.1 as orchestrator spends the one model that should stay independent
of the orchestrator's choices, and the brief's lesson is that a review by a different model found more than another
round; xhigh or max effort for the orchestrator buys little because the hard thinking (design, review, decisions)
is delegated to high-effort reviewers and the orchestrator's own analyses are short scripts. Cost: the orchestrator's
turns are a minority of the loop's tokens (agents dominate); raising its effort from low to high perhaps doubles that
share, which is less than the three end-of-loop reviews cost last time. One session per phase keeps context under
control; the 1M window is a safety margin, not a plan.

### Roles, models, efforts

| Role | Model and effort | Why | Rules |
|---|---|---|---|
| Builder: pull and harness (W1, W2) | Opus 5.5 high | The harness is the foundation; a bug here poisons every number | Writes only under `loop2/bench/`; acceptance checks are run by the orchestrator, not reported by the builder |
| Builder: tickets and specs | Sonnet 5.5 high | Well-specified writing from the harness contract | Uses `docs/agents/issue-tracker.md`; never invents numbers |
| Experimenter | Opus 5.5 high, fresh context per brief | One direction, one pre-registered question | Own folder only; development pack only; at most 12 ledgered runs per brief; hands back files (below) |
| Reviewer (design, results) | GPT-6.1 Sol via `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high` and Claude Fable 5.1 high, in parallel, no coordination | A different model family on purpose; the old loop's reviewers found errors by running small analyses | Read-only; may run read-only analyses on the development pack; writes to `reviews/` |
| Red team | GPT-6 Astra via codex, high | Tries to break the benchmark: find a way to leak labels, exploit the block rule, game a guard | Read-only sandbox; one brief per phase |
| Writer | Sonnet 5.5 medium | Reports and README updates from `ledger.jsonl` and `results/` | Every number must be traceable to a ledger row; the orchestrator spot-checks three per report |
| Mechanical checks | Haiku 5.5 low | Schema validation of ledger and prereg rows, manifest diffs | Scripts, not judgment |

### How many at once, briefs, hand-back, verification

- **Concurrency:** at most two experimenters and one reviewer at once. The machine has 8 cores shared with other
  sessions; each run is pinned to 2 threads with `nice`; the orchestrator checks the load average before launching
  and waits if it is above 6. Confirmation runs are a shell script (`bench/confirm.sh`, one process per predictor,
  deterministic), not an agent.
- **Briefs** are files, `loop2/briefs/<phase>-<id>-<name>.md`, from one template: the question; the hypothesis; the
  pre-registration row (task, primary metric, baseline, threshold, allowed runs); the pack path and checksum; what is
  forbidden (post-F0 data, other agents' folders, network, production, installing packages, background loops); the
  compute budget; the deliverables and their schema; what is already known (development results only, never a
  final-test number). A fresh agent knows only its prompt, so the brief points at every file it needs by absolute
  path.
- **Hand-back** is files, not chat: `loop2/agents/<id>/predictor.py` (the contract), `REPORT.md` (template: question,
  table of ledgered runs, what held and why it is not noise, what failed, next step), and the harness-written
  `runs.jsonl`. The orchestrator creates the agent's folder before launch so the Write tool has a permitted target;
  the brief says to use a shell heredoc if a write is refused; if `REPORT.md` is still missing, the orchestrator
  saves the agent's final message there itself. The ledger exists whether or not the report does.
- **Verification before belief:** the orchestrator re-runs `predictor.py` in a fresh process on the development pack
  and requires the metrics to match the ledger within 0.005; runs the leak canary; checks the top-50 Seen share;
  checks that the run count did not exceed the pre-registered allowance. Only then does the predictor enter
  `CANDIDATES.md`, and only pre-registered candidates reach a confirmation run.
- **Pre-registration and ledger:** `prereg.jsonl` row before the first run (id, hypothesis, task, metric, baseline,
  threshold, allowed runs, author, date); every harness run appends to `ledger.jsonl` with the prereg id, the pack
  checksum, the predictor file hash, timing and all metrics; `--quick` runs are logged too, flagged. Rows without a
  prereg id are exploratory and uncitable.
- **Independent review** happens three times: before (W3, on the benchmark), during (after each phase's confirmation,
  on code and memos), after (on the final write-up). Reviewers get the pack and may run analyses; their findings are
  filed as issues against the harness or the memo and resolved before the next phase.
- **Overfitting and over-running:** frozen candidates; a time-based final test consumed per confirmation; one output
  convention; metrics only from the harness; the median baseline; a run budget per brief; a null budget per phase;
  `run.py`'s timeout, thread cap and `nice`; a brief line forbidding wait loops; the orchestrator kills stray
  processes at the end of each agent.
- **State across sessions** lives in the repository under `docs/research/taste-prediction/loop2/`: `README.md`
  (Where we are: phase, open items, next action; the first thing a new session reads), `PLAN.md` (the merged design),
  `DECISIONS.md`, `CANDIDATES.md`, `bench/`, `briefs/`, `agents/`, `results/`, `reviews/`, `prereg.jsonl`,
  `ledger.jsonl`, `data/MANIFEST.json`. The data lives in `~/research-data/taste-lab/`. The old `lab/` stays as the
  record of the first loop.

### Failure modes of the old loop and the mechanism that prevents each

| Old failure | Mechanism |
|---|---|
| Benchmark measured the wrong task (random holdouts of chosen titles) | T1 on unseen titles is the primary task for D1; T2 is block-forward and prospective; the design is reviewed before any experiment |
| Locked results published in briefs; the locked set spent | A time-based final test consumed per confirmation; briefs carry development results only; the old locked quarter is retired into development |
| No pre-registration; unledgered sweeps | `prereg.jsonl` before the first run; every run ledgered, quick runs flagged; exploratory rows uncitable; 12 runs per brief |
| Different output conventions and skill baselines | One output dict; the harness rounds; skill only against B0 |
| Reports lived only in chat | Folder pre-created; heredoc fallback; the orchestrator saves the final message; the ledger is independent of the report |
| Module-name clashes corrupted a locked run | One process per predictor via `run.py` with `python -I`; shared code only in `bench/lib/`; no imports across agent folders |
| Stray wait loops; load 13 to 17; runs over 5 minutes | `run.py` timeout 360 s, 2 threads, `nice`; two experimenters at once; load check before launch; process cleanup after each agent |
| Data in a temporary folder, gone after the session | `~/research-data/taste-lab/` with a manifest in the repo; `pull.py --until` reproduces it |
| Orchestrator ran no analysis of its own | W3 requires three orchestrator-run sanity checks in the results file before the first comparison |
| Review only at the end | Review before (design), during (each confirmation), after; red team per phase |
| One member carried the result | Every table owner-included and owner-excluded; member-level paired bootstrap; the owner's T1-online result is labelled provisional until 20 members judge |
| Labels used as inputs (Want to See in the taste vector; favourite membership) | B2 runs with Want to See off in T1; `D.hide(user)`; Seen share in the top 50 is a guard; leak canary in W2 |

## 5. Kickoff prompt

Paste into a new Claude Code session with Opus 5.5 at high effort, in `/home/alper/projects/goodwatch-monorepo`.

```
You are the orchestrator of the second taste research loop for GoodWatch, phase 0. You make decisions, write
briefs, verify results and keep state in files; you do not run model sweeps yourself. Proceed without asking for
permission, except for three things that always need the owner: anything that writes to production (never do it),
contacting members, and spending money on APIs.

Read in this order, all of it:
1. docs/research/taste-prediction/loop2/PLAN.md: the plan you execute (goal, benchmark, phases, orchestration,
   win/null/stop rules). Follow it; where it is silent, choose the option that keeps the final test unseen.
2. docs/research/taste-prediction/README.md, section 11 first, then the rest: what the first loop found and the
   corrections to it.
3. docs/research/taste-prediction/next-branches.md: the merged branches and what to stop.
4. docs/research/taste-prediction/reviews/*.md: the three reviews. Note what each reviewer verified by analysis.
5. docs/research/taste-prediction/lab/harness.py and lab/build_pack.py, lab/add_scores.py, lab/gw.py: the old
   harness and the read-only pull you rebuild from. lab/agents/scores/best.py is the frozen pooled candidate.
6. CONTEXT.md: the glossary; use its terms exactly (Want to See, Not interested, Skip, Taste match, Side of you,
   worthwhile suggestion). AGENTS.md and docs/agents/issue-tracker.md for how tickets are filed.
7. goodwatch-webapp/app/server/taste/formula.server.ts: today's taste formula, which baseline B2 must reproduce.

Rules for the whole loop:
- Production Crate and Qdrant are read-only sources. Never write to them. Never query them from an experimenter.
- The data file lives in ~/research-data/taste-lab/ (create it), never in the repository or /tmp. Member ids are
  hashed at pull time. No emails, handles or free text enter the pack.
- The final test is everything written after the freeze date F0 (today). Only you look at it, once per phase, for
  pre-registered candidates. Never put a final-test number into a brief for an agent that is still working.
- Every predictor returns the output dict of PLAN.md section 2.3; the harness computes all metrics and rounds.
- Every full run is ledgered with a pre-registration id. Runs without one are exploratory and cannot be cited.
- At most two experimenters and one reviewer at once. Every run goes through bench/run.py (own process, 2 threads,
  nice, 360 s timeout). Check the load average before launching agents.
- Reviews by a different model family happen before the first experiment. Use codex exec -m gpt-6.1-sol -c
  model_reasoning_effort=high and a Claude Fable 5.1 subagent at high effort, in parallel, with the checklist in
  PLAN.md W3.
- State lives in docs/research/taste-prediction/loop2/: README.md (keep a "Where we are" section current after
  every work item), DECISIONS.md, CANDIDATES.md, bench/, briefs/, agents/, results/, reviews/, prereg.jsonl,
  ledger.jsonl, data/MANIFEST.json. Create the tree first.

Phase 0 has three work items, PLAN.md section 3 "The first three work items": W1 the pull and the pack, W2 harness
v2, W3 design review then the baseline table. Do W1 and W2 with one builder subagent each (Opus 5.5, high effort),
sequentially, each with a brief file you write first from the template in PLAN.md section 4. Run every acceptance
check yourself; do not accept the builder's word. Then run W3: send the benchmark for review, fix blocking
findings, run your own three sanity checks, run the pre-registered baseline comparison through bench/confirm.sh,
and write results/baseline-<F0>.md with paired intervals.

Before you launch anything, write loop2/README.md with: F0, the path of the pack, the phase, and the three work
items with their acceptance checks as checkboxes. Update it after each item. End the session by writing the
"Where we are" section so that the next session can start from it alone, and tell the owner in five lines what
phase 1 needs from them (the hour of blinded list judging, the re-rating appointment two weeks out, and which
tickets to approve).

Verified facts you should expect: about 231 members and 9,000 ratings; 88.6% of ratings fall in each member's
biggest 6-hour session; only 11 members have 10 or more ratings before a later session, so the forward test on
existing data is the owner plus ten; 28 members have 10 or more unrated Want to See titles and 10 or more Skips.
If the new pack disagrees with these by more than 10%, stop and find out why before going on.
```

## 6. Risks and open questions

Each with my recommended answer.

1. **The forward test on existing data is almost owner-only** (verified: 11 members). D2 cannot be settled from
   existing data. Recommendation: approve the prospective-log ticket in week 1 and treat it as the loop's most
   important engineering item; until it has 300 ratings from 15 members, D2 stays "do not show a number".
2. **Recruiting 20 to 30 members is slow.** Recommendation: the owner judges blinded lists on day 2 as a provisional
   T1-online, and the judged pool and recognition test ship as one in-product page rather than emailed documents;
   accept a phase 3 decision on 20 members and say so in the memo.
3. **Want to See is a biased positive and Skip a weak negative.** Recommendation: report Not interested and Skip
   negatives separately; require the win against both; the exposure log with one randomised slot is what replaces
   the proxy, so ship it in phase 2 even though replay on real choices will take months to accumulate.
4. **Where the data lives.** Recommendation: `~/research-data/taste-lab/` on this machine, with the manifest in the
   repo; the owner confirms the path and that the folder is backed up or acceptable to lose and rebuild.
5. **Whether to ship standardized fingerprints before the measurements exist.** Recommendation: yes, behind a flag,
   once the exposure log exists so the change is measured; it is the one result all three reviewers back, and B3 is
   the best of the five on the owner's proxy. Do not change the Taste match's meaning: a pooled score, if D1 picks it,
   enters For you ordering under its own name, never as the percentage.
6. **The owner is both subject and judge.** Recommendation: every owner judgment is blinded (method hidden, old
   rating hidden); every table has an owner-excluded column; owner-only results are labelled provisional.
7. **Risk shown to members.** Reviewers disagree. Recommendation: internal until T3 passes forward on the prospective
   log; then show it as a word ("risky for you") with the count behind it, not a percentage.
8. **Cost.** A high-effort Opus orchestrator over four or five sessions, two Opus experimenters per phase, two
   cross-family reviewers per phase and a red team. Recommendation: accept it; cap experimenters at 12 ledgered runs
   per brief and phases at two nulls, which bounds the spend; the expensive part of the last loop was the end-of-loop
   review that found what a day-one review would have.
9. **The block rule (6-hour gap; 20 identical timestamps = bulk).** It is a choice. Recommendation: keep it, record it
   in the manifest, and let the red team try to game it; if the prospective log shows real sessions differ, change
   it at a phase boundary only.
10. **Universe U for T1.** A full catalog of 238,000 titles makes the pack large and recall at 50 harsh.
    Recommendation: the vote threshold that covers 90% of Want to See adds, recorded in the manifest; report the
    coverage so nobody mistakes U for the catalog.
11. **Which pooled predictor is frozen.** Round 3 left two gains uncombined. Recommendation: freeze
    `lab/agents/scores/best.py` as is; the "smaller pooled model" agent in phase 1 may produce a production-shaped
    variant that is added as a sixth candidate only if pre-registered and verified, and nothing else is added.
12. **The product cannot be changed inside a research session.** Recommendation: the loop writes tickets with the
    harness contract as the spec (what to log, in which columns, with which model version); the owner decides which
    to approve at the end of session 1; the prospective log and the standardized-fingerprint flag go first.
13. **Open: does `user_import_item` hold enough same-title pairs to measure the floor for free?** Unknown until W1.
    If 200 or more pairs exist across 10 or more members, the owner's re-rating can wait; if not, book it for two
    weeks after session 1.
