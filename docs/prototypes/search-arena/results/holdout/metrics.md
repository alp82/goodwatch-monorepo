# Holdout metrics (round-3 finalists)

2026-09-23. Finalists `r3-combo`, `r3-combo-fast`, `sparse-fast` (frozen as of round 3, run3.FINAL), `prod`, and the
round-2 leader `r2-combo-bgeb-strict` as a reference (not a finalist). No ranker crashed on holdout and no code or config
changed; `harness/holdout.py lists` reproduces the holdout entries that `run3.py final` wrote (identical top 10s).

Grading: 551 new pairs (26 graded queries, 16-25 pooled titles each), two sonnet assessors per part (2 parts of 275 / 276;
A in pool order, B reversed). A/B quadratic weighted kappa 0.918, exact agreement 79.1%. 4 pairs were 2+ apart and were
settled by a blind assessor C (`results/grading/ho-C.json`): Exit (core-10) 2, My Companions in the Bleak House
(core-20) 0, Half Light (lab-08) 3, Kill (new-01) 2. Merged add-only into `results/grades.json` (2,002 → 2,553 pairs;
no existing grade touched). Files: `results/grading/ho-*`.

## Verdict: no finalist wins

Applied mechanically (evaluation-contract.md, Winning and Notes):

| criterion | r3-combo | r3-combo-fast | sparse-fast |
|---|---|---|---|
| ndcg10 ≥ prod + 0.05 (prod 0.461) | pass (0.756, +0.295) | pass (0.735, +0.274) | pass (0.722, +0.261) |
| beats other-family finalists by ≥ 0.02 | pass (+0.034 vs sparse-fast) | **fail** (+0.013 vs sparse-fast) | **fail** (−0.034 vs r3-combo) |
| Notes rule (same family within 0.02 → lower latency wins) | not triggered: r3-combo − r3-combo-fast = 0.0207 | not triggered (0.0207 > 0.02) | n/a (own family) |
| bad5 ≤ prod (40) | pass (15) | pass (17) | pass (19) |
| no query loses > 0.15 vs prod | **fail** (new-01 −0.69, new-08 −0.23, core-18 −0.151) | **fail** (new-01 −0.89, new-08 −0.25, core-18 −0.22) | **fail** (new-01 −0.89, new-08 −0.25, core-18 −0.22) |
| added cost < $0.10 / 1k | pass ($0: local embedding, no LLM) | pass ($0) | pass ($0) |
| est. whole-search p95 < 1 s | pass, marginal (~0.95 s) | pass (~0.55 s) | pass (~0.55 s) |
| **wins** | **no** | **no** | **no** |

The "unless the review explains why the production grade was wrong" exception does not apply: in all three losing
queries the production titles were graded correctly (see below). The reference `r2-combo-bgeb-strict` (0.733) would also
fail, on new-01 (−0.25).

Whole-search p95 estimate: uncached Jev reading tail ≈ 0.44 s (baseline-cost-latency.md §2) plus the post-reading tail.
`r3-combo` keeps the Crate text pool, whose worst sequential fallback path is about 0.5 s from the app server (§5), so
≈ 0.95 s; production is ≈ 0.9 s. The fast variants add one Qdrant batch plus embedding (p50 ≈ 52 ms, tail ≈ 0.1 s), so
≈ 0.55 s.

## Losing queries (> 0.15 below prod)

- **new-01 "heist on a train"** (prod 0.941): production's Crate phrase pool found real train robberies (Robbery, Money
  Train, Red Sun, The 5-Man Army, The First Great Train Robbery, all 3). The round-3 rankers drop the train facet and fill
  the top with generic heists graded 0 (Money Heist movie and show at #1 and #3, Fast Five, Baby Driver, The Getaway,
  Reservoir Dogs). The r2 leader still had Robbery and The First Great Train Robbery at #1-2 (−0.25), so the round-3
  changes caused the drop: the sparse BM25F text signal (and the title-kind bonus for the Jev-concrete word "heist")
  favour heist-heavy titles; `r3-combo` keeps Crate and recovers two train robberies at #5 and #8 (−0.69), the fast
  variants lose all of them (−0.89). Production's grades are correct.
- **new-08 "like Breaking Bad but a comedy"** (prod 0.755): all round-3 rankers put Breaking Bad itself at #1 (grade 0
  per the intent, which calls the drama itself weak) and Sherlock at #4 (0). The r2 leader didn't (+0.01), so the sparse
  index's title field is the likely cause (the query contains the exact title bigram). Production's 3s (The Wrong Mans,
  How to Sell Drugs Online (Fast)) are correct.
- **core-18 "Brain's fried. Something warm and funny, but not painfully cheesy."** (prod 0.727): no grade-0 titles on
  either side; the finalists' lists are mostly 2s (Chef, Crocodile Dundee, 50 First Dates, Phineas and Ferb, SpongeBob)
  where production has more 3s (Moone Boy, Mister Roberts, Starstruck, The Grump, The Cosby Show). A shade loss, not a
  production grading error. `r3-combo` misses the threshold by 0.0007 (−0.1507).

Without new-01 the ordering is unchanged (r3-combo 0.776, r3-combo-fast 0.763, sparse-fast 0.749, prod 0.442).

Guardrails: Spirited Away at #1 in every list; "hunter x hunter" is #2 in every list including production (the known tie
of two exact titles since round 1), so title@1 is 1/2 for all and no finalist regresses against production.

## Summary

est. p50 = added app-server time after the reading (metrics.py stage model); p95 = whole search, see above.

| ranker | ndcg10 | Δ vs prod | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | unj10 | est. p50 after reading | est. p95 whole search |
|---|---|---|---|---|---|---|---|---|---|---|---|
| prod | 0.461 | +0.000 | 4.54 | 40 | 0.124 | 0.209 | 0 | 1/2 | 0 | 235 ms | ~0.90 s |
| r3-combo | 0.756 | +0.295 | 7.50 | 15 | 0.385 | 0.632 | 2 | 1/2 | 0 | 156 ms | ~0.95 s |
| r3-combo-fast | 0.735 | +0.274 | 7.42 | 17 | 0.365 | 0.623 | 2 | 1/2 | 0 | 52 ms | ~0.55 s |
| sparse-fast | 0.722 | +0.261 | 7.27 | 19 | 0.343 | 0.609 | 2 | 1/2 | 0 | 51 ms | ~0.55 s |
| r2-combo-bgeb-strict | 0.733 | +0.272 | 7.12 | 20 | 0.285 | 0.537 | 2 | 1/2 | 0 | 156 ms | ~0.95 s |

## Guardrails: title lookups

| query | expected | prod | r3-combo | r3-combo-fast | sparse-fast | r2-combo-bgeb-strict |
|---|---|---|---|---|---|---|
| core-05 Spirited Away | Spirited Away | #1 | #1 | #1 | #1 | #1 |
| new-24 hunter x hunter | Hunter x Hunter | #2 | #2 | #2 | #2 | #2 |

## ndcg10 by query type

| type (queries) | prod | r3-combo | r3-combo-fast | sparse-fast | r2-combo-bgeb-strict |
|---|---|---|---|---|---|
| audience (2) | 0.218 | 0.815 | 0.803 | 0.803 | 0.754 |
| era_genre (1) | 0.121 | 0.955 | 0.955 | 0.856 | 0.754 |
| like_x_but_y (1) | 0.755 | 0.523 | 0.509 | 0.509 | 0.766 |
| long_descriptive (4) | 0.401 | 0.720 | 0.670 | 0.669 | 0.706 |
| negation (2) | 0.523 | 0.718 | 0.709 | 0.709 | 0.608 |
| non_english (3) | 0.311 | 0.732 | 0.732 | 0.668 | 0.701 |
| setting_mood (2) | 0.654 | 0.784 | 0.829 | 0.829 | 0.789 |
| short_vague (2) | 0.415 | 0.691 | 0.691 | 0.691 | 0.691 |
| structural (2) | 0.393 | 0.696 | 0.695 | 0.695 | 0.650 |
| subject_object (6) | 0.627 | 0.796 | 0.741 | 0.741 | 0.804 |
| typo (1) | 0.406 | 0.921 | 0.874 | 0.834 | 0.796 |
| all (26) | 0.461 | 0.756 | 0.735 | 0.722 | 0.733 |

## ndcg10 per query (diff vs prod)

| query | type | prod | r3-combo | r3-combo-fast | sparse-fast | r2-combo-bgeb-strict |
|---|---|---|---|---|---|---|
| new-01 heist on a train | subject_object | 0.941 | 0.253 (-0.69) **LOSS** | 0.053 (-0.89) **LOSS** | 0.053 (-0.89) **LOSS** | 0.693 (-0.25) **LOSS** |
| new-08 like Breaking Bad but a comedy | like_x_but_y | 0.755 | 0.523 (-0.23) **LOSS** | 0.509 (-0.25) **LOSS** | 0.509 (-0.25) **LOSS** | 0.766 (+0.01) |
| core-18 Brain’s fried. Something warm and funny, but not painfu | long_descriptive | 0.727 | 0.576 (-0.15) **LOSS** | 0.506 (-0.22) **LOSS** | 0.506 (-0.22) **LOSS** | 0.692 (-0.03) |
| new-06 kung fu comedy | subject_object | 1.000 | 0.958 (-0.04) | 0.960 (-0.04) | 0.960 (-0.04) | 1.000 (+0.00) |
| lab-09 scifi with cars | subject_object | 0.855 | 0.823 (-0.03) | 0.838 (-0.02) | 0.838 (-0.02) | 0.735 (-0.12) |
| core-24 a hopeful space adventure without horror | negation | 0.856 | 0.879 (+0.02) | 0.858 (+0.00) | 0.858 (+0.00) | 0.962 (+0.11) |
| lab-08 melancholy lighthouse keeper mystery | setting_mood | 0.796 | 0.813 (+0.02) | 0.813 (+0.02) | 0.813 (+0.02) | 0.890 (+0.09) |
| core-09 unreliable narrator | structural | 0.502 | 0.621 (+0.12) | 0.540 (+0.04) | 0.540 (+0.04) | 0.581 (+0.08) |
| new-18 wholesome | short_vague | 0.641 | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) |
| core-28 Des gens riches qui se comportent horriblement entre eu | non_english | 0.276 | 0.441 (+0.16) | 0.441 (+0.16) | 0.679 (+0.40) | 0.674 (+0.40) |
| new-20 An ordinary guy slowly realises his whole life is stage | long_descriptive | 0.343 | 0.793 (+0.45) | 0.632 (+0.29) | 0.559 (+0.22) | 0.793 (+0.45) |
| new-05 rainy neon cyberpunk city | setting_mood | 0.511 | 0.754 (+0.24) | 0.844 (+0.33) | 0.844 (+0.33) | 0.688 (+0.18) |
| new-03 satire about politics or big corporations | subject_object | 0.567 | 0.899 (+0.33) | 0.901 (+0.33) | 0.901 (+0.33) | 0.838 (+0.27) |
| new-14 good first anime for someone who never watched anime | audience | 0.295 | 0.667 (+0.37) | 0.643 (+0.35) | 0.643 (+0.35) | 0.585 (+0.29) |
| core-16 Something where halfway through you realise the person  | long_descriptive | 0.373 | 0.822 (+0.45) | 0.733 (+0.36) | 0.802 (+0.43) | 0.921 (+0.55) |
| new-12 war movie that isn't about World War II | negation | 0.191 | 0.557 (+0.37) | 0.561 (+0.37) | 0.561 (+0.37) | 0.255 (+0.06) |
| core-29 Kafam çok yorgun. Sıcak ve komik ama aşırı duygusal olm | non_english | 0.465 | 0.910 (+0.45) | 0.910 (+0.45) | 0.806 (+0.34) | 0.802 (+0.34) |
| new-23 psycological thriler with a big twist | typo | 0.406 | 0.921 (+0.51) | 0.874 (+0.47) | 0.834 (+0.43) | 0.796 (+0.39) |
| core-20 bleak | short_vague | 0.190 | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) |
| lab-05 grief after losing a child | subject_object | 0.324 | 0.935 (+0.61) | 0.831 (+0.51) | 0.831 (+0.51) | 0.857 (+0.53) |
| new-16 whole movie takes place in one room | structural | 0.283 | 0.771 (+0.49) | 0.850 (+0.57) | 0.850 (+0.57) | 0.719 (+0.44) |
| core-14 Rich people being absolutely awful to each other, prefe | long_descriptive | 0.161 | 0.691 (+0.53) | 0.810 (+0.65) | 0.810 (+0.65) | 0.417 (+0.26) |
| new-22 Antikriegsfilm, der zeigt, wie sinnlos Krieg ist | non_english | 0.193 | 0.845 (+0.65) | 0.845 (+0.65) | 0.518 (+0.33) | 0.626 (+0.43) |
| core-10 dark comedy about rich people | subject_object | 0.076 | 0.905 (+0.83) | 0.865 (+0.79) | 0.865 (+0.79) | 0.701 (+0.62) |
| core-12 with my parents | audience | 0.142 | 0.964 (+0.82) | 0.964 (+0.82) | 0.964 (+0.82) | 0.922 (+0.78) |
| new-10 90s crime movies with great dialogue | era_genre | 0.121 | 0.955 (+0.83) | 0.955 (+0.83) | 0.856 (+0.74) | 0.754 (+0.63) |

## Losing queries (> 0.15 below prod): top 10 with grades

### core-18 Brain’s fried. Something warm and funny, but not painfully cheesy.

Intent: Easy, warm comedies with wit, avoiding saccharine sentimentality.

| rank | prod | r3-combo | r3-combo-fast | sparse-fast |
|---|---|---|---|---|
| 1 | Moone Boy (2012) **3** | Chef (2014) **2** | Chef (2014) **2** | Chef (2014) **2** |
| 2 | Fever Pitch (1997) **2** | Crocodile Dundee (1986) **2** | Crocodile Dundee (1986) **2** | Crocodile Dundee (1986) **2** |
| 3 | Three Wise Men and a Baby (2022) **1** | Moone Boy (2012) **3** | 50 First Dates (2004) **2** | 50 First Dates (2004) **2** |
| 4 | Himouto! Umaru-chan (2015) **2** | Phineas and Ferb (2007) **2** | Phineas and Ferb (2007) **2** | Phineas and Ferb (2007) **2** |
| 5 | Mister Roberts (1955) **3** | SpongeBob SquarePants (1999) **2** | SpongeBob SquarePants (1999) **2** | SpongeBob SquarePants (1999) **2** |
| 6 | Starstruck (2021) **3** | Son of Flubber (1963) **2** | Son of Flubber (1963) **2** | Son of Flubber (1963) **2** |
| 7 | Master Eder and his Pumuckl (1982) **1** | Brooklyn Nine-Nine (2013) **3** | Kingdom (2007) **2** | Kingdom (2007) **2** |
| 8 | The Grump (2014) **3** | Whose Line Is It Anyway? (1988) **2** | Brooklyn Nine-Nine (2013) **3** | Brooklyn Nine-Nine (2013) **3** |
| 9 | The Cosby Show (1984) **3** | The Muppets (2011) **2** | Whose Line Is It Anyway? (1988) **2** | Whose Line Is It Anyway? (1988) **2** |
| 10 | Crocodile Dundee (1986) **2** | Airplane! (1980) **2** | Airplane! (1980) **2** | Airplane! (1980) **2** |

### new-01 heist on a train

Intent: A robbery or theft carried out on or against a train is central. Trains without a heist, or heists without a train, are weak.

| rank | prod | r3-combo | r3-combo-fast | sparse-fast |
|---|---|---|---|---|
| 1 | Robbery (1967) **3** | Money Heist (2017) **0** | Money Heist (2017) **0** | Money Heist (2017) **0** |
| 2 | Money Train (1995) **3** | Fast Five (2011) **0** | Fast Five (2011) **0** | Fast Five (2011) **0** |
| 3 | Red Sun (1971) **3** | Money Heist (2017) **0** | Money Heist (2017) **0** | Money Heist (2017) **0** |
| 4 | The 5-Man Army (1969) **3** | Kill (2024) **2** | Kill (2024) **2** | Kill (2024) **2** |
| 5 | Drop Zone (1994) **0** | Robbery (1967) **3** | Baby Driver (2017) **0** | Baby Driver (2017) **0** |
| 6 | The Cimarron Kid (1952) **2** | Baby Driver (2017) **0** | Inception (2010) **0** | Inception (2010) **0** |
| 7 | Von Ryan's Express (1965) **2** | The Getaway (1972) **0** | The Getaway (1972) **0** | The Getaway (1972) **0** |
| 8 | The First Great Train Robbery (1978) **3** | The First Great Train Robbery (1978) **3** | The Thieves (2012) **0** | The Thieves (2012) **0** |
| 9 | Butch and Sundance: The Early Days (1979) **2** | The Thieves (2012) **0** | Reservoir Dogs (1992) **0** | Reservoir Dogs (1992) **0** |
| 10 | Takers (2010) **0** | Reservoir Dogs (1992) **0** | Ambulance (2022) **0** | Ambulance (2022) **0** |

### new-08 like Breaking Bad but a comedy

Intent: Crime series about an ordinary person drifting into crime, played for laughs. Pure dramas like Breaking Bad itself are weak.

| rank | prod | r3-combo | r3-combo-fast | sparse-fast |
|---|---|---|---|---|
| 1 | The Wrong Mans (2013) **3** | Breaking Bad (2008) **0** | Breaking Bad (2008) **0** | Breaking Bad (2008) **0** |
| 2 | How to Sell Drugs Online (Fast) (2019) **3** | The Wrong Mans (2013) **3** | The Gentlemen (2024) **2** | The Gentlemen (2024) **2** |
| 3 | Minder (1979) **2** | The Gentlemen (2024) **2** | The Wrong Mans (2013) **3** | The Wrong Mans (2013) **3** |
| 4 | A Touch of Cloth (2012) **0** | Sherlock (2010) **0** | Sherlock (2010) **0** | Sherlock (2010) **0** |
| 5 | Murder in Successville (2015) **0** | Vincenzo (2021) **1** | Vincenzo (2021) **1** | Vincenzo (2021) **1** |
| 6 | Studio 60 on the Sunset Strip (2006) **0** | Barry (2018) **2** | Barry (2018) **2** | Barry (2018) **2** |
| 7 | Chief Kim (2017) **1** | The Outlaws (2021) **2** | The Outlaws (2021) **2** | The Outlaws (2021) **2** |
| 8 | Community Squad (2023) **1** | It's Always Sunny in Philadelphia (2005) **1** | It's Always Sunny in Philadelphia (2005) **1** | It's Always Sunny in Philadelphia (2005) **1** |
| 9 | Comedy Premium League (2021) **0** | Série Noire (2014) **2** | The Afterparty (2022) **1** | The Afterparty (2022) **1** |
| 10 | High Desert (2023) **1** | The Ms. Pat Show (2021) **0** | Série Noire (2014) **2** | Série Noire (2014) **2** |

## Grade-0 titles in the top 5

| ranker | query | rank | title |
|---|---|---|---|
| prod | lab-05 grief after losing a child | 5 | Crash (2018) |
| prod | lab-08 melancholy lighthouse keeper mystery | 5 | The Returned (2012) |
| prod | core-10 dark comedy about rich people | 1 | Wonder Showzen (2005) |
| prod | core-10 dark comedy about rich people | 3 | Hunderby (2012) |
| prod | core-10 dark comedy about rich people | 5 | Heathers (2018) |
| prod | core-12 with my parents | 1 | The Trip Back to Hometown with My Parents (2016) |
| prod | core-12 with my parents | 2 | In My Shoes: Stories of Youth with LGBT Parents (2005) |
| prod | core-12 with my parents | 3 | Hausu 2020: Locked Down with My Friends in My Parents’ Empty House During the First Wave of COVID-19 (2021) |
| prod | core-14 Rich people being absolutely awful to each ot | 2 | The Snake (2006) |
| prod | core-14 Rich people being absolutely awful to each ot | 3 | Miami Bici (2020) |
| prod | core-14 Rich people being absolutely awful to each ot | 4 | Cartouche (1962) |
| prod | core-16 Something where halfway through you realise t | 2 | American Sports Story (2024) |
| prod | core-16 Something where halfway through you realise t | 4 | Prizzi's Honor (1985) |
| prod | core-16 Something where halfway through you realise t | 5 | Living with the Dead (2002) |
| prod | core-20 bleak | 5 | Bleak: Who (2022) |
| prod | core-28 Des gens riches qui se comportent horriblemen | 3 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| prod | core-28 Des gens riches qui se comportent horriblemen | 4 | Da Ali G Show (2000) |
| prod | new-01 heist on a train | 5 | Drop Zone (1994) |
| prod | new-08 like Breaking Bad but a comedy | 4 | A Touch of Cloth (2012) |
| prod | new-08 like Breaking Bad but a comedy | 5 | Murder in Successville (2015) |
| prod | new-10 90s crime movies with great dialogue | 2 | King of Thieves (2018) |
| prod | new-10 90s crime movies with great dialogue | 3 | Finding Steve McQueen (2019) |
| prod | new-10 90s crime movies with great dialogue | 4 | Cop's Honor (1985) |
| prod | new-12 war movie that isn't about World War II | 1 | Fantasy Mission Force (1983) |
| prod | new-12 war movie that isn't about World War II | 2 | The Dirty Dozen: The Deadly Mission (1987) |
| prod | new-12 war movie that isn't about World War II | 3 | The Battle of the Rails (1946) |
| prod | new-12 war movie that isn't about World War II | 4 | The Guns of Navarone (1961) |
| prod | new-12 war movie that isn't about World War II | 5 | Commandos (1968) |
| prod | new-16 whole movie takes place in one room | 2 | Sidewalls (2011) |
| prod | new-16 whole movie takes place in one room | 3 | Eve's Christmas (2004) |
| prod | new-16 whole movie takes place in one room | 4 | Royally Wrapped For Christmas (2021) |
| prod | new-16 whole movie takes place in one room | 5 | Sammohanam (2018) |
| prod | new-18 wholesome | 1 | Wholesome (2026) |
| prod | new-18 wholesome | 2 | Caseworker's Diary: Constitutional Rights, The Minimum Standard of Wholesome and Cultured Living (2018) |
| prod | new-20 An ordinary guy slowly realises his whole lif | 1 | Get the Girl (2017) |
| prod | new-20 An ordinary guy slowly realises his whole lif | 4 | The Dead Zone (1983) |
| prod | new-20 An ordinary guy slowly realises his whole lif | 5 | The Innocents (2020) |
| prod | new-22 Antikriegsfilm, der zeigt, wie sinnlos Krieg  | 1 | Mea Maxima Culpa: Silence in the House of God (2012) |
| prod | new-22 Antikriegsfilm, der zeigt, wie sinnlos Krieg  | 2 | Nineteen Eighty-Four (1984) |
| prod | new-23 psycological thriler with a big twist | 3 | Deadstream (2022) |
| r3-combo | core-14 Rich people being absolutely awful to each ot | 2 | It's Always Sunny in Philadelphia (2005) |
| r3-combo | core-14 Rich people being absolutely awful to each ot | 4 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r3-combo | core-20 bleak | 1 | Bleak: Who (2022) |
| r3-combo | core-20 bleak | 2 | Bleak - An action Short (2023) |
| r3-combo | core-28 Des gens riches qui se comportent horriblemen | 1 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r3-combo | new-01 heist on a train | 1 | Money Heist (2017) |
| r3-combo | new-01 heist on a train | 2 | Fast Five (2011) |
| r3-combo | new-01 heist on a train | 3 | Money Heist (2017) |
| r3-combo | new-08 like Breaking Bad but a comedy | 1 | Breaking Bad (2008) |
| r3-combo | new-08 like Breaking Bad but a comedy | 4 | Sherlock (2010) |
| r3-combo | new-12 war movie that isn't about World War II | 1 | Saving Private Ryan (1998) |
| r3-combo | new-12 war movie that isn't about World War II | 3 | Fires on the Plain (1959) |
| r3-combo | new-12 war movie that isn't about World War II | 5 | Come and See (1985) |
| r3-combo | new-18 wholesome | 1 | Wholesome (2026) |
| r3-combo | new-20 An ordinary guy slowly realises his whole lif | 2 | Fight Club (1999) |
| r3-combo-fast | core-14 Rich people being absolutely awful to each ot | 3 | It's Always Sunny in Philadelphia (2005) |
| r3-combo-fast | core-14 Rich people being absolutely awful to each ot | 5 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r3-combo-fast | core-20 bleak | 1 | Bleak: Who (2022) |
| r3-combo-fast | core-20 bleak | 2 | Bleak - An action Short (2023) |
| r3-combo-fast | core-28 Des gens riches qui se comportent horriblemen | 1 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r3-combo-fast | new-01 heist on a train | 1 | Money Heist (2017) |
| r3-combo-fast | new-01 heist on a train | 2 | Fast Five (2011) |
| r3-combo-fast | new-01 heist on a train | 3 | Money Heist (2017) |
| r3-combo-fast | new-01 heist on a train | 5 | Baby Driver (2017) |
| r3-combo-fast | new-08 like Breaking Bad but a comedy | 1 | Breaking Bad (2008) |
| r3-combo-fast | new-08 like Breaking Bad but a comedy | 4 | Sherlock (2010) |
| r3-combo-fast | new-12 war movie that isn't about World War II | 1 | Saving Private Ryan (1998) |
| r3-combo-fast | new-12 war movie that isn't about World War II | 3 | Fires on the Plain (1959) |
| r3-combo-fast | new-12 war movie that isn't about World War II | 5 | Come and See (1985) |
| r3-combo-fast | new-16 whole movie takes place in one room | 5 | Knives Out (2019) |
| r3-combo-fast | new-18 wholesome | 1 | Wholesome (2026) |
| r3-combo-fast | new-20 An ordinary guy slowly realises his whole lif | 1 | Fight Club (1999) |
| sparse-fast | core-14 Rich people being absolutely awful to each ot | 3 | It's Always Sunny in Philadelphia (2005) |
| sparse-fast | core-14 Rich people being absolutely awful to each ot | 5 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| sparse-fast | core-20 bleak | 1 | Bleak: Who (2022) |
| sparse-fast | core-20 bleak | 2 | Bleak - An action Short (2023) |
| sparse-fast | core-28 Des gens riches qui se comportent horriblemen | 2 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| sparse-fast | new-01 heist on a train | 1 | Money Heist (2017) |
| sparse-fast | new-01 heist on a train | 2 | Fast Five (2011) |
| sparse-fast | new-01 heist on a train | 3 | Money Heist (2017) |
| sparse-fast | new-01 heist on a train | 5 | Baby Driver (2017) |
| sparse-fast | new-08 like Breaking Bad but a comedy | 1 | Breaking Bad (2008) |
| sparse-fast | new-08 like Breaking Bad but a comedy | 4 | Sherlock (2010) |
| sparse-fast | new-12 war movie that isn't about World War II | 1 | Saving Private Ryan (1998) |
| sparse-fast | new-12 war movie that isn't about World War II | 3 | Fires on the Plain (1959) |
| sparse-fast | new-12 war movie that isn't about World War II | 5 | Come and See (1985) |
| sparse-fast | new-16 whole movie takes place in one room | 5 | Knives Out (2019) |
| sparse-fast | new-18 wholesome | 1 | Wholesome (2026) |
| sparse-fast | new-20 An ordinary guy slowly realises his whole lif | 1 | Fight Club (1999) |
| sparse-fast | new-20 An ordinary guy slowly realises his whole lif | 5 | American Beauty (1999) |
| sparse-fast | new-22 Antikriegsfilm, der zeigt, wie sinnlos Krieg  | 4 | American History X (1998) |
| r2-combo-bgeb-strict | lab-08 melancholy lighthouse keeper mystery | 4 | The Haunting of Hill House (2018) |
| r2-combo-bgeb-strict | core-14 Rich people being absolutely awful to each ot | 2 | Cartouche (1962) |
| r2-combo-bgeb-strict | core-14 Rich people being absolutely awful to each ot | 3 | It's Always Sunny in Philadelphia (2005) |
| r2-combo-bgeb-strict | core-20 bleak | 1 | Bleak: Who (2022) |
| r2-combo-bgeb-strict | core-20 bleak | 2 | Bleak - An action Short (2023) |
| r2-combo-bgeb-strict | core-28 Des gens riches qui se comportent horriblemen | 2 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r2-combo-bgeb-strict | new-01 heist on a train | 3 | Money Heist (2017) |
| r2-combo-bgeb-strict | new-01 heist on a train | 4 | Money Heist (2017) |
| r2-combo-bgeb-strict | new-01 heist on a train | 5 | Fast Five (2011) |
| r2-combo-bgeb-strict | new-08 like Breaking Bad but a comedy | 3 | Breaking Bad (2008) |
| r2-combo-bgeb-strict | new-08 like Breaking Bad but a comedy | 4 | Sherlock (2010) |
| r2-combo-bgeb-strict | new-12 war movie that isn't about World War II | 1 | The Dirty Dozen: The Deadly Mission (1987) |
| r2-combo-bgeb-strict | new-12 war movie that isn't about World War II | 2 | The Guns of Navarone (1961) |
| r2-combo-bgeb-strict | new-12 war movie that isn't about World War II | 3 | Fantasy Mission Force (1983) |
| r2-combo-bgeb-strict | new-12 war movie that isn't about World War II | 4 | Saving Private Ryan (1998) |
| r2-combo-bgeb-strict | new-12 war movie that isn't about World War II | 5 | Commandos (1968) |
| r2-combo-bgeb-strict | new-16 whole movie takes place in one room | 3 | Secret Beyond the Door (1947) |
| r2-combo-bgeb-strict | new-18 wholesome | 1 | Wholesome (2026) |
| r2-combo-bgeb-strict | new-20 An ordinary guy slowly realises his whole lif | 4 | Fight Club (1999) |
| r2-combo-bgeb-strict | new-22 Antikriegsfilm, der zeigt, wie sinnlos Krieg  | 3 | American History X (1998) |
