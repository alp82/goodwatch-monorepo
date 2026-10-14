# Decisions

One section per decision in `PLAN.md` 1. Every cell holds a number with an interval, or "not measured yet, needs X".
All figures so far are exploratory, tier A, pack 2026-10-13. No gate look has been used and nothing is
registered, so no result here is established. Today's behaviour stays until a challenger passes.

## D1. Which scorer orders Best match and For you

Reference: B2, today's taste. Win floors: T1 0.05 points of error; T2a 0.03 of separation. Intervals are 95%, from
drawing members again (others) or franchises again (owner). Sources: `items/002-harness-ladder/ladder-T1.md`
(rebuilt identically in `items/003-hidden-title/ladder-T1.md`) and `items/003-hidden-title/ladder-T2a.md`.

| Rung | T1 error vs B2, others | T2a separation vs B2, others | T2a, among equally well-rated, vs B2 | T2a, rated 8+ in the first 50, vs B2 | T2a separation vs B2, owner | T2b | Verdict |
|---|---:|---:|---:|---:|---:|---|---|
| B1 GoodWatch score | +0.014 | −0.049 (−0.113 to +0.015) | −0.089 (−0.146 to −0.032) | −0.005 (−0.015 to +0.005) | +0.160 (+0.093 to +0.231) | not measured yet, needs item 004 | indistinguishable on the main measure; worse once well-rated titles are compared with each other |
| B3 standardized | +0.004; pair accuracy +0.031 (+0.013 to +0.051) | −0.003 (−0.041 to +0.030), detectable 0.051 | +0.007 (−0.024 to +0.036) | **+0.070 (+0.053 to +0.088)** | +0.154 (+0.103 to +0.207) | not measured yet, needs item 004 | indistinguishable on the main measure; **win at the top of the list**; guard: tilts to popular titles (median votes 142,136 against 7,181) and animation (+0.213 over the members' own mix) |
| B4 consensus | −0.081 | +0.005 (−0.077 to +0.080), detectable 0.115 | −0.023 (−0.099 to +0.050) | −0.019 (−0.028 to −0.011) | +0.132 (+0.074 to +0.193) | not measured yet, needs item 004 | null; worse at the top |
| B5 pooled | −0.107 | **+0.133 (+0.100 to +0.166)**, detectable 0.049, 24 of 26 members improved | **+0.088 (+0.053 to +0.123)** | −0.017 (−0.027 to −0.009) | +0.231 (+0.179 to +0.285) | not measured yet, needs item 004 | **win at ordering the whole list, fails at the top**: see below |
| BP vote count | −0.010 | −0.114 (−0.168 to −0.061) | −0.118 (−0.172 to −0.064) | +0.369, but titles rated 5 or less too (0.264 in the first 50) | −0.202 (−0.266 to −0.133) | not measured yet, needs item 004 | loses; its first-50 hits are "people watch popular titles", not taste |

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
  House), heavy on shows.
- B2, today's taste, gives obscure titles with GoodWatch scores down to 37.
- B1 gives very high-scoring regional shows with few votes.

**Checks done:** both tables rebuild from the ledger; 71 tests pass; the ledger only grew (57 lines); shuffled and leak
controls pass for T2a and all six T1 controls pass again; one T2a run (BP) reproduced all 467 values, and the orchestrator
re-ran the B3 run, which reproduced all 907 values; 22 raw per-member rows of
B5 and B3 read; no two accounts mirror each other's ratings (the closest pair agrees on 55% of 20 shared titles), so
B5's pooled gain is not a copied account.

**Where D1 stands:** no rung replaces today's taste yet. Two leads for phase 1: B5's ordering with a fixed top
(its standardization done as in T1, or the list-composition re-ranker of phase 2 with a relevance floor), and B3,
which is cheap and better at the top but must be checked for its popularity tilt. A combination of the two (B5 to
push down, B3 to choose the top) is a candidate to register, not something measured.

**Caveat of the test itself:** T2a only sees titles members chose to watch. Popularity predicts that choice, so
first-50 shares favour popular scorers for every band. The separation and the "equally well-rated" figure are the
measures that remove that.

## D2. Whether to show a personal predicted score or risk

| Measure | Value |
|---|---|
| T1 error of the best scorer against B1 (GoodWatch score + offset) | B5 −0.121 (others); owner 0.852 against 1.008 |
| T2a error on hidden titles against B1 | B5 −0.158 (−0.211 to −0.107); owner 0.817 against 1.010 |
| Thresholds of PLAN.md 2.5 | not measured yet, needs the D2 item of phase 1 |

## D3. How Taste is described

Not measured yet, needs T5 (phase 2).
