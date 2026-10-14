# Decisions

One section per decision in `PLAN.md` 1. Every cell holds a number with an interval, or "not measured yet, needs X".
All figures so far are exploratory, tier A, pack 2026-10-13. No gate look has been used and nothing is
registered, so no result here is established. Today's behaviour stays until a challenger passes.

## D1. Which scorer orders Best match and For you

Reference: B2, today's taste. Win floors: T1 0.05 points of error; T2a 0.03 of separation. Intervals are 95%, from
drawing members again (others) or franchises again (owner). Sources: `items/002-harness-ladder/ladder-T1.md`
(rebuilt identically in `items/003-hidden-title/ladder-T1.md`) and `items/003-hidden-title/ladder-T2a.md`.

| Rung | T1 error vs B2, others | T2a separation vs B2, others | T2a, among equally well-rated, vs B2 | T2a, rated 8+ in the first 50, vs B2 | T2a separation vs B2, owner | T2b later Want to See adds, percentile vs B2 | Verdict |
|---|---:|---:|---:|---:|---:|---|---|
| B1 GoodWatch score | +0.014 | −0.049 (−0.113 to +0.015) | −0.089 (−0.146 to −0.032) | −0.005 (−0.015 to +0.005) | +0.160 (+0.093 to +0.231) | owner +0.165 (+0.109 to +0.223); others: 3 members (sitting), +0.135 for 9 (order) | exploratory: no clear difference on the main measure; worse once well-rated titles are compared with each other |
| B3 standardized | +0.004; pair accuracy +0.031 (+0.013 to +0.051) | −0.003 (−0.041 to +0.030), detectable 0.051 | +0.007 (−0.024 to +0.036) | **+0.070 (+0.053 to +0.088)** | +0.154 (+0.103 to +0.207) | owner +0.196 (+0.148 to +0.243); others: 3 members (sitting), +0.105 for 9 (order) | exploratory: no clear difference on the main measure; better at the top for loved titles, but **fails the guards**: titles rated 5 or less in the first 50 +0.024 (+0.008 to +0.043) and first 200 +0.064 (+0.036 to +0.098); franchise repeats +0.51 (+0.36 to +0.67); popular titles (median votes 120,513 against 7,049, after the side-list fix); animation +0.213 over the members' own mix |
| B4 consensus | −0.081 | +0.005 (−0.077 to +0.080), detectable 0.115 | −0.023 (−0.099 to +0.050) | −0.019 (−0.028 to −0.011) | +0.132 (+0.074 to +0.193) | owner +0.053 (−0.011 to +0.116); others: −0.005 for 9 (order) | exploratory: no clear difference; worse at the top |
| B5 pooled | −0.107 | **+0.133 (+0.100 to +0.166)**, detectable 0.049, 24 of 26 members improved | **+0.088 (+0.053 to +0.123)** | −0.017 (−0.027 to −0.009) | +0.231 (+0.179 to +0.285) | owner +0.051 (−0.005 to +0.107); others: +0.014 for 9 (order) | exploratory: best separation, but **fails the guards**: worse at the top, franchise repeats +0.82 (+0.55 to +1.08), fewer shows (8% in the first 50 against the members' 39%); see below |
| BP vote count | −0.010 | −0.114 (−0.168 to −0.061) | −0.118 (−0.172 to −0.064) | +0.369, but titles rated 5 or less too (0.314 in the first 50 after the side-list fix) | −0.202 (−0.266 to −0.133) | owner +0.274 (+0.211 to +0.337); others: +0.284 for 9 (order) | loses; its first-50 hits are "people watch popular titles", not taste |

T1 column: difference in error against B2 (below zero is better), from each rung's paired difference against B0
minus B2's (−0.008). Intervals against B2 for B3, B4 and B5 are in the T1 table.

**What the orchestrator found by reading the lists** (the first 20 titles each rung would show the owner, in
`~/goodwatch-research/taste/out/top20-owner.md`):

- B5's first 20 are eight George Carlin specials, other stand-up, documentaries and no shows. Across members its
  first 50 hold 8% shows against the members' own 39%. B4 is the same kind of list (history documentaries). The
  builder found the cause: B4 and B5 standardize title columns over every title a view names, which in T2a is the
  whole catalogue instead of mostly rated titles, so their top is little-known titles (median votes 3,599 and 6,830).
  B5 is good at pushing down what a member will dislike (titles rated 5 or less fall to percentile 0.41, against
  0.56 for B2) and bad at choosing the top.
- B3's first 20 look like a plausible list for the owner (Isle of Dogs, Severance, Maniac, Russian Doll, The Owl
  House), heavy on shows. The owner, shown all six lists on October 14, 2026, said B3's "looks plausible". This is one
  reader's judgement of one list, not a measurement; it does not settle the popularity tilt.
- B2, today's taste, gives obscure titles with GoodWatch scores down to 37.
- B1 gives very high-scoring regional shows with few votes.

**Checks done:** both tables rebuild from the ledger; 71 tests pass; the ledger only grew (57 lines); shuffled and leak
controls pass for T2a and all six T1 controls pass again; one T2a run (BP) reproduced all 467 values, and the orchestrator
re-ran the B3 run, which reproduced all 907 values; 22 raw per-member rows of
B5 and B3 read; no two accounts mirror each other's ratings (the closest pair agrees on 55% of 20 shared titles), so
B5's pooled gain is not a copied account.

**Item 004 (T2b and the popularity check, `items/004-want-to-see/`):**

- T2a "among equally popular" (vote counts within a factor of 1.5), separation against B2, others: B3 +0.040
  (+0.003 to +0.076), B5 +0.126 (+0.089 to +0.166), B1 −0.035, BP −0.087. With score and popularity both matched: B3
  +0.023 (−0.022 to +0.061), B5 +0.097 (+0.049 to +0.149). B5's separation gain survives these adjustments; they
  reduce popularity's part without removing it (vote count alone keeps 0.035, 0.019 to 0.051, popularity-matched).
  B3's mean percentile of loved titles stays ahead under the popularity match (+0.035, +0.022 to +0.047); its
  separation with both matched is inconclusive. "Both" keeps only titles with 50 or more matched candidates
  (3,282 of 4,788 others' titles; 20 of 26 members for the separation), so it describes those titles only.
- T2b cannot judge other members: the plan's rule (adds in a later visit) keeps 3 others; the entry-order variant
  keeps 9. For them vote count ranks later adds best (+0.284 over today's taste), as PLAN.md warned: members add
  what they were shown, and lists lean popular. Among the 3 others under the plan's sitting rule,
  B1 has the highest estimate; the +0.284 for vote count is the entry-order variant. For the owner (80 later adds),
  B3 has the highest point estimate of the taste scorers (0.798 against 0.602 for today's taste and 0.767 for
  GoodWatch score alone; against B1 +0.031, −0.017 to +0.075). Among equally popular titles its gain over today's
  taste falls from 0.196 to 0.110. It also ranks titles the owner later skipped higher (0.732 against 0.597).
- The shuffled controls are now judged against a tolerance of ±0.015 and come out **inconclusive**, not failed, for
  T2a and both T2b splits: no interval lies wholly outside the band, but the intervals are wider than it, and some
  point estimates lie outside it (−0.021 for T2a; +0.067 and −0.074 for T2b with 3 and 9 members). Small differences
  must be read against each comparison's interval and smallest detectable effect.
- Checks: 81 tests pass; the three tables rebuild from the ledger (T1 identical to item 002's numbers); the ledger
  only grew; the orchestrator re-ran B3's T2a run, which reproduced all 1,472 values.
- Fold check (same 10 members with under 60 ratings and both bands): with at most 5 hidden titles per view, B3
  against B2 moves from −0.001 to +0.019 and B5 from +0.112 to +0.093; a sensitivity check, not leave-one-out.
- Review (Astra, `items/004-want-to-see/REVIEW-astra.md`): sound after fixes; no leak found in T2b views or the
  side-list fix. Wording above corrected to it. Harness fixes queued after item 005: run a frozen, hash-checked copy
  of the predictor; show retained counts for "both"; put the same-member fold comparison in the table.

**Item 005 (fix B5's top, `items/005-fix-the-top/`, Sol 6.1): null, nothing registered.** Three candidates fixed in
advance: C1, B5 standardized over rated titles; C2, C1 with columns clipped to the rated range; C3, the average of C1's
and B3's percentiles. The registration rule (best T2a separation among candidates whose first-50 share of loved titles
reaches B3's 0.090) found none: C1 0.005, C2 0.014, C3 0.075. C1's list for the owner is nearly B5's (George Carlin
specials, stand-up, documentaries), so the cause item 003 named, standardizing over the whole catalogue, is refuted:
the pooled model itself scores these titles high, because it predicts the rating a title gets from those who watch
it, not whether a member would choose it. C3 has the most balanced profile measured so far (T2a separation against B2
+0.049, +0.012 to +0.083; loved titles in the first 50 +0.056 over B2; T2b owner +0.200), but fails guards: animation
+0.252 and franchise repeats +0.672 over B2. All three keep B5's T1 error gain (−0.107 against B2) and lose part of
its T2a separation (−0.043 to −0.084 against B5).

**Where D1 stands:** no rung replaces today's taste yet; keeping it is what the evidence supports. B5 is best at
pushing down what a member will dislike and cannot choose the top; B3 chooses a plausible top and separates no better
than today's taste. Next (item 007): B3's order with B5 as a floor (titles B5 places low go after the rest), so the
top stays B3's while B5 removes likely dislikes; then the list-composition re-ranker of phase 2 for the animation,
franchise and popularity guards.

**Caveat of the test itself:** T2a only sees titles members chose to watch. Popularity predicts that choice, so
first-50 shares favour popular scorers for every band. The separation and the "equally well-rated" figure reduce
that, but do not remove it: vote count alone keeps a separation of 0.020 (0.005 to 0.040), and GoodWatch score alone
keeps 0.043 among equally well-rated titles. Beating them is evidence beyond those baselines, not proof that what
is left is personal. Item 004 adds an "equally popular" figure.

**Review (Sol 6.1, `items/003-hidden-title/REVIEW-sol.md`): sound after fixes.** Its fixes are in item 004 and the
T2a figures above will be replaced by item 004's: a title still on the member's Want to See, Skip or Not interested
list was certainly not hidden, a shortcut no rung used on purpose but that the comparison set must remove; the
shuffled control's pass rule could pass a bias as large as the win floor; the owner's figures skipped the
five-title band minimum (no effect at present); folds of up to 20 hidden titles can hurt learned rungs more than
plain lists for members with few ratings, so a sensitivity run with at most 5 hidden titles follows. Nothing here is
a win under PLAN.md 2.5: every lead fails a guard, and none is registered.

## D2. Whether to show a personal predicted score or risk

| Measure | Value |
|---|---|
| T1 error of the best scorer against B1 (GoodWatch score + offset) | B5 −0.121 (others); owner 0.852 against 1.008 |
| T2a error on hidden titles against B1 | B5 −0.158 (−0.211 to −0.107); owner 0.817 against 1.010 |
| Thresholds of PLAN.md 2.5 | not measured yet, needs the D2 item of phase 1 |

## D3. How Taste is described

Not measured yet, needs T5 (phase 2).
