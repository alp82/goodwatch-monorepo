# Decisions

One section per decision in `PLAN.md` 1. Every cell holds a number with an interval, or "not measured yet, needs X".
Pack 2026-10-13. Figures are exploratory, tier A, unless marked registered. Two comparisons are registered: D2
(item 008, not replicated) and D1's G1 (item 009, replicated). Gate looks used: 2 of 8. Today's behaviour stays until a
challenger passes confirmation. Verdicts of items 003 to 007 were reached under the protocol before amendment A1
(`PROTOCOL.md` 13); none of them becomes a win under A1.

## D1. Which scorer orders Best match and For you

Reference: B2, today's taste. Win floors: T1 0.05 points of error; T2a 0.03 of separation. Intervals are 95%, from
drawing members again (others) or franchises again (owner). The ladder below uses the latest source tables cited
per column below it; it remains exploratory tier A.

| Rung | T1 error vs B2, others | T2a separation vs B2, others | T2a, among equally well-rated, vs B2 | T2a, rated 8+ in the first 50, vs B2 | T2a separation vs B2, owner | T2b later Want to See adds, percentile vs B2 | Verdict |
|---|---:|---:|---:|---:|---:|---|---|
| B1 GoodWatch score | +0.013 (−0.091 to +0.115) | −0.049 (−0.113 to +0.015) | −0.089 (−0.146 to −0.032) | −0.004 (−0.014 to +0.006) | +0.160 (+0.093 to +0.231) | owner +0.165 (+0.109 to +0.223); others: +0.242 (+0.148 to +0.396), 3 members (sitting); +0.135 (+0.050 to +0.208), 9 members (order) | exploratory: no clear difference on the main measure; worse once well-rated titles are compared with each other |
| B3 standardized | +0.004 (−0.005 to +0.013); pair accuracy +0.031 (+0.013 to +0.051) | −0.004 (−0.041 to +0.029), detectable 0.051 | +0.007 (−0.024 to +0.036) | **+0.071 (+0.054 to +0.089)** | +0.154 (+0.103 to +0.207) | owner +0.196 (+0.148 to +0.243); others: +0.163 (+0.000 to +0.317), 3 members (sitting); +0.105 (+0.025 to +0.202), 9 members (order) | exploratory: no clear difference on the main measure; better at the top for loved titles, but **fails the guards before A1**: titles rated 5 or less in the first 50 +0.023550 (+0.007700 to +0.042883) and first 200 +0.064941 (+0.036861 to +0.098505); franchise repeats +0.482 (+0.325 to +0.637); popular titles (median vote-count difference against B2 +113,464, +88,282 to +141,629); animation +0.220 (+0.161 to +0.275) over the members' own mix |
| B4 consensus | −0.081 (−0.173 to +0.008) | +0.005 (−0.077 to +0.080), detectable 0.115 | −0.024 (−0.099 to +0.049) | −0.019 (−0.028 to −0.011) | +0.132 (+0.074 to +0.192) | owner +0.053 (−0.011 to +0.116); others: +0.155 (+0.110 to +0.183), 3 members (sitting); −0.005 (−0.101 to +0.077), 9 members (order) | exploratory: no clear difference; worse at the top |
| B5 pooled | −0.107 (−0.192 to −0.025) | **+0.133 (+0.100 to +0.166)**, detectable 0.049, 24 of 26 members improved | **+0.088 (+0.053 to +0.122)** | −0.017 (−0.027 to −0.009) | +0.231 (+0.179 to +0.285) | owner +0.051 (−0.005 to +0.107); others: +0.184 (+0.073 to +0.240), 3 members (sitting); +0.014 (−0.046 to +0.080), 9 members (order) | exploratory: best separation, but **fails the guards before A1**: worse at the top, franchise repeats +0.812 (+0.539 to +1.075), fewer shows (first-50 share minus the members' own share −0.303, −0.373 to −0.235); see below |
| BP vote count | −0.010; paired 95% interval not measurable yet, needs BP–B2 member differences (no paired comparison in the source table or ledger) | −0.114 (−0.168 to −0.061) | −0.118 (−0.172 to −0.064) | +0.425 (+0.346 to +0.506), but titles rated 5 or less too (0.314, 0.203 to 0.442, in the first 50) | −0.202 (−0.267 to −0.133) | owner +0.274 (+0.211 to +0.337); others: +0.228 (+0.062 to +0.464), 3 members (sitting); +0.284 (+0.178 to +0.382), 9 members (order) | loses; its first-50 hits are "people watch popular titles", not taste |

Column sources: T1 error and pair accuracy: `items/006-harness-fixes/ladder-T1.md`, "Rung against rung",
`all`; B1 reverses that table's B2-against-B1 row (negating the estimate and reversing the interval endpoints).
BP's point estimate subtracts its and B2's differences against B0 in that table; their separate intervals cannot
supply a paired interval. T2a separation, equally well-rated separation, first-50 gain and owner separation:
`items/010-t2a-gate/ladder-T2a.md`, respectively "Separation against B2, B1 and BP", "Among equally well-rated
titles", "Share of hidden titles in the first 50 and the first 200", and the owner's "Separation against B2,
B1 and BP" (franchises drawn again). This replaces the earlier T2a table, including BP's stale +0.369 first-50
gain with +0.425 (+0.346 to +0.506). T2b: `items/006-harness-fixes/ladder-T2b.md`, `before`, sitting for the owner
(franchises drawn again) and the primary others figure, entry order for the others variant. Verdict figures:
the same T2a table's first-50 and guard tables, plus `ledger.jsonl` run `20261014T070834-df4894a6-85a6` for B3's
paired first-50/200 disliked shares, which the table does not print. Member counts and smallest detectable
effects describe the fixed sample and detection calculation; they do not have bootstrap intervals.

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

**The orchestrator's own checks of G1 (PLAN.md 4), October 14, 2026:**

1. Raw rows: 20 members' per-member figures of the registered run read. The gain is broad: members with 18 and with
   460 hidden titles both improve; 21 of 26 improve in all.
2. The owner's first 20 (`~/goodwatch-research/taste/out/top20-owner-009.md`): positions 1 to 10 equal B3's (Isle
   of Dogs, Ethos, Maniac, Good Omens, Loki, Fullmetal Alchemist: Brotherhood, Severance, Counterpart, Poor Things,
   Atlanta), then films toward the owner's 14% shows (Brazil, Evangelion 3.0+1.0, Mickey 17, Citizen Kane, Children
   of Paradise, Utena, Fanny and Alexander, Punch-Drunk Love, The Worst Person in the World, Tekkonkinkreet). B2's are
   obscure titles with scores down to 37. Mechanism noted: with one or two titles placed no title can meet the
   ±10-point band, so the first positions fall back to F3's order and the refill acts from about position 10.
3. Shuffled labels (`controls/shuffled.py --only g1_mix.py`, three shuffles): **inconclusive**, as for every rung in
   item 004. Others −0.020 (−0.050 to +0.005), equally well-rated −0.017 (−0.044 to +0.006); owner +0.008 (−0.026
   to +0.042). No skill without the labels; the bias that cannot be excluded leans against a win, and its upper
   bound (+0.005) is far below the effect (+0.086).
4. "This would be wrong if G1 separated loved from disliked titles only because loved titles are more popular."
   Test (`items/009-composition/STRATA.md`): among hidden titles under the median vote count the gain is +0.125
   (+0.085 to +0.166), 13 of 13 members; at or over it +0.045 (−0.007 to +0.093). The gain is largest where
   popularity helps least.
5. Strata (same file): hidden movies +0.072 (+0.017 to +0.121), shows +0.072 (+0.026 to +0.113); members with fewer
   hidden titles +0.079 (+0.018 to +0.135), more +0.093 (+0.048 to +0.130); owner in +0.091 (+0.054 to +0.126);
   members rated in one sitting +0.081 (+0.039 to +0.121), in several: 4 members, too few.
6. `verify.py` reproduced both registered runs: item 009, 799 values; item 008, 1,129 values.

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

**Item 007 (B3 with a B5 floor, `items/007-b5-floor/`, Astra): nothing registered.** F1 and F2 miss item 007's
franchise limit, F3 the first-50 bar for loved titles; all three put about 16 points more animation in the first 50
than the members' own mix. Owner's first 20 under F1 and F3 equal B3's.

**Amendment A1/A2 (`PROTOCOL.md` 13), after Fable's and Astra's reviews, before item 009's results were read.** The
disliked first-50/200 shares and the median vote count become descriptive; guard 1 is the popularity-matched
disliked percentile (upper bound below +0.03), guard 2 popularity-matched separation; the T2a gate rule (item 010)
and G1's registration rule were frozen.
Amendment A1 was decisive for registering G1: under the guard before A1 its disliked first-50 share
(+0.029, +0.009 to +0.055) would have failed, and F3's figures, which G1's match, were known when A1 was written
(`items/011-phase1-exit/GATE-REVIEW-fable.md`, finding 3).

**Item 009, G1: registered and replicated (`items/009-composition/PREREG.md`).** G1 is F3's order (B3, with titles
B5 places in its bottom half moved back and one title per movie series at the front), with the first 100 positions
refilled toward the member's own share of shows and animation. Tier B checked only separation and guard 1;
the composition, franchise and first-50 figures below are tier A.

| Measure, G1 against B2, others | Value |
|---|---|
| T2a separation, registered (`20261014T150814-e864bd47-58d5`) | **+0.086 (+0.049 to +0.121)**, smallest detectable 0.053, 21 of 26 members improved |
| Guard 1, disliked titles among equally popular candidates | −0.059 (−0.092 to −0.025): pass |
| Guard 2, separation among equally popular candidates | +0.094 (+0.056 to +0.132): pass |
| Distance of the first 50 from the member's own share of shows / animation, tier A | −0.157 (−0.200 to −0.118) / −0.075 (−0.110 to −0.043): closer (gate reviews, finding 4) |
| Largest franchise count in the first 50, tier A | −0.474510 (−0.660755 to −0.307895); G1 absolute 1.000000 (1.000000 to 1.000000) |
| Rated 8+ in the first 50, tier A | 0.102482 (0.082097 to 0.123462) against B2 0.019 (0.011 to 0.028); B3 0.090 (0.071 to 0.111) |
| Tier B gate look (look 2 of 8) | **replicated**: checked only separation (same sign, at least half the size) and guard 1 (point estimate below +0.03). Estimates and intervals are withheld by the gate protocol; the numbers stay unread. |
| Owner, tier A | separation +0.228 over B2 (+0.178 to +0.280, franchises drawn again); first-50 shows 0.200000 against own 0.138105, animation 0.231200 against own 0.157258; composition intervals unavailable: one member, no resampling interval for these measures in the registered ledger line |
| Descriptive, carried to confirmation, tier A | rated 5 or less in the first 50 +0.029177 (+0.009347 to +0.055191) and first 200 +0.059203 (+0.029713 to +0.094181); median votes of the first 50 146229.704504 (115853.422105 to 178226.178753) against B2 7049.075151 (6236.158362 to 7970.846779); T2b order: later Skip / Not interested ranked higher (+0.115537, +0.049077 to +0.196381, 6 members) |

Sources: registered separation and guards from `ledger.jsonl`, run `20261014T150814-e864bd47-58d5`;
franchise, first-50 and descriptive T2a figures are copied at their printed precision from
`items/009-composition/RESULTS.md`, "T2a: absolute comparison"; B2/B3 first-50 shares from
`items/010-t2a-gate/ladder-T2a.md`; B2 median votes from the latter's ledger run
`20261014T070354-0a3aacc3-7233`. Distance figures are verified in both gate reviews, finding 4;
T2b order from `items/009-composition/RESULTS.md`, "others: all outcomes and guards", `later_pct`.
That measure pools later Skip and Not interested. Counts and gate thresholds have no sampling intervals.

The shows guard is read as distance from the member's own mix, the record's reading before item 009 (B5 failed for
too few shows); the exact statistic was fixed after the results were read, and Fable's review found the conclusion
does not depend on its form (`REVIEW-registration-fable.md`).

**Where D1 stands:** G1 is the challenger. It separates loved from disliked titles better than today's taste on
held-out tier B members; tier B checked only separation and guard 1. In the measured tier A first-50 lists,
G1 is closer to the member's own mix of shows and animation and repeats no movie series. It is not
yet the answer: T2a sees only titles members chose to watch, and G1's top is much more popular than today's
(146,230 median votes against 7,049) and holds more titles members disliked. Whether that top is good, judged on
titles members have not seen, needs the confirmation step: judged pools (T3) or sealed tier C, with a top-list harm
criterion frozen first. Today's behaviour stays until then.

**Route to confirmation (owner, October 14, 2026):** T3 parked: the revised protocol (item 012) would pass G1 with
about 2–8% probability at 20–30 judges, and only 7 of 97 eligible members were active in the last 30 days. Instead:
exposure log, G1 behind a flag for the owner first, then for everyone if the owner finds it better, watched through
the log and reversible. Weaker confirmation than PLAN.md 2.3; the owner's decision.

## D2. Whether to show a personal predicted score or risk

**Registered (item 008, `items/008-d2-forward/PREREG.md`): win on tier A, not replicated on tier B. Today's
behaviour stays: no personal predicted score.**

| Measure | Value |
|---|---|
| T1, B5 against B1, others before the block, tier A, registered (`20261014T112515-d288d6bc-a54f`) | −0.088 (−0.141 to −0.033), smallest detectable 0.077, 46 of 72 members improved: a win under PLAN.md 2.5 |
| The same, against B0 | −0.105 (−0.183 to −0.025) |
| Registered guards, B5 against B1, others before the block, tier A | pair accuracy +0.027514 (−0.009824 to +0.061931), 72 members; low-rating AUC +0.044124 (+0.004609 to +0.087386), 22 members: no guard worse with an interval excluding zero |
| Reported rating-band errors, same registered comparison | low (5 or less) +0.045762 (−0.125459 to +0.250342), 41 members; middle (6 to 7) +0.101185 (−0.017989 to +0.216377), 66 members; high (8 or more) −0.100563 (−0.160970 to −0.039103), 72 members; reported, never optimised |
| Owner | 0.000 against B1; sitting interval unavailable: the largest of 97 sittings holds 39% of the targets (franchises drawn again: +0.000 to +0.000). Under "before" other members had written almost nothing before the owner's blocks, so B5 falls back to B1's rule |
| Tier B gate look (look 1 of 8) | **not replicated**: on the held-out members the difference has the other sign or is under half of 0.088. Estimates and intervals are withheld by the gate protocol; the numbers stay unread. |
| T2a error on hidden titles, exploratory | B5 against B1 −0.158 (−0.211 to −0.107); owner 0.817 against 1.010, intervals unavailable: one member, the source table and ledger report only point estimates for owner error |
| Calibration of a risk on tier C | not measurable yet, needs a predictor that gives `p_low` and tier C ratings |

Registered guards and rating-band errors are copied at ledger precision from `ledger.jsonl`, run
`20261014T112515-d288d6bc-a54f`, `measures.others.vs["ladder/b1_public.py"]`. The owner interval limitation and
franchise interval come from that same run's `measures.owner` comparison against B1. Exploratory T2a error:
`items/010-t2a-gate/ladder-T2a.md`, "Error of the predicted rating on the hidden titles"; owner error has no
interval in its ledger runs `20261014T072025-d288d6bc-6742` (B5) and `20261014T070633-7d38ea9d-c41c` (B1).

Reading: the forward gain of a personal score over the GoodWatch score with an offset did not meet the replication
threshold on held-out tier B members; this does not establish that there is no benefit. The threshold of PLAN.md 2.5
is not met. Two confirmation attempts per decision are
allowed, each on a fresh window; the second waits for tier C ratings written after T0.

## D3. How Taste is described

T5, the Sides of you description (S) only, registered run of October 16, 2026 (`items/015-t5-whose-taste/`).
A blind reader gets one member's Sides description from their first 70% of ratings and three lists of 15 later
movie ratings (theirs and two members matched on early mean), and picks one. 12 members, 47 triples.

| Measure | Haiku 5.5 | GPT-6 Astra |
|---|---|---|
| Share correct (chance 33.3%) | 46.5% (30.6% to 62.5%) | 75.0% (56.2% to 89.6%) |
| Excess over chance | +13.2 (−2.8 to +29.2) | +41.7 (+22.9 to +56.3) |
| S minus numbers-only control | +12.5 (+4.2 to +22.9) | +39.6 (+18.8 to +60.4) |
| No-description and permuted controls | at or below chance | at or below chance |

Reading: **the registered screen does not pass**, because it needs both readers and Haiku's excess interval
includes zero. Both readers point the same way, and Astra clears every rule. Unreplicated, small (12 members,
movie-only lists), with three triples carrying a residual title link (verdict unchanged without them). The words
gate on map #652 stays closed. Version tested: the production Sides code pinned at `6082cadc`, which predates "Better Sides of you" (#666, live October 16) and the "taste groups" copy rename; `sides.server.ts` changed by about 940 lines since. The verdict is about those earlier descriptions. No T5 result exists yet for the live ones; replication on the live Sides is #674.

**Live Sides (item 016, #674, October 16, 2026): the registered screen passes.** Same design on the live Sides of you
at `3cba031f` (final short names), with the owner's rule set before the run: GPT-6 Astra's share correct must be
clearly above chance (Q62) and clearly above its numbers-only share (Q67); Haiku is descriptive. 12 members, 36
triples, balanced list ranks.

| Measure | Haiku 5.5 (descriptive) | GPT-6 Astra (decides) |
|---|---|---|
| Share correct (chance 33.3%) | 47.2% (30.6% to 66.7%) | 80.6% (69.4% to 91.7%) |
| S minus numbers-only control | +5.6 (−22.2 to +30.6) | +36.1 (+19.4 to +52.8) |
| S minus nouns-only control | +2.8 (−16.7 to +19.4) | +33.3 (+11.1 to +55.6) |
| Numbers-only, no-description, permuted controls | intervals include chance | intervals include chance |

Reading: **the words gate on map #652 opens.** The live Sides of you panel (group names, labels, and example titles
together) carries something personal that one strong reader can use beyond the ratings and beyond the genre nouns.
No control separates the generated wording from the example titles. Haiku is descriptive (interval includes
chance). The one-reader rule was set before this run and after item 015. Unreplicated and small (one pack, one pin,
movie-only lists); an offline model screen, not a member study and no product authorization by itself. Fable's
result review: stands with these caveats.
