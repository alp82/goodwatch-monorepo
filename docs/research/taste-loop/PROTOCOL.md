# The benchmark as implemented

What `lab/` does, in plain words. PLAN.md says what the benchmark is for; this file says what the code does, and
names every place where the plan left a choice open (marked **Decided here**). A change to this file needs a review.

Built in item 002 and changed in its fix pass after three reviews (the changed decisions are marked **Changed in
the fix pass**). Item 003 added task T2a, the hidden-title test (section 4a; what it changed elsewhere is marked
**Item 003**). Tasks T1 and T2a exist.

## 1. The pieces

| File | What it does |
|---|---|
| `lab/run.sh` | The one way to run a predictor. Takes a lock slot, sets limits, starts `run.py` |
| `lab/run.py` | Refuses what the protocol refuses, builds views, runs predictors, scores, writes the ledger line |
| `lab/views.py` | Builds what a predictor may see (views) and, apart from it, the answers |
| `lab/sandbox.py` | The processes predictors run in |
| `lab/score.py` | The contract check, the one output convention, the calibrator and its floor, the T1 and T2a measures |
| `lab/stats.py` | Intervals and smallest detectable effects |
| `lab/ladder/` | The fixed rungs B0 to B5 and BP |
| `lab/pins.json`, `lab/pin.py` | The sha256 of every rung and every control predictor, and the tool that writes it |
| `lab/table.py` | The ladder tables (T1, T2a), from the `ladder` lines of the ledger alone |
| `lab/top.py` | The first titles a pinned rung would show a member, to standard output. Not a run |
| `lab/verify.py` | Reruns a ledgered run and compares |
| `lab/gate.py` | The one look at tier B. Run by the orchestrator only |
| `lab/controls/` | Six controls that show the benchmark can be trusted |
| `lab/tests/` | Tests on a made-up pack (`python3 -m pytest lab/tests`); they never open the real pack or gate |

Data stays under `~/goodwatch-research/taste/`: the pack, the gate file, `work/` (views of the run in progress,
stored answers of reference rungs, the exported title file, the lock slots), `results/<run id>/` (`result.json`
with one row per member, and the log). The repository gets `ledger.jsonl`, which holds aggregates only.

**What identifies the code.** Every ledger line carries `harness_sha256`: one hash over `common.py`, `pack.py`,
`views.py`, `sandbox.py`, `score.py`, `stats.py`, `run.py`, `run.sh`, `gate.py` and `pins.json`. Because
`pins.json` holds the hash of every rung and every control predictor, the harness hash covers the ladder too. That
hash, not the git commit, says which code produced a line. The commit and the `lab_uncommitted` flag are recorded
beside it, but development runs are made on uncommitted code and the flag is then true; only a registered run
requires committed code. `table.py` and `gate.py` compare harness hashes, never commits.

**Pinned files. Decided in the fix pass.** Whatever runs without a budget must be a file listed in
`lab/pins.json` with exactly the pinned hash: a reference in any mode, the predictor of a `ladder` run, the
predictor of a `control` run. A file dropped into `lab/ladder/`, or a rung edited in place, is refused. Changing a
rung on purpose means running `python3 lab/pin.py`, which changes the harness hash; the table then refuses to mix
the old ladder rows with new ones, so the whole ladder is run again and the change is visible in every line.

**Which pack.** The committed `MANIFEST.json` beside the ledger names the pack's folder and the hash of `pack.pkl`.
Every run reads that pack and no other; `~` in the folder is the home of the account, whatever `$HOME` says. A
ledger therefore belongs to one pack, and no flag or environment variable points a run at another.

## 2. Running

```
lab/run.sh <predictor.py> --task T1|T2a --tier A --mode explore|registered|ladder --item NNN
           [--ref <ladder rung> ...] [--members owner,<hash prefix>,...] [--others all|no-owner|before] [--no-cache]
lab/run.sh --verify <run id>
lab/run.sh --gate NNN              # orchestrator only
python3 lab/table.py T1|T2a
python3 lab/controls/{shuffled,planted,leak,contract,clash,rankscale}.py [--item NNN]
python3 lab/controls/{shuffled,leak}.py --task T2a [--item NNN]
python3 lab/controls/shuffled.py [--task T2a] --only <rung file> ... | --reuse
python3 lab/top.py <rung> --member owner|<hash prefix> [--n 20]
```

- **Slots and limits.** `run.sh` takes one of two lock files under the data root and waits when both are held. It
  sets every thread variable to 2, runs at low priority, under `timeout` (30 minutes unless `TASTE_TIMEOUT` says
  otherwise, at most 2 hours) and under a 4 GB address-space limit. **Changed in the fix pass:** `run.py` no longer
  trusts an environment variable for any of this. It checks its own process: descriptor 9 is one of the two slot
  files of the pack's data root and this process holds its lock; the address-space limit, the thread variables and
  the priority are set; its parent is `timeout`. `TASTE_RUN_SH` and `TASTE_LOCKS` do nothing. **Decided here:** a
  run's two threads are two predictor processes with one thread each, not one process with two; a run that counts
  (registered, gate, verify) uses one process at a time.
- **References.** `--ref` names the rungs the candidate is compared with. The first is the run's primary reference
  (the one the gate uses). Without `--ref` it is B0 in T1 and B2 in T2a. **Changed in the fix pass:** in every
  mode a reference is a pinned file of `lab/ladder/`, each named once, so a run scores at most the rungs of the
  ladder beside its candidate. A rung named as its own reference is run once and differs from itself by nothing.
- **Stored answers.** In an exploratory, ladder or control run, a reference whose answers for exactly these views
  are already stored (same views, same title data, same harness code, same predictor file) is not run again. A
  stored file is used only when it names the predictor's hash and holds an answer for exactly the views of the
  run; otherwise it is thrown away and the reference runs. The candidate always runs. Registered, gate and verify
  runs store and reuse nothing.
- **Modes.** `explore` and `registered` are the plan's, and their budgets are for candidate predictors.
  **Changed in the fix pass:**
  - `ladder` runs a pinned file of `lab/ladder/` and nothing else, uses no budget, and is the only mode `table.py`
    reads.
    The eleven exploratory lines the first build spent on the ladder stay in the ledger and still count against
    item 002.
  - `control` (used by `lab/controls`; never a result, no budget) accepts only the six control names and only
    pinned predictors under `lab/ladder/` or `lab/controls/predictors/`.
  - `verify` and `gate` are entered through `verify.py` and `gate.py` only. A verify run must repeat a ledger line:
    the same files, the same options. It writes a line without measures.
- **What is refused,** before anything is computed and without a ledger line:
  - a run that does not hold a lock slot under `run.sh`'s limits;
  - a pack other than the one the committed `MANIFEST.json` names, or a `MANIFEST.json` that is not committed;
  - a ledger whose committed lines are not a prefix of the working copy (a committed line was edited or removed);
    budgets count the committed lines and whatever the working copy holds beyond them;
  - a tier other than A; an item that is not three digits, does not match exactly one folder `items/NNN-*`, or
    whose folder holds no committed `BRIEF.md` (**decided here:** a new item number is not a new budget until the
    orchestrator has committed its brief);
  - a predictor file over 64 KB (a predictor is code, not a table of ratings);
  - a reference, a ladder run or a control run whose file is not pinned in `lab/pins.json` with that hash;
  - a registered run that is not the comparison its pre-registration names, see below;
  - the 21st exploratory or 4th registered run of an item (every ledger line of that item and mode counts, failed
    runs too);
  - **Item 003**, in T2a: `--others before` (T2a has no moment in time), a planted effect (a control of T1), and
    tier B (the gate knows T1 only).
- **Pre-registration. Changed in the fix pass:** `items/NNN-*/PREREG.md` is parsed, not searched. It must hold
  exactly one line of each of these four, each starting its line; everything else is prose and is not read:

  ```
  candidate: <sha256 of the predictor file>
  reference: ladder/<file>
  others: all|before|no-owner
  task: T1
  ```

  A registered run is accepted only when `PREREG.md` is committed and unchanged, the candidate's hash, the primary
  reference, `--others` and the task all match, `--members` is absent, `git status --porcelain lab/` is empty, and
  the candidate file is in the repository and committed with that hash.

## 3. Views: what a predictor sees

A view is a folder with two files, plus one title file shared by all views.

- `view.bin`: the task name; the predicted member's ratings written before the block (title, score, write time,
  sitting, position, bulk flag, provenance, edited flag); their Want to See, Skip and Not interested rows written
  before the block, with times; and the titles to predict. (This section describes T1 views. A T2a view has the
  same files and tables; section 4a says what it holds.)
- `others.bin`: the same tables for every other tier A member, with a number that only groups a member's rows.
- `titles.npz`: for all 72,101 titles of the pack: key, movie or show, the catalog, pool, poster and fingerprint
  flags, the 74 fingerprint scores, release date, every numeric column of the pack, genres, language, production
  method, animation style, countries.

What a view does not hold: the hidden ratings in any form; the targets' write times; any order among the targets
(they are sorted by title key); the member's rows written at or after the block's first rating; the member's
identity; the name of the answer file, the pack or the gate. **Decided here**, left out of every view: favorites
(a title's favorite membership is a label), watch state and watch log (they show what tier B members rated),
import items, settings, the `touched` flag and the embedding rows (they show which titles members interacted
with), title text and the detail file. A later item that needs one of them adds it here.

The answers (ratings, and what the measures need: sitting, provenance, movie or show, whether the rating was
edited later, the franchise) are kept by `run.py` and written to `work/keys/<run id>.bin`, a path no view names and
the predictor process cannot open. Views and answers are built again for every run and deleted after it.
`views.py T1|T2a owner <folder>` writes one member's views to look at.

**Other members.** By default (`--others all`) a view shows every other tier A member's rows as of the pull,
whatever they wrote and whenever, also after the block (leave one member out), as in the product. This is not what
was known at the time of the block. `--others before` keeps only what others had written before the block and had
not edited since; `--others no-owner` is `all` without the owner's rows (a population fit with the owner left
out). For a tier B member (gate) the others are tier A members, under the registered option.

**Edits. Changed in the fix pass.** A rating edited later carries its current score and its first write time (234
of the 6,525 tier A ratings). Its score at an earlier moment is unknown, so:

- a history rating whose `updated_at` is at or after the block's first rating is left out of the view (71 history
  rows over all blocks); with `--others before` the same holds for other members' ratings;
- a target whose rating was edited later stays a target with its current score as the label (122 of 5,194
  targets) and is flagged in the answers; the primary measure is reported with all targets and with those left out.

**Title data** is as of the pull: public scores, vote counts and fingerprints are today's, not those of the day a
rating was written.

## 4. Task T1: forward rating prediction

- A member's ratings are taken in entry order. Members with 6 or more ratings are eligible.
- Blocks start at 5, 10, 20, 40, 80, 160, 320 and 640 ratings. **Decided here:** the plan says a boundary moves "to
  the nearest sitting or bulk boundary", but most members have one sitting and no bulk write, so that rule alone
  would leave them without blocks. Implemented: a boundary is never placed between two ratings written less than 2
  seconds apart (the first design's "moment"; this keeps every bulk write whole and never splits ratings whose
  order is uncertain). It moves to the nearest place where it may be, the later one on a tie, never below 5. Two
  boundaries that land on the same place make one block, named after the smaller. A sitting boundary is always a
  place where a block may start. PLAN.md 2.2 carries the amendment.
- A block is predicted from what the member wrote before the block's first rating. Ratings in a bulk write are
  never targets; a bulk write inside a block is not history for that block either (it is for the next). On this
  pack no bulk rating lies at or after its member's first block start (the review counted 785 bulk ratings of
  eligible members, all earlier), so the rule is exercised by a test on a made-up pack only (`test_views.py`).
- Every rated title is a target, with or without a fingerprint or title data; each rung declares its fallback.
- On the pack of October 13, 2026: 98 tier A members have a target (the owner and 97 others), in 280 blocks with
  5,194 targets (999 the owner's). 72 other members have 10 or more targets (4,058 targets).

### What T1 measures

T1 is a retrospective test in entry order. Read every T1 number with these four facts:

- **Same sitting.** For members other than the owner, 93% of the targets are typed in the same sitting as the
  history (3,919 of 4,195), and the median gap between the last history rating and the first target is 6 seconds.
  With sitting boundaries only, 18 other members would have qualified instead of 72. T1 therefore measures
  learning from the ratings a member has entered so far in a sitting: the first-sitting case. Titles typed within
  a sitting are often ones the product proposed, and only an exposure log could separate that.
- **Later sittings cannot be measured on this pack.** The later-sitting stratum has 16 members and 276 targets. It
  is reported apart and never pooled into a claim; T1 is weak evidence about ratings of titles watched later.
- **Other members' data is as of the pull** unless `--others before` is used. With `all`, about half of the other
  members' rating rows a view shows were written at or after the block. The ladder is run with `all`, `before` and
  `no-owner`, and the table shows the three side by side. For the owner, `before` leaves no other member at all
  (every owner block precedes every other member's first rating): B4 and B5 then answer as B1 does.
- **Title data is as of the pull,** as said above.

So T1 results are retrospective comparisons on today's data, not forecasts that could have been made at the time.

## 4a. Task T2a: the hidden-title test

**Item 003.** The question: take a title a member rated, remove that one rating, treat the title as unwatched, and
see where a scorer places it among every title the member has not rated. Hiding one title at a time would cost one
view per rating, so a view hides a fold of titles.

### Views

- **Eligible members:** tier A, 20 or more ratings, at least 5 of them 8 or more. **Decided here:** the two counts
  are over all of the member's ratings, whether or not the title is in the candidate universe. On this pack: 62
  members, the owner and 61 others.
- **Candidate universe:** titles with `in_pool` and `has_fingerprint`: 60,759 of the 72,101.
- **Folds.** A member's rated titles that lie in the universe are dealt into folds by a seeded shuffle; a view hides
  one fold. **Decided here**, and a change to the letter of the brief ("folds of 20"): a fold holds at most 20
  titles and there are never fewer than 5 folds, so a view hides at most 20 titles and, with 5 folds, a fifth of
  the member's rated titles rounded up: 21 titles give folds of 5, 4, 4, 4 and 4, so one view hides 23.8% (wording
  corrected in item 004). The number of folds is the larger of 5 and the count divided by 20, rounded up. With
  folds of 20 alone, a member with 20 rated titles would have one view that hides every rating, and the 44 of the
  61 other members with 80 or fewer rated universe titles would have a quarter to all of their ratings hidden at
  once; the test is meant to stand in for hiding one rating. For the owner the rule gives the brief's 50 views.
  **Decided here:** the shuffle is the order of the sha256 of `seed|T2a|member hash|title key`, dealt round; it
  does not change with the labels, so the shuffled control hides the same titles.
- **History:** every other rating of the member, and the member's Want to See, Skip and Not interested rows, with
  the hidden titles removed from each of those lists. **Decided here:** T2a has no moment in time. The history is
  as of the pull, a rating carries its current score, and the rule about ratings edited later does not apply.
  Rated titles outside the universe (74 of other members, 12 of the owner) are history in every view and never
  hidden.
- **Targets:** the hidden titles and every universe title the member has not rated, about 60,700 in a view, in one
  list shuffled with a seed made from the view. The view holds the list and nothing else about a target.
  **Changed in item 004, replacing decision 4 of item 003** (Sol 6.1's review: blocking). A title the member has
  not rated but keeps on their Want to See, Skip or Not interested list is certainly not hidden (hidden titles are
  removed from those lists). It stays in the target list, since the contract ranks every unrated title, but every
  measure leaves it out: it is not in the comparison set a hidden title is placed in, and not among the first 50
  the guards read (`listed_pos` in the answers). A scorer that pushes listed titles down therefore gains nothing.
  The leak canary tries exactly that (section 11). Under item 003's rule its hidden titles would have stood at a
  mean percentile of 0.501 (others) and 0.503 (owner) instead of 0.5. Effect of the change on the item 003
  figures, members other than the owner: every separation and band percentile moved by 0.001 or less (the largest
  separation change: B1, from 0.0858 to 0.0856; owner separations by 0.0003 or less); the first-50 guards moved
  more, because listed titles are popular: the median vote count of B3's first 50 fell from 142,136 to 120,513, of
  BP's from 1.62 million to 1.47 million; BP's share of titles rated 8 or more in the first 50 rose from 0.388 to
  0.444 and of titles rated 5 or less from 0.264 to 0.314. The same principle holds in T2b, where every title the
  member had touched before the cutoff is out of the list altogether.
- **Other members:** `all` (the default, as in T1: the pooled rungs see other members' ratings of the hidden title,
  as the product would) or `no-owner`. `before` is refused.
- On this pack: 434 views (50 of the owner), 5,780 hidden titles (992 of the owner), 26.3 million ranks per rung.

### Measures

Each hidden title is placed, alone, among the view's unrated candidates. **Decided here:** the other hidden titles
of the view are not part of that comparison (they are titles the member has watched).

- **Percentile:** the share of the candidates the scorer ranks below the hidden title, a tie counting a half. 1.0
  is the top; a scorer with no order gives 0.5 everywhere.
- **In the first 50, in the first 200:** fewer than 50 (200) candidates rank above it, a tie counting a half.
- **Bands** by the member's real rating: 8 or more, 6 to 7, 5 or less. Per member, the mean percentile of a band
  and the share of the band in the first 50 and 200. **Decided here:** a band counts for a member only with 5 or
  more titles in it, for the band's own figures as well as for the separation (the brief asks it of the
  separation). **Changed in item 004** (Sol 6.1's review): the owner's figures keep the same minimum, for band
  figures, separations, paired differences and the matched figures (`stats.cluster_separation` takes the minimum);
  before, the owner's separation needed one title in each band. On this pack the owner has 94 or more titles in
  every band, so no owner figure changed.
- **Primary: separation.** Mean percentile of the titles rated 8 or more minus that of the titles rated 5 or less,
  per member, for members with both bands. 26 of the 61 other members count; all 61 have the high band, 49 the
  middle band. The paired difference to a reference is the rung's separation minus the reference's, per member.
- **Among equally well-rated titles:** the same percentile, counted only against candidates whose GoodWatch score
  lies within 3 points of the hidden title's. **Decided here:** the score is `goodwatch_overall_score` on its 0 to
  100 scale and "within 3" includes 3; a hidden title typically has several thousand such candidates. The same
  band means and the same separation are reported on it. It reduces one confound, a title's public quality; it
  does not remove popularity (vote count alone, BP, keeps a matched separation of 0.014).
- **Among equally popular titles** (item 004): the same, counted only against candidates whose vote count
  (`goodwatch_overall_score_voting_count`) lies within a factor of 1.5 of the hidden title's, either way, the edge
  included (on a log scale). **Both at once:** within 3 GoodWatch points and within a factor of 2 in votes; a
  hidden title counts only with 50 or more such candidates. 1,506 of the 4,788 hidden titles of other members
  (31%) and 234 of the owner's 992 (24%) have fewer and are left out of "both"; most titles have 50 or more, so the
  figure is reported. The bands were fixed in the brief and before any rung ran; none was changed.
- **Guards**, read on the first 50 candidates of every view (hidden titles left out, ties in the order of the
  view's list), averaged over a member's views: the share of shows and of animation, each also minus the member's
  own share among their rated universe titles; the largest number of titles from one franchise; the median vote
  count. **Decided here:** animation is production method "Animation"; a franchise is a movie series of the pack
  (`movie_series_id`), every other title its own.
- **Score.** **Decided here:** T2a has no calibrator and no calibration views. A predictor that gives `score` (or
  `p_low`) is scored on the hidden titles as in T1 (error of the rounded score, by band; Brier); what it gives for
  candidates is not read. A rung without `score` has no error in T2a. The contract is unchanged, including the
  rule that a predictor without `score` gives `rank` in 0..1.
- **Others:** the mean over members with a 95% interval from drawing members again (10,000 draws, the same seed),
  and for every reference the paired difference, its interval, the members improved and the smallest detectable
  effect, with the functions T1 uses.
- **Fold check** (item 004, `--fold-check`, Sol 6.1's review): T2a hides folds, not one title, and a fold can
  take a sparse member's taste below B2's five liked titles. For the members other than the owner with fewer than
  60 ratings (40 members, 10 of them with both bands) the check builds folds of at most 5 titles and reruns B1,
  B2, B3 and B5; `table.py T2a` shows it beside the main figure and never mixes it into the main rows. T2a is a
  fold test; differences between rungs are read as such, not as leave-one-out results.
- **Owner:** plain figures. An interval over sittings follows the rule of section 8 (`stats.cluster_separation`
  for the separation: the mean over one group of titles minus the mean over another, whole sittings drawn again);
  on this pack the largest sitting holds 34% of the titles rated 8 or more or 5 or less, so there is none.
  Beside it stands the second figure, with whole franchises drawn again.
- **Win rule** (PLAN.md 2.5): interval of the paired separation excludes zero, effect of 0.03 or more, no guard
  worse with an interval that excludes zero. The table gives the numbers; it draws no verdict.

### Running it

- **Decided here:** an answer has about 60,000 ranks. The runner turns it into the few numbers above the moment it
  is read (`score.t2a_view`) and drops the ranks, so neither the runner nor the stored answers of a reference hold
  more than one view's ranks. A sandbox worker gets 64 views at a time. Peak memory of a run: 271 MB.
- **The ladder:** B1, B2, B3, B4, B5, BP, each with B2, B1 and BP as references (B2 first: it is the primary
  reference). B0 gives no order and is left out. **Decided here:** the rungs run unchanged, the files pinned for
  T1. One consequence is stated plainly: B4 and B5 standardize their title columns over every title a view names,
  and learn the consensus from the titles members rated. In T1 a view names a few thousand titles, most of them
  rated by someone; in T2a it names the whole universe, so the consensus is extended to tens of thousands of
  titles nobody rated. Their first 50 candidates have a median vote count of 3,600 (B4) and 6,800 (B5).
- **Not built for T2a:** the gate (`gate.py` refuses a task other than T1 and uses no look). A registered T2a run
  would be accepted by `run.py` with `task: T2a` in `PREREG.md`; no test covers it.
- **Time** on two processes, this pack: B1 105 s, BP 65 s, B2 133 s, B3 169 s, B4 379 s, B5 522 s (item 003). In
  item 004, on a machine with its swap full: B1 68 s, BP 52 s, B2 151 s, B3 228 s, B4 467 s, B5 382 s; two earlier
  B4 and B5 attempts were stopped by the 10-minute limit of the session that ran them.
- **Resuming** (item 004): a T2a or T2b run stopped by its time limit leaves the answers of the batches it finished
  (`<stored answers>.part`), and the next run of the same file on exactly the same views and answers (the cache
  key: views digest, title digest, harness hash and a digest of the answers) starts where it stopped; the ledger
  line says how many views it took over (`resumed`). Only explore, ladder and control runs store answers, so
  registered, gate and verify runs never resume. The cache key includes the answers since item 004, because a
  reduced answer depends on them (the T2b shuffled control has the real views and other targets).

## 4b. Task T2b: ranking later Want to See adds

**Item 004.** Written down before any rung ran: how many members each split rule keeps on the pack of October 13,
2026 (tier A; a member needs 3 or more targets in the candidate pool, not touched before the cutoff).

| Split rule | Members kept | Of them others | Targets | Owner's targets |
|---|---:|---:|---:|---:|
| `sitting` (primary): adds in the last 40% of the member's add sittings | 4 | 3 | 124 | 80 |
| `order`: the last 40% of the member's non-transfer adds in entry order | 10 | 9 | 155 | 87 |

Why so few: a sitting of 10 or more adds is a transfer (history only), and 992 of the 1,573 tier A adds lie in
such sittings; only 161 of them are bulk writes (5 or more within 2 seconds). 11 tier A members have adds in two or
more sittings. For information only, not built and not run: if only bulk writes were transfers, the `sitting` rule
would keep 4 members and the `order` rule 28.

### Views (`views.build_t2b`, one per member)

- **Members:** tier A members with Want to See adds. **Targets** (`views.t2b_targets`): with the adds in entry
  order (write time, then position), a sitting of 10 or more adds is a transfer and its adds are never targets.
  **Decided here:** a bulk write (5 or more adds within 2 seconds) is never a target either, as in T1 (on this pack
  every bulk add lies in a transfer, so this removes nothing). Split `sitting` (the primary T2b): the adds in the
  last 40% of the member's add sittings; **decided here:** transfers count as sittings, 40% is rounded to the
  nearest whole sitting and is at least one, and a member needs two or more add sittings (with one there is no
  later visit). Split `order` (`--split order`, reported apart: learning from the adds made earlier in the same
  visit): the last 40% of the member's other adds, rounded to the nearest.
- **Cutoff:** the write time of the first target. **History:** the member's ratings written before the cutoff and
  not edited since (as in T1), and their Want to See, Skip and Not interested rows written before it.
- **The list:** every title of the candidate universe (in the pool, with a fingerprint) that the member had not
  rated, added, skipped or marked Not interested before the cutoff, shuffled with a seed made from the view.
  Targets are dropped and counted when they lie outside the universe or were touched before the cutoff
  (**decided here**: a later add of a title the member had already rated is not a choice of an unwatched title);
  a member needs 3 targets after that. Titles the member added after the cutoff that are not targets, and titles
  rated after it, stay in the list as ordinary titles.
- **Other members:** `before` by default (their rows written before the cutoff, ratings not edited since); `all`
  is reported apart; `no-owner` works. Watch tables stay out of views.

### Measures

- **Percentile** of each target among the list's titles that are not targets (a tie a half; 1.0 the top), and the
  member's mean: the primary measure, paired against B2 (**decided here:** the other targets are left out of a
  target's comparison, as the other hidden titles are in T2a). In the first 50 and 200, equally well-rated,
  equally popular and both, as in T2a.
- **Guards:** the first 50 titles that are not targets (as in T2a): shows and animation against the member's own
  mix (**decided here:** their rated and added universe titles before the cutoff), the largest franchise count,
  the median vote count. **Touched titles:** how many titles touched before the cutoff stand in a first 50 and in
  the list at all; both must be 0, and are 0 in every run. **Later skips:** the mean percentile of the titles the
  member skipped or marked Not interested at or after the cutoff (targets left out; itself left out of its
  comparison), for members with 3 or more (**decided here**). **Want to See against Skip**, a stand-in: the chance
  a target ranks above such a title, a tie a half, members with 3 or more such titles.
- **Owner:** plain figures; an interval over the targets' add sittings where section 8 allows one, and the
  figure with whole franchises drawn again beside it. On this pack the owner's 80 targets lie in 55 sittings, so
  that interval exists.
- No calibrator, no score, no gate, no planted effect.

### Controls

- `shuffled.py --task T2b --split sitting|order`: the real views, each member's targets swapped for as many random
  titles of the list that are not targets (`build_t2b(shuffle_seed=...)`). Rule as for T2a (section 11).
- `leak.py --task T2b`: the canary also looks for the member's later Want to See adds (in the pack's wishlist and
  in the answer file's `pos` column). Pass: every target of every member at percentile 0.5 exactly, no touched title
  in any list, attempts reported. A test shows it finds every target on a made-up pack when nothing confines it.

### Running

`lab/run.sh <rung> --task T2b --tier A --mode ladder --item 004 [--split sitting|order] [--others before|all]`.
A run takes seconds: 4 views (`sitting`) or 10 (`order`). **Decided here:** the ladder ran in mode `ladder` (no
budget; the only mode `table.py` reads), not `explore` as the brief says: explore lines are candidates' lines and
no table would read them.

## 5. The contract

A predictor is one Python file with `predict(view) -> dict`. The dict holds nothing but:

- `rank`, required: one finite number per target, higher is shown earlier;
- `score`: None, or one finite number per target, the rating expected;
- `p_low`: None, or one number in 0..1 per target, the chance of a rating of 5 or less.

**Changed in the fix pass, one new rule:** a predictor that returns no `score` must return `rank` on a scale that
means the same in every view of one member, as a number in 0..1. The harness reads that scale: it learns the
calibrator's steps on calibration views and applies them to another view. The ladder's rank-only rungs return a
percentile over the reference pool.

Anything else fails the run: another return type (a bare array), another key, a wrong length or shape, a value
that is not finite, a `p_low` outside 0..1, a `rank` outside 0..1 without a `score`, a `score` or `p_low` given
for some views and not for others, an exception, a timeout. **Decided here:** a `score` outside 1..10 is clipped,
not refused (the plan says the harness clips). One file means one file: it can import the standard library, numpy,
scipy and sklearn and nothing else, not even a file beside it, and it is at most 64 KB. Its sha256 in the ledger
is therefore the whole predictor.

What the range check cannot see: a rank-only predictor that shifts its scale from view to view by an amount small
enough to stay inside 0..1. No check on answers alone can, because no title is ranked in two views of one block.
The rule is the contract; the check enforces its coarse part (control `rankscale`).

The number compared is `score` clipped to 1..10 and rounded to a whole rating, **halves up** (decided here: a
median of 7.5 counts as 8).

**The calibrator**, for a scorer without `score`. The plan asks for a monotone fit of rating on rank from the
member's history only, and leaves open where the ranks of history titles come from. **Decided here:** for every
block with 10 or more ratings of history the harness builds five calibration views; each hides a fifth of the
history (a fixed pseudo-random split by title) and asks the scorer to rank it from the rest. So every history
title is ranked by a taste that was built without its own rating. The calibration views are ordinary views; their
answers are history ratings and never leave `run.py`.

**Changed in the fix pass:** the fit is a non-decreasing step function under absolute loss, every step holding 20
or more history ratings. The history titles are sorted by rank and dealt into bins of 20 (titles with one rank
stay together, the last bin takes the rest); neighbouring bins are pooled wherever the median does not rise; a
step's value is the median of its ratings. A target gets the value of the step its rank falls in. The score is the
median of the history, which is rung B0:

- below 10 history ratings (no calibration views);
- when the scorer gives every title of a calibration view, or every target of the block, the same rank (no taste
  there);
- whenever the fit has one step, which is always the case below 40 history ratings.

So a rank-only rung can differ from B0 in error only on blocks with 40 or more history ratings: 2,198 of the
4,195 targets of other members, 964 of the owner's 999. (The first build used a least-squares isotonic fit without
a minimum step. A scorer that knew nothing came out 0.027 worse than B0 through it.)

**The calibrator floor.** For every rank-only candidate the harness also calibrates the same answers with the
ranks permuted within every view (20 permutations, averaged) and writes into the ledger line: the floor's error,
the floor minus B0, and the rung minus its floor. The floor must lie within 0.01 of B0 for members other than the
owner. Measured on this pack: B2 +0.000, B3 +0.001, BP -0.001; uniform random ranks through the same blocks and
folds +0.001. The table shows the floor beside each calibrated rung.

**Not like for like.** B2, B3 and BP are scored through the calibrator; B0, B1, B4 and B5 give their own score. An
error comparison across that line compares rung plus calibrator with rung, and the table marks it "not like for
like". Pair accuracy does not pass through the calibrator; the table gives its paired difference beside every
error difference.

## 6. The sandbox

In T1 the view of one member shows another member's ratings, which are hidden in that member's own view, and
later blocks of a member hold earlier blocks' answers as history. The labels are absent only if nothing passes
from one view's process to another's. So:

- **One process per view,** forked from a worker that holds numpy, the title data and the predictor's source
  text, and that keeps nothing a predictor process produced (answers, notes and logs go from pipes to files inside
  the kernel; per-view seconds and memory are written by a helper that exits).
- **Files:** Landlock lets the predictor process read its own view folder and nothing else, and write nothing.
- **System calls:** a seccomp filter refuses new processes and exec, sockets, shared memory and message queues,
  kernel keyrings, signals to other processes, looking into other processes, changing any file's size, times,
  owner or mode, file locks, priorities, limits, mounts and namespaces. (Landlock on this kernel, 6.1, does not
  stop truncating or re-timing a file the user owns; seccomp does.)
- **Namespaces:** each view's process is alone in its own process, IPC and network namespace, inside a user
  namespace without network. A machine that cannot give these still runs exploratory runs, marked in the ledger
  line; registered and gate runs refuse.
- **Limits:** 4 GB address space, 300 CPU seconds and 600 wall-clock seconds per view.
- **No harness state. Changed in the fix pass:** once the process is confined it raises an exception that carries
  the predictor's source, a module name made from its hash, and the view, and that unwinds every harness frame.
  `predict` is then called from a frame that holds those three things and nothing else: no job, no view id, no
  view list, no folder, no descriptor of the output folder, no report. The predictor is compiled under the name
  `<predictor_HASH>` and has no `__file__`. Its two pipes are always descriptors 3 (answer) and 4 (notes).
- **Report, advisory:** an audit hook notes every attempt to open or list a path, start a process or open a
  socket, and refuses it. Each note is written to the notes pipe the moment it is made, so a predictor cannot take
  one back. The count and examples go into the ledger line, and the run's status becomes `attempts`. The report is
  a convenience, not the boundary: a predictor can write false notes, close the pipe, or go around Python through
  the C library, where the kernel stops it without a note. Landlock, seccomp and the namespaces are the boundary,
  and the leak control tests that boundary, not the report.

What remains, stated plainly: a predictor process can still read the size and times of files whose path it knows
(not their content); it can learn where the lab and the data live from the modules loaded in its process (paths
are not secret, and nothing rests on them); two predictor processes that run at the same moment share the
machine's load, which is why runs that count run one view at a time; and the tier B gate file sits in the same
account, kept from predictors by the sandbox and from everyone else by agreement (PLAN.md 6.7).

## 7. Measures

Owner and other members are always apart. "Others" are tier A members other than the owner.

- **Primary:** average error of the rounded prediction per member over all their targets; then the mean over
  other members with 10 or more targets, each counting once. A comparison is the paired difference per member,
  candidate minus reference; below zero the candidate is better. Reported twice: with all targets, and with the
  targets whose rating was edited later left out (`mae_unedited`, same members).
- **Skill:** 1 minus the candidate's mean error over the reference's, on the same members.
- **Owner:** the mean over the owner's targets.
- **Guards,** from `rank`: pair accuracy (among a member's target pairs with different ratings, the share ordered
  correctly; a tie in rank counts a half) and low-rating AUC (members with 5 or more targets rated 5 or less and 5
  or more rated higher). **Decided here:** pairs are formed inside a block only, because a scorer's rank need not
  mean the same in two blocks; a member's blocks are pooled by counting pairs. For every reference the ledger
  line holds the paired difference in pair accuracy beside the difference in error.
- **Chance of a low rating:** the Brier score of `p_low`, beside the Brier score of the member's own share of
  ratings of 5 or less so far (the raw share of the visible ratings; decided here), and a reliability table in ten
  bins with counts. Only B0 gives a `p_low` on the ladder, and it gives that share.
- **Reported, never optimised:** error on ratings of 5 or less, 6 to 7, 8 or more.
- **Strata:** target in the same sitting as the last history rating, or a later one; block; movie or show;
  provenance; title with or without a fingerprint; title released two or more years before the rating, or not;
  rating edited later, or never. **Decided here:** in a stratum every member with at least one target there
  counts once (the 10-target rule would empty most strata).

## 8. Uncertainty

- **Others:** bootstrap over members, 10,000 draws, seed 20261013 (both in every ledger line), 95% percentile
  interval for the mean; the median member; the count of members improved and worse. The same members get the
  same draws in every comparison of a run.
- **Owner. Changed in the fix pass.** The owner is one member, so an interval would have to come from drawing the
  owner's sittings again. `stats` gives such an interval, and a smallest detectable effect, only when there are 10
  or more sittings with targets and none holds more than a quarter of the targets; otherwise it returns the plain
  figure and the reason. On this pack the owner's 999 targets lie in 97 sittings of which one holds 39% (391; the
  next two hold 153 and 106), so the owner has no interval: the owner's numbers are plain figures and the table
  prints "n/a" with that reason. The same rule applies inside every owner stratum.
- **Franchises drawn again**, the plan's one check, is a second and separately labelled figure for the owner: the
  same mean with whole movie series resampled together (the pack's `movie_series_id`) and every other title
  alone; 999 targets in 822 such units. It ignores sittings, so it is too narrow as a statement about the owner's
  future ratings. It answers one question only: does a difference rest on a few franchises.
- Pair accuracy and AUC of the owner are given without an interval.
- **Smallest detectable effect:** the paired difference found four times out of five by a two-sided 5% test, 2.80
  standard errors. For others the standard error is the spread of the per-member differences over the root of
  their number. It is planning shorthand from a normal approximation, not a measured power, and an effect below
  it is not evidence that two scorers are equal.

## 9. The ladder

| Rung | File | What it is | Fallbacks and choices |
|---|---|---|---|
| B0 | `b0_median.py` | Median of the member's ratings so far; `p_low` is the share of 5 or less so far | Gives no order |
| B1 | `b1_public.py` | GoodWatch score / 10 plus the member's mean distance from it, shrunk toward the population's with 3 pseudo-ratings | Decided here: 3, the pseudo-count `pool.py` uses for member offsets; the population's offset is the mean over all other members' ratings, 0 without any. A title without a GoodWatch score gets the member's median |
| B2 | `b2_taste_today.py` | Today's taste: `2P - N` on unit-length raw fingerprints, liked from 6, weights `score - 5` and `6 - score`, Want to See at 0.5, no taste below 5 liked titles; the cosine in single precision as the product computes it. Rank: the percentile of that cosine among the cosines of the reference pool with the same taste (0..1), the coordinate the product's match is built on | Without a taste every target gets 0.5. A target without a fingerprint gets the median rank of the block's other targets. No score: calibrated |
| B3 | `b3_taste_standardized.py` | The same after each attribute is standardized against its mean and standard deviation over the reference pool (in the pool and with a fingerprint: 60,759 titles); a missing score counts as the pool mean | As B2 |
| B4 | `b4_consensus.py` | `pool.pooled_predict` with k=0, personal weights off: consensus score, shrunk offset and slope per member | See below |
| B5 | `b5_pooled.py` | The same with personal weights on (ridge penalty 300, from 3 ratings) | See below |
| BP | `bp_votes.py` | Vote count; rank only: the percentile of the title's vote count among the pool's (0..1) | No count: 0, below every title with one. Calibrated |

- B2 and B3 are one code with one switch, as are B4 and B5; a test requires the shared part to be identical.
- B2 is checked twice: against an example worked by hand, and against `formula.server.ts` and `pool.server.ts`
  themselves, run with bun on random members: the taste vectors and cosines agree bit for bit. **Changed in the
  fix pass:** B2, B3 and BP return a percentile over the reference pool as `rank` (before: the raw cosine and
  log10 of the vote count). The order inside a view is unchanged. The product reads its percentile from a quantile
  table; the rungs compute it exactly.
- B4 and B5 are checked against the first loop's `pool.py`, run on the same views: predictions agree to 1e-8.
  **Decided here:** they use the first loop's `base` columns (74 standardized attributes, six public scores, year,
  show, English, Japanese, log votes, genres). Its 51 text columns came from a file the pack does not have. The
  branches the settings never reach (taste axes, trees, cross-fitting) are not ported. The title rows the model
  standardizes over are the titles named by any row of the view; a title without a fingerprint or title data gets
  the column means, as the original does for a missing value. **Changed in the fix pass:** when the view shows no
  rating of any other member (with `--others before`, every block of the owner), or the others are too few for the
  fit to give finite numbers, B4 and B5 answer as B1 does. Before, they failed.
- Nothing on the ladder was tuned on this pack.
- **Item 003:** no rung was changed for T2a; section 4a says how the ladder runs there. Only the leak canary among
  the pinned files changed (section 11), so the harness hash changed and the T1 ladder was run again: every
  measure of the T1 table is the same as before.

## 10. The ledger

One line per run, appended by the harness, never edited: run id, time, item, mode, task, tier, git commit and
whether `lab/` had uncommitted changes, the harness hash, pack and title file hashes, the predictor's path and
sha256, each reference's, the primary reference, which of them were calibrated, the options, the views (a digest
of everything the views hold, counts), seed and draws, the sandbox facts and attempts, status (`ok`, `attempts` or
`failed` with the error), every measure with its interval and smallest detectable effect, the calibrator floor of
a rank-only candidate, seconds per predictor, peak memory.

- **Integrity. Changed in the fix pass:** before any run, verify or gate look the harness reads the ledger of the
  last commit and refuses unless it is a prefix of the working copy. Lines the working copy holds beyond it are
  not protected until they are committed; the orchestrator commits the ledger with every accepted step.
- `run.execute` writes the line of every exploratory, registered, ladder and control run; there is no switch to
  leave it out. A verify run writes its own line through `verify.py`; a gate run through `gate.py`.
- **`table.py`** reads lines of mode `ladder` with status ok, all members, the true labels, for each of the three
  `others` options, and takes the newest per rung. **Changed in the fix pass:** it refuses to build a table unless
  every row carries the pack hash and the harness hash of B0's row and, within one `others` option, B0's views
  digest and title digest. After a harness change the whole ladder is run again. **Item 003:** `table.py T2a`
  reads the T2a lines the same way; B2's row takes the part of B0's. A rung's row shows the paired differences its
  own line holds, so each rung is run with B2, B1 and BP as references.
- **Item 003:** a T2a line holds, beside what every line holds, `views.targets` (hidden titles),
  `views.targets_listed` (ranks asked for), and the T2a measures of section 4a for others and owner.
  `result.json` has one row per member: counts, band percentiles, separation, the lowest and highest percentile.

## 11. Verify, gate, controls

- **`run.sh --verify <run id>`** refuses when the pack or a predictor file is no longer the one the run used.
  Otherwise it builds the views again, runs everything again without stored answers, one view at a time, and
  compares every measure, the views digest and the status. Exit code 0 only on a full match.
- **`run.sh --gate NNN`. Changed in the fix pass.** It takes the item's latest finished registered run and repeats
  exactly that comparison on tier B members: the same candidate file, the same primary reference, the same task and
  the same `others` option, with the same harness hash on the same pack (ratings from the gate file, population
  tier A). A registered line it cannot replay that way is refused and no look is used: another harness hash,
  another pack, a file that changed, a member list, a shuffled or planted run.
  - The look is appended to `looks.jsonl` before anything is computed. A gate run that fails, or is made to fail,
    has used the look. One look per item, 8 per pack.
  - It prints `replicated`, `not replicated` or `not finished`, and the looks used. `replicated` only when the tier
    A effect is an improvement (below zero), tier B has the same sign, and at least half the size.
  - Of tier B it writes one summary line (the two effects, the number of members, the verdict) to
    `~/goodwatch-research/taste/gate/results/<pack>/summary.jsonl`, and the run's log. No result per member, per
    measure or per stratum is written anywhere; the ledger gets the verdict only.
  - Tested on a made-up pack and gate file, including a replay with `others: before` and a candidate that fails on
    tier B on purpose. Nobody has run it on the real gate.
- **Controls** (each writes its runs and a verdict line into the ledger):
  - `shuffled.py`: every member's ratings permuted among their titles. Pass: no rung is a win over B0 by the
    plan's rule (interval below zero and 0.05 points or more), for others and for the owner (the owner has no
    interval over sittings, so the rule is read on the franchise figure), and every rung's pair accuracy is within
    0.05 of 0.5. Shuffling does not remove the level a rung predicts for a member, so a rung that shrinks a
    member's mean toward the population's could beat B0's median without knowing anything about titles; the order
    criterion cannot be passed that way.
  - `planted.py`: B1's rounded prediction is moved one point toward the truth on a random share of each member's
    targets, sized so that the expected error falls by 0.15. Pass: the difference to the untouched B1 has an
    interval below zero and an estimate within 0.05 of -0.15 for others; for the owner the estimate within 0.05
    and the franchise figure below zero.
  - `leak.py`: a predictor that goes for the pack, the answer files, other views, the harness's memory and frames,
    other processes, the network and every way it knows to leave a note for a later view. Pass: its error equals
    B0's for every member, and the ledger line reports its attempts. A test shows the same canary does find the
    answers on a made-up pack when nothing confines it. **Changed in the fix pass:** it takes the paths from the
    harness's own module, so in a test it goes for the made-up pack; and it never touches anything under a `gate`
    folder, not even to open it. Landlock's rule does not depend on the path, so the pack and the answer files
    stand in for the gate file.
  - `contract.py`: a predictor that returns a bare array. Pass: the run fails and has no measures.
  - `clash.py`: two files named `best.py`, one answering 1, one answering 10, each run against B0. Pass: each gets
    its own result (for every member the two errors add up to 9).
  - **`shuffled.py --task T2a` and `--task T2b`. Changed in item 004** (Sol 6.1's review: item 003's rule, a test
    at 0.001, could pass a bias as large as the win floor). Every rung runs on three independent shuffles (seeds
    20261013, 20261014, 20261015). Figures: T2a, the separation and the separation among equally well-rated
    titles; T2b, the mean percentile minus 0.5 and the paired difference to B2; each for others (a member's figure
    is the mean of the three shuffles; interval drawn over members) and for the owner (the mean of the three
    franchise figures, their standard errors combined, a normal interval; not judged where the owner's data give
    no standard error). **Pass** only when every judged figure's 95% interval lies within plus or minus 0.015,
    half the T2a and T2b win floor, fixed before any result; otherwise **inconclusive**. The widest figure is
    reported, and figures whose interval lies wholly outside the band are named (no third verdict: with few
    members that happens by chance, as the made-up pack of the tests shows). `--seed` with `--only` runs one
    shuffle per call.
  - **Item 003, `leak.py --task T2a`:** the canary on T2a views, behind the same boundary. Pass: for every member
    its error on the hidden titles equals B0's and every hidden title stands at percentile 0.5 exactly, and the
    attempts are reported. For that the canary changed (its pin too): a title whose rating it finds now also gets
    rank 1, all others rank 0 (**item 004:** in T2a the others 0.5, and the titles on the member's own Want to
    See, Skip and Not interested lists 0, the side-list shortcut); and it knows the two T2a ways to an answer
    (another fold of the same member, which
    shows the hidden titles as history, and the answer file's `pos` column). A test shows it finds every hidden
    rating on a made-up pack when nothing confines it, from the answer file, from the other folds alone, and from
    the pack. That the view itself marks no hidden title is covered by tests on the made-up pack (`test_views.py`),
    not by this control.
  - **Item 003, `--only` and `--reuse`** (`shuffled.py`, both tasks): `--only <rung file>` runs the named rungs
    and writes no verdict; `--reuse` takes for every rung the run the ledger already holds for exactly this control
    (same task, item, harness hash, rung hash and seed, all members) and runs what is missing. The six runs can
    then be started one at a time and judged together.
  - `rankscale.py`, **new in the fix pass**: rung B2 with a constant added to every rank of a view (the number of
    ratings the view shows). The order inside every view is B2's. Outcome, by decision: **it fails the contract
    check** (rank outside 0..1 without a score); it does not run and change nothing. Pass: the run fails and has
    no measures.

## 12. Not built

T2b, T3, T5; tier C and `sealed.py`; a `p_low` for any rung but B0; intervals for the owner's pair accuracy and
AUC; the gate for T2a; a calibrated score for rank-only rungs in T2a.

`lab/top.py` (**item 003**) is not a run: it calls a pinned rung of `lab/ladder/` in its own process, without the
sandbox, on a view of the member in which nothing is hidden (every unrated universe title is a target), and prints
the first titles. Nothing is hidden there, so nothing can leak; it refuses any file that is not a pinned rung,
writes no file and no ledger line. Its output names titles; keep it out of the repository.

Limits of the process checks, stated plainly. They stop mistakes and shortcuts, not a person who edits the lab:
ledger lines that are not committed yet can still be removed; the pins can be rewritten (the harness hash then
changes in every later line); `run.py`'s own checks can be edited (the same). What the checks guarantee is that
each of these leaves a trace in git or in the ledger.
