# The benchmark as implemented

What `lab/` does, in plain words. PLAN.md says what the benchmark is for; this file says what the code does, and
names every place where the plan left a choice open (marked **Decided here**). A change to this file needs a review.

Built in item 002 and changed in its fix pass after three reviews (the changed decisions are marked **Changed in
the fix pass**). Only task T1 exists so far.

## 1. The pieces

| File | What it does |
|---|---|
| `lab/run.sh` | The one way to run a predictor. Takes a lock slot, sets limits, starts `run.py` |
| `lab/run.py` | Refuses what the protocol refuses, builds views, runs predictors, scores, writes the ledger line |
| `lab/views.py` | Builds what a predictor may see (views) and, apart from it, the answers |
| `lab/sandbox.py` | The processes predictors run in |
| `lab/score.py` | The contract check, the one output convention, the calibrator and its floor, the T1 measures |
| `lab/stats.py` | Intervals and smallest detectable effects |
| `lab/ladder/` | The fixed rungs B0 to B5 and BP |
| `lab/pins.json`, `lab/pin.py` | The sha256 of every rung and every control predictor, and the tool that writes it |
| `lab/table.py` | The ladder table, from the `ladder` lines of the ledger alone |
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
lab/run.sh <predictor.py> --task T1 --tier A --mode explore|registered|ladder --item NNN
           [--ref <ladder rung> ...] [--members owner,<hash prefix>,...] [--others all|no-owner|before] [--no-cache]
lab/run.sh --verify <run id>
lab/run.sh --gate NNN              # orchestrator only
python3 lab/table.py T1
python3 lab/controls/{shuffled,planted,leak,contract,clash,rankscale}.py
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
  (the one the gate uses). Without `--ref` it is B0. **Changed in the fix pass:** in every mode a reference is a
  pinned file of `lab/ladder/`, each named once, so a run scores at most the rungs of the ladder beside its
  candidate.
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
    runs too).
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
  before the block, with times; and the titles to predict.
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
`views.py T1 owner <folder>` writes one member's views to look at.

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
  digest and title digest. After a harness change the whole ladder is run again.

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
  - `rankscale.py`, **new in the fix pass**: rung B2 with a constant added to every rank of a view (the number of
    ratings the view shows). The order inside every view is B2's. Outcome, by decision: **it fails the contract
    check** (rank outside 0..1 without a score); it does not run and change nothing. Pass: the run fails and has
    no measures.

## 12. Not built in item 002

T2a, T2b, T3, T5; tier C and `sealed.py`; a `p_low` for any rung but B0; intervals for the owner's pair accuracy
and AUC.

Limits of the process checks, stated plainly. They stop mistakes and shortcuts, not a person who edits the lab:
ledger lines that are not committed yet can still be removed; the pins can be rewritten (the harness hash then
changes in every later line); `run.py`'s own checks can be edited (the same). What the checks guarantee is that
each of these leaves a trace in git or in the ledger.
