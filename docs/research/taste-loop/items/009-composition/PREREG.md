# Item 009: pre-registration, G1 on the hidden-title test (T2a)

Written by the orchestrator on October 14, 2026, after item 009's exploratory results, the distance addendum and
Fable's review of the registration decision (`REVIEW-registration-fable.md`), before the registered run and the gate
look.

## Comparison

candidate: e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1
reference: ladder/b2_taste_today.py
others: all
task: T2a

The candidate is G1 (`lab/candidates/009/g1_mix.py`), unchanged since commit `0f9b3c2d`: F3's order with the first
100 positions refilled toward the member's own share of shows and animation. The reference is B2, today's taste.
No `--fold-check`, no `--members`, no shuffle, no plant. The run is under the current harness
(`c1deebe2…`, item 010), so the exploratory figures below are expectations, not the result; a material difference
from them stops the item and is reported.

## Tier A rule (amendment A2, `PROTOCOL.md` 13, verbatim)

G1 is registered on T2a against B2 (`others: all`) if and only if, on tier A, for members other than the owner:
separation against B2 is at least +0.03 with an interval excluding zero; none of shows, animation and franchise is
worse than B2 with an interval excluding zero; guard 1 passes (upper bound below +0.03); guard 2 passes.

Judged on the registered run's figures. Expected from the exploratory run `20261014T113107-e864bd47-b08d`:
separation +0.086 (+0.049 to +0.121); guard 1 −0.059 (−0.092 to −0.025); guard 2 +0.094 (+0.056 to +0.132);
franchise −0.47 (−0.66 to −0.31).

**Shows and animation are read as distance from the member's own mix:** per view, the absolute difference between
the first-50 share and the member's own share, averaged over the member's views, paired against B2 with the
harness's bootstrap (`items/009-composition/distance.py`, `DISTANCE.md`), applied to the registered run. This reading
is the record's from before item 009's results: `PROTOCOL.md` 4a defines the guard as the share minus the member's
own share; `DECISIONS.md` D1 failed B5 for too few shows and B3 for too much animation; item 007's RESULTS.md calls a
larger departure from the member's own mix the concern; PLAN.md phase 2 names the re-ranker "toward the member's own
mix". The exact statistic was fixed after RESULTS.md was read; the conclusion does not depend on its form (Fable's
review, finding 5). The harness's signed figures are reported alongside (expected: shows +0.175, animation −0.015).
Expected distances: shows −0.157 (−0.200 to −0.118), animation −0.075 (−0.110 to −0.043).

## Tier B rule (one gate look, 2 of 8)

The T2a gate rule of amendment A1, as built in item 010: replicated if tier B separation against B2 is positive and
at least half the tier A effect, **and** guard 1's point estimate is below +0.03, each with at least 10 paired tier B
members. Guard 2 and the mix guards are tier A criteria only.

## Not judged here, carried to the confirmation step

- Disliked titles in the first 50 and 200 (expected +0.029 and +0.059 over B2), median votes of the first 50
  (146,230 against 7,049): descriptive under A1, carried to the top-list harm criterion that A1 requires before any
  product change (T3 pools or sealed tier C).
- T2b order: later Skip percentile worse than B2 (+0.116, 6 members) and AUC −0.060; T2b has no gate.
- The owner's figures are reported, not judged.

## Outcomes

- Win on tier A and replicated: D1 records G1 as the challenger for confirmation on T3 / tier C; today's behaviour
  stays until then.
- Not a win on tier A, or not replicated: D1 stays "keep B2", with the popularity tilt as the open question.
- G1 is not changed in any outcome.
