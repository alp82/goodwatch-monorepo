# Round 6 metrics: style neighbours and alternate cuts

Candidate `r6` = `r5` with a new style path (`harness/rankers6.py`) and alternate cuts folded (`harness/cuts.py`),
frozen in `LOG.md` ("Round 6") before holdout4 was read. Baselines: `r4-combo-fast` (the accepted winner) and `r5`.
Round-6 metrics (contract note): a 2nd+ alternate cut in the top 10 counts as grade 0 (`metrics.graded_query6`);
`own10` = the entity's own titles in the top 10 (`metrics.own10`), mean over `person_intent: style` queries.

Grading: re-grade of 290 dev / holdout3 style pairs (kappa 0.901, 1 pair via blind C), 154 new dev-side pairs
(p1 kappa 0.825, p2 kappa 0.609 on 19 pairs, 1 via C), 329 holdout4 pairs (kappa 0.878, 4 pairs via blind C:
Wild Zero 2, Koala Man 1, Death of a Unicorn 1, Ju-on: The Beginning of the End 2). Full top 10s:
`holdout4/metrics-tables.md` and `metrics-dev.md`.

Latency: r6 holdout4 median 34 ms offline (style path), r5 about 21 ms; estimated +5-10 ms p50 on style queries only,
whole-search p95 ~0.55 s unchanged. No added cost.

## holdout4

Frozen r6 (LOG.md, Round 6). Unjudged titles in the top 10 of the four lists: 0.

| ranker | holdout4 ndcg10 | bad5 (holdout4) | own10 style (holdout4) |
|---|---|---|---|
| prod | 0.379 | 20 | 2.56 |
| r4-combo-fast | 0.704 | 1 | 4.67 |
| r5 | 0.709 | 2 | 3.78 |
| r6 | 0.837 | 2 | 6.00 |

## Contract criteria (round-6 note)

- ndcg10 r6 − r4-combo-fast +0.132, r6 − r5 +0.127 (both need >= +0.05): pass
- bad5 r6 2 vs r4-combo-fast 1, r5 2 (not higher than either): FAIL
- mean own10 of r6 on the 9 style queries 6.00 (3 to 6): pass
- earlier splits, r6 − r5 (no drop over 0.01): dev +0.013, holdout +0.000, holdout2 +0.001, holdout3 +0.105: pass
- verdict: **r6 does not win**

## Per query

| query | entity (match) | person_intent / detected | prod | r4-combo-fast | r5 | r6 | own10 r5 / r6 | Δ r6 − r5 |
|---|---|---|---|---|---|---|---|---|
| sty-01 feels like a terry gilliam film | Terry Gilliam (full) | style / style | 0.455 | 0.899 | 0.844 | 0.870 | 3 / 6 | +0.026 |
| sty-02 charlie kaufman-esque | Charlie Kaufman (full) | style / style | 0.301 | 0.707 | 0.830 | 0.953 | 4 / 6 | +0.122 |
| sty-03 nicolas cage energy | Nicolas Cage (full) | style / style | 0.339 | 0.632 | 0.632 | 0.785 | 3 / 6 | +0.153 |
| sty-04 in the vein of mel brooks | Mel Brooks (full) | style / style | 0.906 | 0.836 | 0.717 | 0.803 | 4 / 6 | +0.087 |
| sty-05 aardman humor | Aardman (alias) | style / style | 0.104 | 0.408 | 0.685 | 0.924 | 4 / 6 | +0.239 |
| sty-06 fincher vibes but a series | David Fincher (surname) | style / style | 0.686 | 0.624 | 0.605 | 0.730 | 0 / 3 | +0.125 |
| sty-07 cartoons with matt groening humor | Matt Groening (full) | both / style | 0.234 | 0.627 | 0.599 | 0.542 | 1 / 3 | -0.057 |
| sty-08 un film à la jean-pierre jeunet | Jean-Pierre Jeunet (full) | style / style | 0.085 | 0.492 | 0.687 | 0.957 | 2 / 5 | +0.270 |
| sty-09 something darren aronofsky would direct | Darren Aronofsky (full) | style / filmography | 0.140 | 0.806 | 0.914 | 0.914 | 10 / 10 | +0.000 |
| sty-10 danny boyle movies and stuff like them | Danny Boyle (full) | both / style | 0.061 | 0.880 | 0.511 | 0.806 | 3 / 6 | +0.295 |
| sty-11 jackie chan style stunts and slapstick | Jackie Chan (full) | style / style | 0.852 | 1.000 | 0.884 | 0.862 | 4 / 6 | -0.022 |
| sty-12 blumhouse-type horror | Blumhouse Productions (alias) | both / style | 0.383 | 0.543 | 0.600 | 0.892 | 3 / 6 | +0.291 |

Grade-0 titles in the top 5 (incl. 2nd cuts): prod sty-01 The Honeymoon Machine (#4); prod sty-02 How TV Ruined Your Life (#5); prod sty-03 History of Swear Words (#2); prod sty-03 RuPaul's Drag Race UK vs The World (#3); prod sty-03 Madonna: Rebel Heart Tour (#4); prod sty-05 The Wonderful World of Mickey Mouse (#1); prod sty-05 SpongeBob SquarePants (#3); prod sty-05 Animaniacs (#4); prod sty-05 Uncle Grandpa (#5); prod sty-07 The Bugs Bunny Show (#2); prod sty-08 Goodbye to Language (#1); prod sty-08 Nouvelle Vague (#3); prod sty-09 Pompo the Cinephile (#1); prod sty-09 The Last: Naruto the Movie (#2); prod sty-09 Secret Girlfriend (#3); prod sty-10 Devil's Double Next Level (#2); prod sty-10 Monster Brawl (#3); prod sty-10 Stepsister from Planet Weird (#4); prod sty-10 Forbidden World (#5); prod sty-12 Swamp Thing (#3); r4-combo-fast sty-05 Animaniacs (#3); r5 sty-07 Phineas and Ferb (#3); r5 sty-07 We Bare Bears (#4); r6 sty-06 Love, Death & Robots (#3); r6 sty-06 Voir (#5)


## dev and regression splits

Round-6 metrics: a 2nd+ alternate cut in the top 10 counts as grade 0; own10 = the entity's own titles in the top 10 (style queries).

| ranker | dev-style ndcg10 | ho3-style ndcg10 | dev ndcg10 | holdout ndcg10 | holdout2 ndcg10 | holdout3 ndcg10 | bad5 (dev-style) | own10 style (dev-style) |
|---|---|---|---|---|---|---|---|---|
| prod | 0.293 | 0.473 | 0.501 | 0.450 | 0.514 | 0.392 | 12 | 3.00 |
| r4-combo-fast | 0.714 | 0.789 | 0.767 | 0.761 | 0.716 | 0.720 | 5 | 7.50 |
| r5 | 0.709 | 0.675 | 0.823 | 0.761 | 0.727 | 0.788 | 5 | 3.50 |
| r6 | 0.812 | 0.884 | 0.836 | 0.761 | 0.728 | 0.893 | 4 | 6.00 |

## Per query: style and both queries

| query | split | intent | prod | r4-combo-fast | r5 | r6 | own10 r5 / r6 | Δ r6 − r5 |
|---|---|---|---|---|---|---|---|---|
| ppl-09 tarantino vibes | dev | style | 0.535 | 0.785 | 0.656 | 0.964 | 2 / 6 | +0.308 |
| ppl-11 like david lynch but less weird | dev | style | 0.000 | 0.308 | 0.346 | 0.316 | 4 / 6 | -0.030 |
| ppl-13 denis villeneuve atmosphere | dev | style | 0.394 | 0.789 | 0.945 | 1.000 | 4 / 6 | +0.055 |
| ppl-15 miyazaki-like | dev | style | 0.395 | 1.000 | 0.775 | 1.000 | 4 / 6 | +0.225 |
| ppl-17 vince gilligan | dev | both | 0.113 | 0.563 | 0.718 | 0.692 | 6 / 6 | -0.026 |
| ppl-20 edgar wright | dev | both | 0.318 | 0.838 | 0.814 | 0.898 | 6 / 6 | +0.084 |
| ppl-10 wes anderson style | holdout3 | style | 0.937 | 0.960 | 0.679 | 0.807 | 4 / 6 | +0.128 |
| ppl-12 something in the style of guy ritchie | holdout3 | style | 0.463 | 0.758 | 0.475 | 0.908 | 4 / 6 | +0.432 |
| ppl-14 coen brothers humor | holdout3 | style | 0.750 | 0.872 | 0.597 | 0.687 | 4 / 6 | +0.090 |
| ppl-16 kubrick-esque | holdout3 | style | 0.226 | 0.530 | 0.417 | 0.903 | 3 / 6 | +0.486 |
| ppl-18 christopher nolan | holdout3 | both | 0.000 | 0.694 | 0.879 | 1.000 | 6 / 6 | +0.121 |
| ppl-24 hbo prestige drama | holdout3 | both | 0.461 | 0.920 | 1.000 | 1.000 | 10 / 10 | +0.000 |
| lab-01 tarkovsky | dev | both (no field) | 0.344 | 0.584 | 0.664 | 0.664 | None / None | +0.000 |
| ho2-15 terry gilliam | holdout2 | both (no field) | 0.291 | 0.629 | 0.821 | 0.780 | None / None | -0.041 |

Queries whose ndcg10 moves r6 vs r5: ppl-09 +0.308, ppl-11 -0.030, ppl-13 +0.055, ppl-15 +0.225, ppl-17 -0.026, ppl-20 +0.084, ho2-03 +0.066, ho2-15 -0.041, ppl-10 +0.128, ppl-12 +0.432, ppl-14 +0.090, ppl-16 +0.486, ppl-18 +0.121

