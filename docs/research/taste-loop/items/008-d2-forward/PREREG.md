# Item 008: pre-registration, D2 forward comparison

Written by the orchestrator on October 14, 2026, before the registered run and the gate look.

## Comparison

candidate: d288d6bc9ddf52ec1083fc7df507fccd1bcd728fba1931ed8e5787443902cf1d
reference: ladder/b1_public.py
others: before
task: T1

The candidate is rung B5 (`lab/ladder/b5_pooled.py`, pooled predictor with personal weights), unchanged. The
reference is B1 (GoodWatch score plus the member's shrunk offset). Other members' rows: only what they had written
before each block, the stricter of the two views, because a forward prediction cannot use later ratings.

## Why

PLAN.md 2.5, D2 threshold: a personal predicted score is worth showing only if B5 beats B0 and B1 forward by 0.05
points or more for other members, replicated on tier B, and the risk is calibrated on tier C. Exploratory tier A
figures (item 006 T1 table): B5 against B1 −0.088 (−0.141 to −0.033), smallest detectable 0.077, 46 of 72 members
improved; against B0 −0.115 (−0.196 to −0.033) with `all`.

## Win rule, fixed now

- **Tier A (registered run):** error of B5 minus B1 for other members; win if the 95% interval excludes zero and the
  difference is −0.05 or lower, and no guard is worse with an interval excluding zero.
- **Tier B (one gate look):** replicated if the same sign and at least half the tier A difference.
- B5 against B0 is read from the same run's reference list as a second condition, not a second registration.
- The owner's figure is reported, not judged.
- A pass here satisfies only the first two parts of the D2 threshold; calibration on tier C remains.
