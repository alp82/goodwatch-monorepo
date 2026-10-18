# TMDB popularity lift backtest

Generated 2026-10-18T13:54:45.451458+00:00.

Lift = value / max(prior 28-day mean, 1); value ≥ 5, increase ≥ 2.5. All 29 calendar days required; missing values are unknown, never zero. Export filename dates are used without shifting; the underlying popularity activity window is not documented.

Overlap@k is |TMDB top k ∩ Wikipedia top k| / k (fixed denominator even for short lists). Spearman re-ranks only the intersection of the two top 20 lists; fewer than two matches gives N/A. This conditional correlation is not agreement over the entire catalog. Candidate retention is retrospective and may introduce selection bias; floors are exploratory, not tuned. The TMDB list covers retained exports, including titles outside the catalog; Wikipedia has its own candidate cohort.

| Day | Complete baselines | Eligible | Wiki top20 with baseline | Overlap@8 | Overlap@20 | Shared20 | Spearman |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09-12 | 16504 | 1876 | 20/20 | 0.250 | 0.150 | 3 | 1.000 |
| 2026-09-13 | 16376 | 3369 | 20/20 | 0.125 | 0.150 | 3 | 0.500 |
| 2026-09-14 | 16303 | 3647 | 20/20 | 0.250 | 0.100 | 2 | 1.000 |
| 2026-09-15 | 16331 | 3983 | 20/20 | 0.125 | 0.100 | 2 | 1.000 |
| 2026-09-16 | 16284 | 3282 | 20/20 | 0.000 | 0.000 | 0 | N/A |
| 2026-09-17 | 16426 | 1613 | 20/20 | 0.125 | 0.150 | 3 | 1.000 |
| 2026-09-18 | 16627 | 2422 | 20/20 | 0.375 | 0.200 | 4 | 0.400 |
| 2026-09-19 | 16808 | 4826 | 20/20 | 0.500 | 0.300 | 6 | 1.000 |
| 2026-09-20 | 16562 | 8305 | 20/20 | 0.250 | 0.200 | 4 | 0.400 |
| 2026-09-21 | 16539 | 8020 | 20/20 | 0.375 | 0.300 | 6 | 0.771 |
| 2026-09-22 | 16410 | 8473 | 20/20 | 0.375 | 0.300 | 6 | 0.600 |
| 2026-09-23 | 16554 | 6627 | 20/20 | 0.125 | 0.200 | 4 | 0.800 |
| 2026-09-24 | 16588 | 7186 | 20/20 | 0.125 | 0.250 | 5 | 0.900 |
| 2026-09-25 | 16593 | 6804 | 20/20 | 0.250 | 0.300 | 6 | 0.486 |
| 2026-09-26 | 16569 | 6933 | 20/20 | 0.250 | 0.400 | 8 | 0.381 |
| 2026-09-27 | 16545 | 6634 | 20/20 | 0.375 | 0.300 | 6 | 0.886 |
| 2026-09-28 | 16597 | 5729 | 20/20 | 0.125 | 0.200 | 4 | 0.800 |
| 2026-09-29 | 16593 | 6917 | 20/20 | 0.125 | 0.150 | 3 | 1.000 |
| 2026-09-30 | 16688 | 7602 | 20/20 | 0.250 | 0.100 | 2 | -1.000 |
| 2026-10-01 | 16717 | 5947 | 20/20 | 0.125 | 0.150 | 3 | -0.500 |
| 2026-10-02 | 16754 | 5406 | 20/20 | 0.125 | 0.150 | 3 | 1.000 |
| 2026-10-03 | 16760 | 4909 | 20/20 | 0.125 | 0.150 | 3 | 0.500 |
| 2026-10-04 | 16744 | 5285 | 20/20 | 0.125 | 0.150 | 3 | 0.500 |
| 2026-10-05 | 16754 | 5887 | 20/20 | 0.000 | 0.100 | 2 | -1.000 |
| 2026-10-06 | 16718 | 4570 | 20/20 | 0.000 | 0.150 | 3 | 1.000 |
| 2026-10-07 | 16712 | 4546 | 20/20 | 0.000 | 0.050 | 1 | N/A |
| 2026-10-08 | 16699 | 6034 | 20/20 | 0.125 | 0.150 | 3 | 1.000 |
| 2026-10-09 | 16744 | 4972 | 20/20 | 0.250 | 0.200 | 4 | 0.800 |
| 2026-10-10 | 16862 | 4930 | 20/20 | 0.625 | 0.350 | 7 | 0.214 |
| 2026-10-11 | 17072 | 4181 | 20/20 | 0.250 | 0.350 | 7 | -0.071 |
| 2026-10-12 | 17414 | 3024 | 20/20 | 0.250 | 0.450 | 9 | -0.317 |
| 2026-10-13 | 17626 | 2444 | 20/20 | 0.125 | 0.400 | 8 | 0.143 |
| 2026-10-14 | 17783 | 3817 | 20/20 | 0.000 | 0.150 | 3 | -1.000 |
| 2026-10-15 | 18045 | 7265 | 20/20 | 0.250 | 0.250 | 5 | 0.600 |

34 days: mean overlap@8 **0.199**, mean overlap@20 **0.207**. Mean conditional Spearman **0.462** across 32 days with at least two common titles. Wikipedia winner baseline coverage: 680/680 title-days.

These are agreement diagnostics, not a quality label: Wikipedia reading and TMDB popularity measure different behavior. This backtest does not establish that a blended ranking is better.
