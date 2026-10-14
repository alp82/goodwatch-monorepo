# Item 003 report: hidden-title test (T2a)

Builder: Opus 5.5, high effort (interrupted once by a usage limit, resumed). Saved by the orchestrator from the
builder's final message.

Item 003 is finished. The hidden-title test (T2a) is in the harness and the T2a ladder ran on the real pack. Both T2a
controls pass, the T1 ladder and all six T1 controls ran again under the new harness hash and pass, and all 71 tests
pass. Nothing is committed.

**What was built** (in `docs/research/taste-loop/`): T2a in `views.py`, `score.py`, `stats.py`, `run.py` and
`table.py`. Also new: `lab/top.py`, `--task T2a` on the shuffled and leak controls, and section 4a of `PROTOCOL.md`.
Answers are cut down to the few numbers the measures need as each view is read, so a run peaks at 271 MB. The leak
canary changed (it now ranks any title whose rating it finds first, and knows the two T2a routes to an answer), so it
was re-pinned. No rung changed.

**Who counts:** 62 members (owner + 61 others), 434 views, 5,780 hidden titles (owner 992). 26 of the 61 others have
5+ titles in both bands and count for the separation. 74 of the others' rated titles and 12 of the owner's lie outside
the candidate universe; per-member counts are in `result.json`.

**Others** (95% intervals; paired differences are rung minus reference, above zero is better):

| Rung | Pct 8+ / 6-7 / ≤5 | Separation | vs B2 | vs B1 | vs BP | First 50 / 200 (8+) | First 50 / 200 (≤5) | Equally well-rated: separation, vs B2 |
|---|---|---|---|---|---|---|---|---|
| B1 | .874/.832/.796 | .086 (.039–.138) | −.049 (−.113,+.015) | ref | +.065 (+.026,+.108) | .014/.073 | .006/.023 | .043, −.089 (−.146,−.032) |
| B2 | .697/.637/.556 | .134 (.076–.192) | ref | +.049 (−.015,+.113) | +.114 (+.061,+.168) | .019/.039 | .001/.004 | .131, ref |
| B3 | .890/.833/.765 | .131 (.079–.187) | −.003 (−.041,+.030) | +.045 (−.010,+.099) | +.111 (+.062,+.161) | .089/.185 | .025/.068 | .139, +.007 (−.024,+.036) |
| B4 | .666/.579/.515 | .140 (.074–.201) | +.005 (−.077,+.080) | +.054 (−.004,+.106) | +.119 (+.055,+.180) | .000/.000 | .000/.000 | .109, −.023 (−.099,+.050) |
| B5 | .687/.570/.414 | .267 (.206–.323) | +.133 (+.100,+.166) | +.181 (+.127,+.234) | +.247 (+.189,+.297) | .001/.007 | .001/.002 | .220, +.088 (+.053,+.123) |
| BP | .975/.967/.959 | .020 (.005–.040) | −.114 (−.168,−.061) | −.065 (−.108,−.026) | ref | .388/.594 | .264/.469 | .013, −.118 (−.172,−.064) |

Smallest detectable separation difference against B2: B1 .094, B3 .051, B4 .115, B5 .049, BP .079.

**Guards, others** (first 50 candidates; members' own mix is 39% shows, 13% animation): shows / animation / largest
franchise count / median votes:
- B1 .714 / .251 / 1.0 / 12,900
- B2 .220 / .201 / 1.5 / 7,181
- B3 .445 / .348 / 2.0 / 142,136
- B4 .022 / .078 / 2.7 / 3,599
- B5 .083 / .169 / 2.3 / 6,830
- BP .045 / .051 / 3.4 / 1.62 million

**Score error on hidden titles** (only rungs that give a score):
- B1: others 1.485, owner 1.010
- B4: others 1.417 (vs B1 −.068, −.111 to −.027), owner 0.892
- B5: others 1.328 (vs B1 −.158, −.211 to −.107), owner 0.817

**Owner** (plain figures; no interval over sittings because the largest of 60 sittings holds 34% of the titles; ranges
are the franchise-resampled figure):

| Rung | Pct 8+ / 6-7 / ≤5 | Separation | vs B2 | vs B1 | vs BP | Equally well-rated separation | First 50 / 200 (8+) |
|---|---|---|---|---|---|---|---|
| B1 | .793/.627/.412 | .381 (.323–.438) | +.160 (+.093,+.231) | ref | +.362 | .082 | .015/.035 |
| B2 | .553/.482/.332 | .221 (.161–.278) | ref | −.160 | +.202 | .182 | .000/.005 |
| B3 | .838/.700/.463 | .375 (.312–.436) | +.154 (+.103,+.207) | −.006 (−.062,+.047) | +.355 | .271 | .040/.120 |
| B4 | .665/.502/.312 | .353 (.305–.403) | +.132 (+.074,+.193) | −.028 (−.078,+.021) | +.334 | .147 | 0/0 |
| B5 | .696/.485/.244 | .452 (.406–.497) | +.231 (+.179,+.285) | +.071 (+.033,+.108) | +.432 | .244 | 0/0 |
| BP | .970/.960/.951 | .019 (−.004–.048) | −.202 | −.362 | ref | .004 | .249/.451 |

Owner guards: the owner's own titles are 14% shows and 16% animation. Shows in the first 50 range from .004 (B5) to
.742 (B3); animation from .000 (BP) to .339 (B3).

**Controls:**
- **T2a leak: pass.** The canary's error equals B0's for every member, every hidden title sits at percentile 0.5
  exactly, and 13,888 attempts were reported.
- **T2a shuffled: pass.** All 24 figures are level with zero; the largest is the owner's B5 at +.053 (p .14).
- **T1 controls:** shuffled, planted (−.148, −.162 to −.133), leak, contract, clash and rankscale all pass.
- **T1 ladder:** all 21 runs repeated; every measure is identical to item 002's. The rebuilt table is in
  `items/003-hidden-title/ladder-T1.md`.
- **Verify:** one T2a run (BP against itself) reproduced all 467 values.

**Run times:** B1 105 s, BP 65 s, B2 133 s, B3 169 s, B4 379 s, B5 522 s; the six took about 23 minutes in total.

**Decided here** (each is in `PROTOCOL.md` 4a or 11):
1. Folds — departs from the brief's "folds of 20": a view hides at most 20 titles and there are always at least 5
   folds. Folds of 20 alone would hide everything for the 6 members with 18–20 rated titles, and a quarter or more for
   44 of the 61 others. The owner still gets 50 views.
2. Fold order is a sha256 over the member and title, so the shuffled control hides the same titles. Eligibility counts
   all of a member's ratings.
3. No time cutoff: history is as of the pull. `--others before` is refused; `all` and `no-owner` work.
4. Titles on a member's Want to See, Skip or Not interested lists stay candidates, as the brief says. So a target on
   one of those lists is known not to be hidden.
5. Each hidden title is compared against the unrated candidates only, ties count half, and "in the first 50" means
   fewer than 50 candidates rank above it.
6. A band counts only with 5 or more titles, for its own figures as well as for the separation.
7. "Equally well-rated" means a GoodWatch score within 3 points on the 0–100 scale, inclusive.
8. Guards: animation means production method "Animation"; a franchise is a movie series; the member's own mix is their
   rated universe titles.
9. T2a has no calibrator: error is reported only for rungs that give a score. The default reference is B2.
10. Shuffled pass rule: a two-sided test at 0.001. A 3-standard-error rule written first failed on the made-up pack.
11. The shuffled control gained `--only` and `--reuse`, so its six runs can be split across calls.
12. `top.py` runs pinned rungs in-process without the sandbox. Nothing is hidden in that view, so nothing can leak.

**Things to know:**
- B4 and B5 run unchanged but behave differently here. They standardize their title columns over every title a view
  names, which in T2a is the whole universe rather than mostly rated titles. Their first 50 candidates are little-known
  titles (median votes 3,600 and 6,800), and their first-50 shares are about zero.
- Not done: a verify of a full comparison run (one view at a time takes over 10 minutes). There is no gate for T2a,
  and a registered T2a run is untested.

All runs were made with `lab/` uncommitted. The owner's top-20 list for every rung is in
`~/goodwatch-research/taste/out/top20-owner.md`, outside the repository.
