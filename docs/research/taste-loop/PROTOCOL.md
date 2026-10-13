# The benchmark as implemented

What `lab/` does, in plain words. PLAN.md says what the benchmark is for; this file says what the code does, and
names every place where the plan left a choice open (marked **Decided here**). A change to this file needs a review.

Built in item 002. Only task T1 exists so far.

## 1. The pieces

| File | What it does |
|---|---|
| `lab/run.sh` | The one way to run a predictor. Takes a lock slot, sets limits, starts `run.py` |
| `lab/run.py` | Refuses what the protocol refuses, builds views, runs predictors, scores, writes the ledger line |
| `lab/views.py` | Builds what a predictor may see (views) and, apart from it, the answers |
| `lab/sandbox.py` | The processes predictors run in |
| `lab/score.py` | The contract check, the one output convention, the calibrator, the T1 measures |
| `lab/stats.py` | Intervals and smallest detectable effects |
| `lab/ladder/` | The fixed rungs B0 to B5 and BP |
| `lab/table.py` | The ladder table, from the ledger alone |
| `lab/verify.py` | Reruns a ledgered run and compares |
| `lab/gate.py` | The one look at tier B. Run by the orchestrator only |
| `lab/controls/` | Five controls that show the benchmark can be trusted |
| `lab/tests/` | Tests on a made-up pack (`python3 -m pytest lab/tests`); they never open the real pack or gate |

Data stays under `~/goodwatch-research/taste/`: the pack, the gate file, `work/` (views of the run in progress,
stored answers of reference rungs, the exported title file), `results/<run id>/` (`result.json` with one row per
member, and the log). The repository gets `ledger.jsonl`, which holds aggregates only.

## 2. Running

```
lab/run.sh <predictor.py> --task T1 --tier A --mode explore|registered --item NNN
           [--ref <predictor.py> ...] [--members owner,<hash prefix>,...] [--others all|no-owner|before] [--no-cache]
python3 lab/verify.py <run id>
python3 lab/table.py T1
python3 lab/controls/{shuffled,planted,leak,contract,clash}.py
python3 lab/gate.py NNN            # orchestrator only
```

- **Slots and limits.** `run.sh` takes one of two lock files and waits when both are held. It sets every thread
  variable to 2, runs at low priority, under `timeout` (30 minutes unless `TASTE_TIMEOUT` says otherwise) and under
  a 4 GB address-space limit. **Decided here:** a run's two threads are two predictor processes with one thread
  each, not one process with two; a run that counts (registered, gate, verify) uses one process at a time.
- **References.** `--ref` names the rungs the candidate is compared with. The first is the run's primary reference
  (the one the gate uses). Without `--ref` it is B0. The candidate and each reference run on the same views.
- **Stored answers.** In an exploratory or control run, a reference whose answers for exactly these views are
  already stored (same views, same title data, same harness code, same predictor file) is not run again. The
  candidate always runs. Registered, gate and verify runs store and reuse nothing.
- **What is refused,** before anything is computed and without a ledger line: a tier other than A; an item without
  a folder `items/NNN-*`; a registered run unless `items/NNN-*/PREREG.md` is committed, unchanged since, and
  contains the candidate's sha256; the 21st exploratory or 4th registered run of an item (every ledger line of that
  item and mode counts, failed runs too); `run.py` started without `run.sh`; the real pack with any ledger but the
  repository's.
- **Modes.** `explore` and `registered` are the plan's. **Decided here:** `control` (used by `lab/controls`; never a
  result, uses no budget), `verify` (writes a line without measures) and `gate` (writes a line with the verdict
  only).

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

The answers (ratings, and what the measures need: sitting, provenance, movie or show) are kept by `run.py` and
written to `work/keys/<run id>.bin`, a path no view names and the predictor process cannot open. Views and answers
are built again for every run and deleted after it. `views.py T1 owner <folder>` writes one member's views to look at.

Other members: all tier A members, whatever they wrote, whenever (leave one member out), as in the product.
`--others no-owner` removes the owner's rows (a population fit with the owner left out); `--others before` keeps
only what others had written before the block. For a tier B member (gate) the others are all tier A members.

Known limits, as in the pack: a rating edited later carries its current score and its first write time (300 of
9,017 ratings); public scores and fingerprints are as of the pull, not as of the rating.

## 4. Task T1: forward rating prediction

- A member's ratings are taken in entry order. Members with 6 or more ratings are eligible.
- Blocks start at 5, 10, 20, 40, 80, 160, 320 and 640 ratings. **Decided here:** the plan says a boundary moves "to
  the nearest sitting or bulk boundary", but most members have one sitting and no bulk write, so that rule alone
  would leave them without blocks. Implemented: a boundary is never placed between two ratings written less than 2
  seconds apart (the first design's "moment"; this keeps every bulk write whole and never splits ratings whose
  order is uncertain). It moves to the nearest place where it may be, the later one on a tie, never below 5. Two
  boundaries that land on the same place make one block, named after the smaller. A sitting boundary is always a
  place where a block may start.
- A block is predicted from what the member wrote before the block's first rating. Ratings in a bulk write are
  never targets; a bulk write inside a block is not history for that block either (it is for the next).
- Every rated title is a target, with or without a fingerprint or title data; each rung declares its fallback.
- On the pack of October 13, 2026: 98 tier A members have a target (the owner and 97 others), in 280 blocks with
  5,194 targets (999 the owner's). 72 other members have 10 or more targets.

## 5. The contract

A predictor is one Python file with `predict(view) -> dict`. The dict holds nothing but:

- `rank`, required: one finite number per target, higher is shown earlier;
- `score`: None, or one finite number per target, the rating expected;
- `p_low`: None, or one number in 0..1 per target, the chance of a rating of 5 or less.

Anything else fails the run: another return type (a bare array), another key, a wrong length or shape, a value
that is not finite, a `p_low` outside 0..1, a `score` or `p_low` given for some views and not for others, an
exception, a timeout. **Decided here:** a `score` outside 1..10 is clipped, not refused (the plan says the harness
clips). One file means one file: it can import the standard library, numpy, scipy and sklearn and nothing else,
not even a file beside it. Its sha256 in the ledger is therefore the whole predictor.

The number compared is `score` clipped to 1..10 and rounded to a whole rating, **halves up** (decided here: a
median of 7.5 counts as 8).

**The calibrator**, for a scorer without `score`. The plan asks for a monotone fit of rating on rank from the
member's history only, and leaves open where the ranks of history titles come from. **Decided here:** for every
block with 10 or more ratings of history the harness builds five calibration views; each hides a fifth of the
history (a fixed pseudo-random split by title) and asks the scorer to rank it from the rest. So every history
title is ranked by a taste that was built without its own rating. The fit is an isotonic regression of rating on
those ranks; a target's score is read from it by linear interpolation, flat beyond the ends. With fewer than 10
pairs, or when the scorer gives all history titles one rank, the score is the median of the history: rung B0.
The calibration views are ordinary views; their answers are history ratings and never leave `run.py`.

## 6. The sandbox

In T1 the view of one member shows another member's ratings, which are hidden in that member's own view, and
later blocks of a member hold earlier blocks' answers as history. The labels are absent only if nothing passes
from one view's process to another's. So:

- **One process per view,** forked from a worker that holds numpy, the title data and the predictor's source
  text, and that keeps nothing a predictor process produced (answers and logs go from pipes to files inside the
  kernel; per-view seconds and memory are written by a helper that exits).
- **Files:** Landlock lets the predictor process read its own view folder and nothing else, and write nothing.
- **System calls:** a seccomp filter refuses new processes and exec, sockets, shared memory and message queues,
  kernel keyrings, signals to other processes, looking into other processes, changing any file's size, times,
  owner or mode, file locks, priorities, limits, mounts and namespaces. (Landlock on this kernel, 6.1, does not
  stop truncating or re-timing a file the user owns; seccomp does.)
- **Namespaces:** each view's process is alone in its own process, IPC and network namespace, inside a user
  namespace without network. A machine that cannot give these still runs exploratory runs, marked in the ledger
  line; registered and gate runs refuse.
- **Limits:** 4 GB address space, 300 CPU seconds and 600 wall-clock seconds per view.
- **Report:** an audit hook notes every attempt to open or list a path, start a process or open a socket, and
  refuses it. The count and examples go into the ledger line, and the run's status becomes `attempts`. A predictor
  that goes around Python through the C library is stopped by the kernel and not counted.

What remains, stated plainly: a predictor process can still read the size and times of files whose path it knows
(not their content); two predictor processes that run at the same moment share the machine's load, which is why
runs that count run one view at a time; and the tier B gate file sits in the same account, kept from predictors by
the sandbox and from everyone else by agreement (PLAN.md 6.7).

## 7. Measures

Owner and other members are always apart. "Others" are tier A members other than the owner.

- **Primary:** average error of the rounded prediction per member over all their targets; then the mean over
  other members with 10 or more targets, each counting once. A comparison is the paired difference per member,
  candidate minus reference; below zero the candidate is better.
- **Skill:** 1 minus the candidate's mean error over the reference's, on the same members.
- **Owner:** the mean over the owner's targets.
- **Guards,** from `rank`: pair accuracy (among a member's target pairs with different ratings, the share ordered
  correctly; a tie in rank counts a half) and low-rating AUC (members with 5 or more targets rated 5 or less and 5
  or more rated higher). **Decided here:** pairs are formed inside a block only, because a scorer's rank need not
  mean the same in two blocks; a member's blocks are pooled by counting pairs.
- **Chance of a low rating:** the Brier score of `p_low`, beside the Brier score of the member's own share of
  ratings of 5 or less so far (the raw share of the visible ratings; decided here), and a reliability table in ten
  bins with counts. Only B0 gives a `p_low` on the ladder, and it gives that share.
- **Reported, never optimised:** error on ratings of 5 or less, 6 to 7, 8 or more.
- **Strata:** target in the same sitting as the last history rating, or a later one; block; movie or show;
  provenance; title with or without a fingerprint; title released two or more years before the rating, or not.
  **Decided here:** in a stratum every member with at least one target there counts once (the 10-target rule
  would empty most strata).

## 8. Uncertainty

- **Others:** bootstrap over members, 10,000 draws, seed 20261013 (both in every ledger line), 95% percentile
  interval for the mean; the median member; the count of members improved and worse. The same members get the
  same draws in every comparison of a run.
- **Owner:** bootstrap over the owner's sittings (the sitting a target was written in): whole sittings are drawn
  again. Pair accuracy and AUC of the owner are given without an interval. **Not built:** the plan's one check
  that resamples whole franchises.
- **Smallest detectable effect:** the paired difference found four times out of five by a two-sided 5% test, 2.80
  standard errors. For others the standard error is the spread of the per-member differences over the root of
  their number; for the owner it is the spread of the bootstrap draws (decided here).

## 9. The ladder

| Rung | File | What it is | Fallbacks and choices |
|---|---|---|---|
| B0 | `b0_median.py` | Median of the member's ratings so far; `p_low` is the share of 5 or less so far | Gives no order |
| B1 | `b1_public.py` | GoodWatch score / 10 plus the member's mean distance from it, shrunk toward the population's with 3 pseudo-ratings | Decided here: 3, the pseudo-count `pool.py` uses for member offsets; the population's offset is the mean over all other members' ratings. A title without a GoodWatch score gets the member's median |
| B2 | `b2_taste_today.py` | Today's taste: `2P - N` on unit-length raw fingerprints, liked from 6, weights `score - 5` and `6 - score`, Want to See at 0.5, no taste below 5 liked titles; rank is the cosine, in single precision as the product computes it | Without a taste every target gets one rank. A target without a fingerprint gets the median rank of the block's other targets. No score: calibrated |
| B3 | `b3_taste_standardized.py` | The same after each attribute is standardized against its mean and standard deviation over the reference pool (in the pool and with a fingerprint: 60,759 titles); a missing score counts as the pool mean | As B2 |
| B4 | `b4_consensus.py` | `pool.pooled_predict` with k=0, personal weights off: consensus score, shrunk offset and slope per member | See below |
| B5 | `b5_pooled.py` | The same with personal weights on (ridge penalty 300, from 3 ratings) | See below |
| BP | `bp_votes.py` | log10 of the vote count; rank only | No count ranks last. Calibrated |

- B2 and B3 are one code with one switch, as are B4 and B5; a test requires the shared part to be identical.
- B2 is checked twice: against an example worked by hand, and against `formula.server.ts` and `pool.server.ts`
  themselves, run with bun on random members: the taste vectors and cosines agree bit for bit.
- B4 and B5 are checked against the first loop's `pool.py`, run on the same views: predictions agree to 1e-8.
  **Decided here:** they use the first loop's `base` columns (74 standardized attributes, six public scores, year,
  show, English, Japanese, log votes, genres). Its 51 text columns came from a file the pack does not have. The
  branches the settings never reach (taste axes, trees, cross-fitting) are not ported. The title rows the model
  standardizes over are the titles named by any row of the view; a title without a fingerprint or title data gets
  the column means, as the original does for a missing value.
- Nothing on the ladder was tuned on this pack.

## 10. The ledger

One line per run, appended by the harness, never edited: run id, time, item, mode, task, tier, git commit and
whether `lab/` had uncommitted changes, a hash of the harness files, pack and title file hashes, the predictor's
path and sha256, each reference's, the primary reference, the options, the views (a digest of everything the views
hold, counts), seed and draws, the sandbox facts and attempts, status (`ok`, `attempts` or `failed` with the
error), every measure with its interval and smallest detectable effect, seconds per predictor, peak memory.
`table.py` reads only lines of mode explore or registered with status ok, all members and default options.

## 11. Verify, gate, controls

- **`verify.py <run id>`** refuses when the pack or a predictor file is no longer the one the run used. Otherwise it
  builds the views again, runs everything again without stored answers, one view at a time, and compares every
  measure, the views digest and the status. Exit code 0 only on a full match.
- **`gate.py NNN`** takes the item's latest finished registered run, runs its candidate and primary reference on
  tier B members (ratings from the gate file, population tier A), and prints `replicated` when the paired
  difference in error for members with 10 or more targets has the same sign as on tier A and at least half its
  size, else `not replicated`, and the looks used. One look per item, 8 per pack. The numbers go to
  `~/goodwatch-research/taste/gate/results/<pack>/` only. A gate run that does not finish uses no look. It was
  tested on a made-up pack and gate file; the builder never ran it on the real one.
- **Controls** (each writes its runs and a verdict line into the ledger):
  - `shuffled.py`: every member's ratings permuted among their titles. Pass: no rung is a win over B0 by the
    plan's rule (interval below zero and 0.05 points or more), for others and for the owner, and every rung's
    pair accuracy is within 0.05 of 0.5. Shuffling does not remove the level a rung predicts for a member, so a
    rung that shrinks a member's mean toward the population's could beat B0's median without knowing anything
    about titles; the order criterion cannot be passed that way.
  - `planted.py`: B1's rounded prediction is moved one point toward the truth on a random share of each member's
    targets, sized so that the expected error falls by 0.15. Pass: the difference to the untouched B1 has an
    interval below zero and an estimate within 0.05 of -0.15, for others and the owner.
  - `leak.py`: a predictor that goes for the pack, the answer files, other views, the harness's memory, other
    processes, the network and every way it knows to leave a note for a later view. Pass: its error equals B0's
    for every member, and the ledger line reports its attempts. A test shows the same canary does find the answers
    on a made-up pack when nothing confines it. It opens but never reads anything under a `gate` folder.
  - `contract.py`: a predictor that returns a bare array. Pass: the run fails and has no measures.
  - `clash.py`: two files named `best.py`, one answering 1, one answering 10. Pass: each gets its own result
    (per member the two errors add up to 9).

## 12. Not built in item 002

T2a, T2b, T3, T5; tier C and `sealed.py`; the franchise resampling check; a `p_low` for any rung but B0.
