# Protocol review of item 002 (Fable 5.1, high effort), saved by the orchestrator

## Verdict

Sound after the fixes below: T1 as built is the entry-order task the plan chose and no hidden label or tier B trace
reaches a predictor, but the ladder mixes two output conventions in the D1 comparisons, prints owner intervals that
are not intervals, and lacks the `--others before` run the plan requires before B4/B5 are read.

## Blocking findings

**F1. Calibrated rungs (B2, B3, BP) and self-scoring rungs (B1, B4, B5) are not on one convention; the calibrator
is a handicap.** Verified by running: a predictor that knows nothing (uniform random ranks), pushed through the
harness's own blocks, folds, calibrator and rounding, scores +0.027 worse than B0 for the 72 primary members (three
seeds: +0.030, +0.009, +0.042; SE 0.032). Isotonic least squares on random ranks overfits a staircase; the flat fit
it should collapse to (rounded history mean) is -0.008 against B0. So part of B5 minus B2 = -0.090 is "emits its
own score". The D2 thresholds (B5 against B0 and B1) are unaffected: all three self-score.
Fix: for every calibrated rung also run the same answers with ranks permuted within each view (the calibrator
floor) and report the rung against that floor beside B0. Or fit the calibrator with absolute loss and a minimum
step count, then re-measure the floor; it must come out within 0.01 of B0.

**F2. The owner's intervals do not mean 95%.** Verified: the owner's 999 targets lie in 97 sittings, but 3 sittings
hold 65% (391, 153, 106) and 75 hold one target each. Resampling such clusters gives bimodal draws.
Fix: `stats.cluster_mean` returns no interval and no smallest detectable effect when there are fewer than 10
clusters or the largest holds more than a quarter of the rows; the table prints "n/a" there.

**F3. B4 and B5 see other members' ratings written after the target; the `--others before` rerun was never run.**
Reasoned from `views.py` and the ledger. Not label leakage, and the plan accepts it for development, but says
finalists run again with `before` and the gap is reported.
Fix: run B0, B1, B4, B5 with `--others before` and add the column to `table.py` before the ladder is cited.

## Non-blocking findings

- T1 for other members is "the next ratings typed in the same sitting": 93% of others' targets are in the sitting
  of the last history rating; the median gap at the cut is 6 seconds. The later-sitting stratum has 16 members and
  276 targets and cannot be measured on this pack. Say so where the primary is defined. Titles typed within a
  sitting are often ones the product proposed; the exposure log is the only cure.
- Calibrated rungs collapse to B0 below 10 history ratings: 330 of 4,058 primary targets (8.1%).
- All 785 bulk ratings of eligible tier A members sit before the member's first cut; the bulk rule is untested on
  real data.
- `table.py` takes the newest run per rung without checking that rows share a views digest and harness hash.
- Every ledger line says `lab_uncommitted: true`; the harness hash, not the commit, identifies the code.
- 71 of 7,953 history rows were edited after their block's cutoff; 121 targets carry a label edited later.
- B2 and B3 count an unrated Want to See title at 0.5 even when it is a target (148 titles; product behaviour).
- Calibration folds are random holdouts, not forward; this can only hurt a calibrated rung.
- B0 is a fair reference and B1 is fair: level-only constants do not beat B0 forward (+0.013, +0.029, +0.003).
- Tier split is as planned. Tier B members' watch-state, Want to See and Skip rows are in the pack, but views carry
  no watch tables and others' side tables are filtered to tier A. No tier B trace reaches a predictor.
- About 26 of the 72 primary members have 14 or fewer targets; per-member errors there are noisy.
- The leak-canary incident is reported honestly; no gate look should be counted.

## What was run

Three read-only scripts using the harness's own functions: 98 members, 280 blocks, 5,194 targets (owner 999), 72
primary members with 4,058 targets, matching the ledger. Know-nothing calibrated against B0 +0.027; rounded mean
against median -0.008; level constants +0.013, +0.029, +0.003; level drift -0.027 (others); same-sitting 93% for
others, 47% for the owner; owner sittings 391, 153, 106 of 999; bulk 785 before the first cut, 0 after.

## What the ladder table supports

On members other than the owner, B5 and B4 lower same-sitting forward rating error against B0 by about 0.1 (B5
-0.117, 53 of 72 improved; not level tracking) in exploratory runs with other members' later ratings visible. It
does not support any ordering among B2, B3 and the self-scoring rungs, anything about later sittings or shows, or
any owner interval. Nothing here is a win until registered, rerun with `--others before`, and gated.
