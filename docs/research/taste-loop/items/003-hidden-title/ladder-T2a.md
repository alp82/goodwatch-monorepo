# The T2a ladder, tier A: the hidden-title test

Built by `lab/table.py T2a` from the `ladder` lines of `ledger.jsonl`. Pack 2026-10-13 (`ac1341f55c9b`), harness `7f9e841a7c28`, 10,000 bootstrap draws, seed 20261013. Every row below carries this pack hash, harness hash and views digest (`09753a802794`). Other members' rows: all.

What T2a measures (PROTOCOL.md, section 4a). A view hides a fold of a member's rated titles and treats them as unwatched. The scorer ranks them together with every title the member has not rated (about 60,681 candidates per view), from the member's other ratings. Each hidden title is then placed, alone, among those unrated candidates. Percentile: the share of candidates ranked below it; 1.0 is the top of the list and 0.5 is what a scorer with no order gives. "In the first 50": fewer than 50 candidates rank above it.

Separation is the primary measure: the mean percentile of the titles a member rated 8 or more minus that of the titles the member rated 5 or less. A band counts for a member with 5 or more titles in it; the separation needs both bands. "Among equally well-rated" is the same percentile, counted only against candidates whose GoodWatch score lies within 3 points of the hidden title's.

A difference is the rung minus the reference, per member, then averaged. Intervals are 95%, from drawing members again. "Smallest detectable" is the difference this data would find four times out of five. The test only sees titles the member chose to watch: it says where a known favourite lands, not whether the unrated titles above it are any good.

## Members other than the owner: where the hidden titles land

61 members, 4,788 hidden titles in 384 views: 2,530 rated 8 or more, 1,285 rated 6 to 7, 973 rated 5 or less. 74 more rated titles lie outside the candidate universe; they are history in every view and never hidden. Members with 5 or more titles in the band: 61 (8 or more), 49 (6 to 7), 26 (5 or less). **26 members count for the separation.** Each member counts once.

| Rung | Scorer | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Run |
|---|---|---:|---:|---:|---:|---|
| B1 | GoodWatch score | 0.874 (0.855 to 0.890) | 0.832 (0.800 to 0.860) | 0.796 (0.740 to 0.844) | 0.086 (0.039 to 0.138) | `20261014T021624-7d38ea9d-c613` |
| B2 | Today's taste | 0.697 (0.672 to 0.722) | 0.637 (0.599 to 0.675) | 0.556 (0.511 to 0.601) | 0.134 (0.076 to 0.192) | `20261014T021401-0a3aacc3-6bdc` |
| B3 | Taste on standardized fingerprints | 0.890 (0.867 to 0.911) | 0.833 (0.793 to 0.868) | 0.765 (0.712 to 0.812) | 0.131 (0.079 to 0.187) | `20261014T021917-df4894a6-141a` |
| B4 | Consensus with offset and slope per member | 0.666 (0.636 to 0.693) | 0.579 (0.543 to 0.614) | 0.515 (0.453 to 0.581) | 0.140 (0.074 to 0.201) | `20261014T022212-566d1e29-d7fc` |
| B5 | Pooled predictor, personal weights on | 0.687 (0.660 to 0.712) | 0.570 (0.533 to 0.605) | 0.414 (0.371 to 0.462) | 0.267 (0.206 to 0.323) | `20261014T022838-d288d6bc-8a4b` |
| BP | Vote count | 0.975 (0.960 to 0.987) | 0.967 (0.944 to 0.985) | 0.959 (0.921 to 0.986) | 0.020 (0.005 to 0.040) | `20261014T021811-e0711083-bbfb` |

### Separation against B2, B1 and BP

Above zero the rung separates better than the reference.

| Rung | Against B2 (today's taste) | Smallest detectable | Members improved | Against B1 (GoodWatch score) | Against BP (vote count) |
|---|---:|---:|---:|---:|---:|
| B1 | -0.049 (-0.113 to +0.015) | 0.094 | 11 of 26 | reference | +0.065 (+0.026 to +0.108) |
| B2 | reference |  |  | +0.049 (-0.015 to +0.113) | +0.114 (+0.061 to +0.168) |
| B3 | -0.003 (-0.041 to +0.030) | 0.051 | 17 of 26 | +0.045 (-0.010 to +0.099) | +0.111 (+0.062 to +0.161) |
| B4 | +0.005 (-0.077 to +0.080) | 0.115 | 15 of 26 | +0.054 (-0.004 to +0.106) | +0.119 (+0.055 to +0.180) |
| B5 | +0.133 (+0.100 to +0.166) | 0.049 | 24 of 26 | +0.181 (+0.127 to +0.234) | +0.247 (+0.189 to +0.297) |
| BP | -0.114 (-0.168 to -0.061) | 0.079 | 4 of 26 | -0.065 (-0.108 to -0.026) | reference |

### Share of hidden titles in the first 50 and the first 200

For titles rated 8 or more a larger share is better; for titles rated 5 or less a smaller one.

| Rung | Rated 8 or more: first 50 | First 200 | Rated 5 or less: first 50 | First 200 | First 50 (8 or more) against B2 | First 200 (8 or more) against B2 |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 0.014 (0.007 to 0.022) | 0.073 (0.055 to 0.094) | 0.006 (0.000 to 0.014) | 0.023 (0.008 to 0.043) | -0.005 (-0.015 to +0.005) | +0.034 (+0.010 to +0.057) |
| B2 | 0.019 (0.011 to 0.028) | 0.039 (0.026 to 0.055) | 0.001 (0.000 to 0.003) | 0.004 (0.000 to 0.008) | reference | reference |
| B3 | 0.089 (0.069 to 0.109) | 0.185 (0.153 to 0.217) | 0.025 (0.009 to 0.044) | 0.068 (0.039 to 0.102) | +0.070 (+0.053 to +0.088) | +0.145 (+0.120 to +0.171) |
| B4 | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | -0.019 (-0.028 to -0.011) | -0.039 (-0.055 to -0.026) |
| B5 | 0.001 (0.000 to 0.004) | 0.007 (0.003 to 0.012) | 0.001 (0.000 to 0.002) | 0.002 (0.000 to 0.005) | -0.017 (-0.027 to -0.009) | -0.033 (-0.048 to -0.019) |
| BP | 0.388 (0.313 to 0.467) | 0.594 (0.522 to 0.665) | 0.264 (0.154 to 0.392) | 0.469 (0.364 to 0.579) | +0.369 (+0.294 to +0.449) | +0.555 (+0.482 to +0.625) |

### Among equally well-rated titles

This removes "it is simply a well-rated title" and leaves what is personal.

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Against B2 | Smallest detectable | Against B1 | Against BP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.608 (0.599 to 0.617) | 0.581 (0.569 to 0.593) | 0.571 (0.553 to 0.589) | 0.043 (0.023 to 0.062) | -0.089 (-0.146 to -0.032) | 0.084 | reference | +0.029 (+0.006 to +0.053) |
| B2 | 0.691 (0.663 to 0.717) | 0.634 (0.594 to 0.674) | 0.549 (0.505 to 0.592) | 0.131 (0.074 to 0.188) | reference |  | +0.089 (+0.032 to +0.146) | +0.118 (+0.064 to +0.172) |
| B3 | 0.836 (0.811 to 0.858) | 0.772 (0.730 to 0.811) | 0.697 (0.642 to 0.746) | 0.139 (0.083 to 0.198) | +0.007 (-0.024 to +0.036) | 0.044 | +0.096 (+0.042 to +0.150) | +0.125 (+0.071 to +0.182) |
| B4 | 0.378 (0.354 to 0.404) | 0.300 (0.265 to 0.340) | 0.290 (0.234 to 0.353) | 0.109 (0.060 to 0.155) | -0.023 (-0.099 to +0.050) | 0.109 | +0.066 (+0.024 to +0.105) | +0.095 (+0.040 to +0.148) |
| B5 | 0.473 (0.441 to 0.506) | 0.361 (0.321 to 0.403) | 0.276 (0.229 to 0.328) | 0.220 (0.163 to 0.268) | +0.088 (+0.053 to +0.123) | 0.051 | +0.177 (+0.119 to +0.229) | +0.206 (+0.151 to +0.254) |
| BP | 0.964 (0.948 to 0.978) | 0.959 (0.937 to 0.977) | 0.954 (0.919 to 0.979) | 0.013 (0.001 to 0.028) | -0.118 (-0.172 to -0.064) | 0.079 | -0.029 (-0.053 to -0.006) | reference |

### Guards: the first 50 candidates

The 50 unrated candidates a rung ranks highest in a view, averaged over a member's views, then over the 61 members. The members' own rated titles are 39% shows and 13% animation (production method "Animation"). "Against own mix" is the share in the first 50 minus the member's own share. A franchise is a movie series of the pack; every other title is its own.

| Rung | Shows | Shows against own mix | Animation | Animation against own mix | Most titles from one franchise | Median vote count |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 0.714 | +0.328 (+0.262 to +0.393) | 0.251 | +0.117 (+0.078 to +0.150) | 1.0 | 12,900 |
| B2 | 0.220 | -0.165 (-0.225 to -0.107) | 0.201 | +0.067 (+0.018 to +0.116) | 1.5 | 7,181 |
| B3 | 0.445 | +0.059 (+0.005 to +0.110) | 0.348 | +0.213 (+0.155 to +0.268) | 2.0 | 142,136 |
| B4 | 0.022 | -0.364 (-0.431 to -0.299) | 0.078 | -0.057 (-0.095 to -0.025) | 2.7 | 3,599 |
| B5 | 0.083 | -0.302 (-0.373 to -0.234) | 0.169 | +0.034 (-0.026 to +0.094) | 2.3 | 6,830 |
| BP | 0.045 | -0.341 (-0.411 to -0.273) | 0.051 | -0.083 (-0.125 to -0.048) | 3.4 | 1,620,179 |

| Rung | Shows against B2 | Animation against B2 | Most titles from one franchise against B2 | Median vote count against B2 |
|---|---:|---:|---:|---:|
| B1 | +0.493 (+0.466 to +0.519) | +0.049 (+0.000 to +0.098) | -0.465 (-0.649 to -0.300) | +5,719 (+4,786 to +6,560) |
| B3 | +0.224 (+0.189 to +0.261) | +0.146 (+0.115 to +0.178) | +0.510 (+0.355 to +0.666) | +134,954 (+105,320 to +167,093) |
| B4 | -0.198 (-0.230 to -0.165) | -0.124 (-0.172 to -0.076) | +1.250 (+0.964 to +1.528) | -3,582 (-4,511 to -2,765) |
| B5 | -0.137 (-0.170 to -0.105) | -0.033 (-0.083 to +0.018) | +0.820 (+0.552 to +1.083) | -351 (-3,311 to +4,424) |
| BP | -0.176 (-0.205 to -0.149) | -0.150 (-0.201 to -0.099) | +1.912 (+1.650 to +2.176) | +1,612,998 (+1,558,196 to +1,666,316) |

### Error of the predicted rating on the hidden titles

Only for rungs that give a score (T2a has no calibrator). Error as in T1: the average distance between the rounded prediction and the rating, per member, then averaged.

| Rung | Error | Rated 5 or less | Rated 6 to 7 | Rated 8 or more | Against B1 | Owner: error | Owner: against B1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| B1 | 1.485 (1.314 to 1.671) | 3.158 | 1.333 | 1.557 | reference | 1.010 | reference |
| B4 | 1.417 (1.238 to 1.612) | 3.223 | 1.271 | 1.511 | -0.068 (-0.111 to -0.027) | 0.892 | -0.118 |
| B5 | 1.328 (1.165 to 1.502) | 3.008 | 1.282 | 1.355 | -0.158 (-0.211 to -0.107) | 0.817 | -0.194 |

## The owner alone

One member: 992 hidden titles in 50 views (401 rated 8 or more, 497 rated 6 to 7, 94 rated 5 or less; 12 more rated titles lie outside the candidate universe), rated in 97 sittings. The numbers are plain figures. An interval over sittings is given only when there are 10 or more sittings and none holds more than a quarter of the titles; otherwise the column says why not (the separation reads only titles rated 8 or more or 5 or less, which lie in 60 of the sittings). "Franchises drawn again" is a second figure, not that interval: whole movie series are resampled together and every other title alone (817 units), with sittings ignored.

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Interval over sittings | Franchises drawn again | First 50 (8 or more) | First 200 (8 or more) | First 50 (5 or less) | First 200 (5 or less) |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| B1 | 0.793 | 0.627 | 0.412 | 0.381 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.323 to +0.438 | 0.015 | 0.035 | 0.000 | 0.000 |
| B2 | 0.553 | 0.482 | 0.332 | 0.221 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.161 to +0.278 | 0.000 | 0.005 | 0.000 | 0.000 |
| B3 | 0.838 | 0.700 | 0.463 | 0.375 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.312 to +0.436 | 0.040 | 0.120 | 0.000 | 0.011 |
| B4 | 0.665 | 0.502 | 0.312 | 0.353 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.305 to +0.403 | 0.000 | 0.000 | 0.000 | 0.000 |
| B5 | 0.696 | 0.485 | 0.244 | 0.452 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.406 to +0.497 | 0.000 | 0.000 | 0.000 | 0.000 |
| BP | 0.970 | 0.960 | 0.951 | 0.019 | n/a: the largest of 60 sittings holds 34% of the hidden titles | -0.004 to +0.048 | 0.249 | 0.451 | 0.053 | 0.234 |

| Rung | Separation against B2 | Franchises drawn again | Against B1 | Franchises drawn again | Against BP | Franchises drawn again |
|---|---:|---:|---:|---:|---:|---:|
| B1 | +0.160 | +0.093 to +0.231 | reference |  | +0.362 | +0.300 to +0.423 |
| B2 | reference |  | -0.160 | -0.231 to -0.093 | +0.202 | +0.133 to +0.266 |
| B3 | +0.154 | +0.103 to +0.207 | -0.006 | -0.062 to +0.047 | +0.355 | +0.290 to +0.421 |
| B4 | +0.132 | +0.074 to +0.193 | -0.028 | -0.078 to +0.021 | +0.334 | +0.275 to +0.392 |
| B5 | +0.231 | +0.179 to +0.285 | +0.071 | +0.033 to +0.108 | +0.432 | +0.377 to +0.486 |
| BP | -0.202 | -0.266 to -0.133 | -0.362 | -0.423 to -0.300 | reference |  |

Among equally well-rated titles:

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.569 | 0.522 | 0.487 | 0.082 | +0.070 to +0.093 | -0.101 | -0.157 to -0.041 | reference | +0.078 |
| B2 | 0.519 | 0.460 | 0.337 | 0.182 | +0.122 to +0.240 | reference |  | +0.101 | +0.178 |
| B3 | 0.775 | 0.673 | 0.505 | 0.271 | +0.206 to +0.333 | +0.089 | +0.037 to +0.140 | +0.189 | +0.267 |
| B4 | 0.467 | 0.394 | 0.320 | 0.147 | +0.092 to +0.202 | -0.035 | -0.103 to +0.035 | +0.066 | +0.143 |
| B5 | 0.454 | 0.331 | 0.209 | 0.244 | +0.195 to +0.291 | +0.062 | +0.005 to +0.120 | +0.163 | +0.240 |
| BP | 0.961 | 0.958 | 0.957 | 0.004 | -0.019 to +0.032 | -0.178 | -0.243 to -0.109 | -0.078 | reference |

Guards, the first 50 candidates. The owner's own rated titles are 14% shows and 16% animation.

| Rung | Shows | Shows against own mix | Animation | Animation against own mix | Most titles from one franchise | Median vote count |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 0.700 | +0.562 | 0.260 | +0.103 | 1.0 | 12,447 |
| B2 | 0.120 | -0.018 | 0.045 | -0.112 | 1.0 | 3,806 |
| B3 | 0.742 | +0.604 | 0.339 | +0.182 | 1.0 | 68,241 |
| B4 | 0.020 | -0.118 | 0.080 | -0.077 | 2.0 | 3,131 |
| B5 | 0.004 | -0.135 | 0.119 | -0.038 | 4.0 | 3,384 |
| BP | 0.060 | -0.078 | 0.000 | -0.157 | 3.0 | 1,017,346 |

## Runs

| Rung | Run | References | Seconds | Peak memory, MB | Predictor sha256 |
|---|---|---|---:|---:|---|
| B1 | `20261014T021624-7d38ea9d-c613` | B2 (stored), BP (stored) | 105.3 | 196.1 | `7d38ea9da5c20bf2` |
| B2 | `20261014T021401-0a3aacc3-6bdc` | B1 (stored), BP (stored) | 132.9 | 190.8 | `0a3aacc3ade1854f` |
| B3 | `20261014T021917-df4894a6-141a` | B2 (stored), B1 (stored), BP (stored) | 168.8 | 169.5 | `df4894a692d6c43c` |
| B4 | `20261014T022212-566d1e29-d7fc` | B2 (stored), B1 (stored), BP (stored) | 379.3 | 271.1 | `566d1e29bcf39744` |
| B5 | `20261014T022838-d288d6bc-8a4b` | B2 (stored), B1 (stored), BP (stored) | 522.3 | 271.1 | `d288d6bc9ddf52ec` |
| BP | `20261014T021811-e0711083-bbfb` | B2 (stored), B1 (stored) | 65.4 | 190.5 | `e0711083be2fd06f` |
