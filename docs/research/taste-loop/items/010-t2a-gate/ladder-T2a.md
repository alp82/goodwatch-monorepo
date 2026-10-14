# The T2a ladder, tier A: the hidden-title test

Built by `lab/table.py T2a` from the `ladder` lines of `ledger.jsonl`. Pack 2026-10-13 (`ac1341f55c9b`), harness `4ba1b09a4a87`, 10,000 bootstrap draws, seed 20261013. Every row below carries this pack hash, harness hash and views digest (`09753a802794`). Other members' rows: all.

What T2a measures (PROTOCOL.md, section 4a). A view hides a fold of a member's rated titles and treats them as unwatched. The scorer ranks them together with every title the member has not rated (about 60,555 candidates per view), from the member's other ratings. Each hidden title is then placed, alone, among those unrated candidates. Percentile: the share of candidates ranked below it; 1.0 is the top of the list and 0.5 is what a scorer with no order gives. "In the first 50": fewer than 50 candidates rank above it.

Separation is the primary measure: the mean percentile of the titles a member rated 8 or more minus that of the titles the member rated 5 or less. A band counts for a member with 5 or more titles in it; the separation needs both bands. "Among equally well-rated" is the same percentile, counted only against candidates whose GoodWatch score lies within 3 points of the hidden title's.

A difference is the rung minus the reference, per member, then averaged. Intervals are 95%, from drawing members again. "Smallest detectable" is the difference this data would find four times out of five. The test only sees titles the member chose to watch: it says where a known favourite lands, not whether the unrated titles above it are any good.

## Members other than the owner: where the hidden titles land

61 members, 4,788 hidden titles in 384 views: 2,530 rated 8 or more, 1,285 rated 6 to 7, 973 rated 5 or less. 74 more rated titles lie outside the candidate universe; they are history in every view and never hidden. Members with 5 or more titles in the band: 61 (8 or more), 49 (6 to 7), 26 (5 or less). **26 members count for the separation.** Each member counts once.

| Rung | Scorer | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Run |
|---|---|---:|---:|---:|---:|---|
| B1 | GoodWatch score | 0.874 (0.856 to 0.891) | 0.832 (0.801 to 0.860) | 0.797 (0.741 to 0.845) | 0.086 (0.039 to 0.138) | `20261014T070633-7d38ea9d-c41c` |
| B2 | Today's taste | 0.697 (0.672 to 0.722) | 0.637 (0.599 to 0.675) | 0.557 (0.511 to 0.601) | 0.134 (0.076 to 0.192) | `20261014T070354-0a3aacc3-7233` |
| B3 | Taste on standardized fingerprints | 0.891 (0.867 to 0.911) | 0.833 (0.794 to 0.869) | 0.765 (0.713 to 0.813) | 0.131 (0.079 to 0.187) | `20261014T070834-df4894a6-85a6` |
| B4 | Consensus with offset and slope per member | 0.666 (0.637 to 0.694) | 0.579 (0.543 to 0.614) | 0.515 (0.453 to 0.581) | 0.140 (0.074 to 0.201) | `20261014T071229-566d1e29-8714` |
| B5 | Pooled predictor, personal weights on | 0.687 (0.660 to 0.712) | 0.570 (0.533 to 0.605) | 0.414 (0.371 to 0.462) | 0.267 (0.206 to 0.323) | `20261014T072025-d288d6bc-6742` |
| BP | Vote count | 0.975 (0.960 to 0.987) | 0.968 (0.945 to 0.986) | 0.960 (0.922 to 0.986) | 0.020 (0.005 to 0.040) | `20261014T070741-e0711083-7e34` |

### Separation against B2, B1 and BP

Above zero the rung separates better than the reference.

| Rung | Against B2 (today's taste) | Smallest detectable | Members improved | Against B1 (GoodWatch score) | Against BP (vote count) |
|---|---:|---:|---:|---:|---:|
| B1 | -0.049 (-0.113 to +0.015) | 0.094 | 11 of 26 | reference | +0.065 (+0.026 to +0.108) |
| B2 | reference |  |  | +0.049 (-0.015 to +0.113) | +0.114 (+0.061 to +0.168) |
| B3 | -0.004 (-0.041 to +0.029) | 0.051 | 17 of 26 | +0.045 (-0.010 to +0.099) | +0.110 (+0.062 to +0.161) |
| B4 | +0.005 (-0.077 to +0.080) | 0.115 | 15 of 26 | +0.054 (-0.004 to +0.107) | +0.119 (+0.055 to +0.180) |
| B5 | +0.133 (+0.100 to +0.166) | 0.049 | 24 of 26 | +0.181 (+0.127 to +0.234) | +0.247 (+0.190 to +0.297) |
| BP | -0.114 (-0.168 to -0.061) | 0.079 | 4 of 26 | -0.065 (-0.108 to -0.026) | reference |

### Fold check: at most 5 hidden titles in a view

The members other than the owner with fewer than 60 ratings (40 members, 10 of them with both bands), folds of at most 5 titles instead of the folds above, which hide a fifth of such a member's titles. Both columns compare the same separation-eligible members. Above zero the rung separates better than B2.

| Rung | Separation, folds of 5 | Against B2, folds of 5 | Main figure: separation against B2 |
|---|---:|---:|---:|
| B1 | 0.014 (-0.032 to 0.058) | -0.038 (-0.165 to +0.077) | -0.042 (-0.169 to +0.071) |
| B2 | 0.052 (-0.052 to 0.175) | reference | +0.000 (+0.000 to +0.000) |
| B3 | 0.071 (-0.004 to 0.169) | +0.019 (-0.064 to +0.091) | -0.001 (-0.082 to +0.066) |
| B5 | 0.145 (0.044 to 0.251) | +0.093 (+0.006 to +0.182) | +0.112 (+0.058 to +0.175) |

### Share of hidden titles in the first 50 and the first 200

For titles rated 8 or more a larger share is better; for titles rated 5 or less a smaller one.

| Rung | Rated 8 or more: first 50 | First 200 | Rated 5 or less: first 50 (descriptive) | First 200 (descriptive) | First 50 (8 or more) against B2 | First 200 (8 or more) against B2 |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 0.015 (0.008 to 0.023) | 0.074 (0.056 to 0.095) | 0.006 (0.000 to 0.014) | 0.023 (0.008 to 0.043) | -0.004 (-0.014 to +0.006) | +0.035 (+0.011 to +0.058) |
| B2 | 0.019 (0.011 to 0.028) | 0.039 (0.026 to 0.055) | 0.001 (0.000 to 0.003) | 0.004 (0.000 to 0.008) | reference | reference |
| B3 | 0.090 (0.071 to 0.111) | 0.189 (0.157 to 0.221) | 0.025 (0.009 to 0.044) | 0.069 (0.040 to 0.103) | +0.071 (+0.054 to +0.089) | +0.149 (+0.124 to +0.175) |
| B4 | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | -0.019 (-0.028 to -0.011) | -0.039 (-0.055 to -0.026) |
| B5 | 0.001 (0.000 to 0.004) | 0.007 (0.003 to 0.012) | 0.001 (0.000 to 0.002) | 0.002 (0.000 to 0.005) | -0.017 (-0.027 to -0.009) | -0.033 (-0.048 to -0.019) |
| BP | 0.444 (0.365 to 0.525) | 0.627 (0.556 to 0.694) | 0.314 (0.203 to 0.442) | 0.512 (0.409 to 0.619) | +0.425 (+0.346 to +0.506) | +0.588 (+0.515 to +0.655) |

### Among equally well-rated titles

These adjustments reduce public quality's part without removing it: candidates whose GoodWatch score lies within 3 points of the title's.

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Against B2 | Smallest detectable | Against B1 | Against BP | Rated 8 or more against B2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.608 (0.599 to 0.617) | 0.581 (0.570 to 0.594) | 0.571 (0.554 to 0.590) | 0.043 (0.023 to 0.063) | -0.089 (-0.146 to -0.032) | 0.084 | reference | +0.029 (+0.006 to +0.052) | -0.083 (-0.113 to -0.054) |
| B2 | 0.691 (0.664 to 0.718) | 0.634 (0.594 to 0.675) | 0.550 (0.506 to 0.593) | 0.132 (0.074 to 0.188) | reference |  | +0.089 (+0.032 to +0.146) | +0.118 (+0.064 to +0.172) | reference |
| B3 | 0.837 (0.813 to 0.860) | 0.773 (0.731 to 0.813) | 0.698 (0.643 to 0.747) | 0.139 (0.083 to 0.198) | +0.007 (-0.024 to +0.036) | 0.044 | +0.096 (+0.043 to +0.150) | +0.125 (+0.070 to +0.181) | +0.146 (+0.127 to +0.165) |
| B4 | 0.377 (0.353 to 0.403) | 0.299 (0.263 to 0.339) | 0.289 (0.232 to 0.352) | 0.108 (0.059 to 0.154) | -0.024 (-0.099 to +0.049) | 0.109 | +0.065 (+0.023 to +0.104) | +0.094 (+0.039 to +0.146) | -0.314 (-0.350 to -0.278) |
| B5 | 0.472 (0.440 to 0.505) | 0.360 (0.321 to 0.402) | 0.275 (0.228 to 0.327) | 0.219 (0.163 to 0.268) | +0.088 (+0.053 to +0.122) | 0.051 | +0.176 (+0.119 to +0.229) | +0.205 (+0.150 to +0.253) | -0.219 (-0.251 to -0.188) |
| BP | 0.966 (0.950 to 0.980) | 0.961 (0.939 to 0.979) | 0.956 (0.921 to 0.981) | 0.014 (0.002 to 0.029) | -0.118 (-0.172 to -0.064) | 0.079 | -0.029 (-0.052 to -0.006) | reference | +0.275 (+0.241 to +0.308) |

### Among equally popular titles

Candidates whose vote count lies within a factor of 1.5 of the title's, either way (item 004). This reduces popularity's part without removing it (DECISIONS.md D1). Gains that survive these particular adjustments describe the retained titles only.

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Against B2 | Smallest detectable | Against B1 | Against BP | Rated 8 or more against B2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.629 (0.604 to 0.654) | 0.594 (0.561 to 0.627) | 0.572 (0.517 to 0.624) | 0.087 (0.026 to 0.149) | -0.035 (-0.116 to +0.044) | 0.118 | reference | +0.052 (-0.009 to +0.115) | +0.014 (-0.015 to +0.044) |
| B2 | 0.615 (0.585 to 0.646) | 0.571 (0.534 to 0.608) | 0.508 (0.463 to 0.552) | 0.122 (0.062 to 0.181) | reference |  | +0.035 (-0.044 to +0.116) | +0.087 (+0.023 to +0.148) | reference |
| B3 | 0.650 (0.619 to 0.681) | 0.591 (0.550 to 0.633) | 0.509 (0.460 to 0.556) | 0.162 (0.095 to 0.229) | +0.040 (+0.003 to +0.076) | 0.052 | +0.075 (-0.003 to +0.151) | +0.127 (+0.058 to +0.196) | +0.035 (+0.022 to +0.047) |
| B4 | 0.593 (0.568 to 0.620) | 0.527 (0.491 to 0.563) | 0.462 (0.405 to 0.521) | 0.146 (0.077 to 0.209) | +0.024 (-0.067 to +0.107) | 0.126 | +0.058 (+0.012 to +0.102) | +0.110 (+0.038 to +0.176) | -0.022 (-0.057 to +0.013) |
| B5 | 0.619 (0.595 to 0.644) | 0.511 (0.474 to 0.547) | 0.373 (0.332 to 0.413) | 0.248 (0.188 to 0.303) | +0.126 (+0.089 to +0.166) | 0.057 | +0.161 (+0.097 to +0.225) | +0.213 (+0.152 to +0.268) | +0.004 (-0.025 to +0.032) |
| BP | 0.718 (0.696 to 0.739) | 0.698 (0.676 to 0.722) | 0.679 (0.651 to 0.711) | 0.035 (0.019 to 0.051) | -0.087 (-0.148 to -0.023) | 0.092 | -0.052 (-0.115 to +0.009) | reference | +0.103 (+0.058 to +0.147) |

### Among titles equally well-rated and equally popular

Candidates within 3 GoodWatch points and within a factor of 2 in votes at once; a title counts only with 50 or more of them. 1,506 of the 4,788 hidden titles have fewer than 50 such candidates and are left out. Retained: high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members.

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Against B2 | Smallest detectable | Against B1 | Against BP | Rated 8 or more against B2 | Retained titles / members by band |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| B1 | 0.520 (0.514 to 0.526) | 0.511 (0.501 to 0.521) | 0.504 (0.495 to 0.514) | 0.026 (0.012 to 0.040) | -0.095 (-0.159 to -0.031) | 0.092 | reference | +0.024 (-0.002 to +0.049) | -0.083 (-0.117 to -0.049) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B2 | 0.603 (0.569 to 0.638) | 0.584 (0.541 to 0.626) | 0.502 (0.454 to 0.549) | 0.121 (0.061 to 0.180) | reference |  | +0.095 (+0.031 to +0.159) | +0.119 (+0.056 to +0.177) | reference | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B3 | 0.617 (0.582 to 0.653) | 0.574 (0.528 to 0.620) | 0.485 (0.420 to 0.548) | 0.144 (0.077 to 0.211) | +0.023 (-0.022 to +0.061) | 0.061 | +0.118 (+0.049 to +0.188) | +0.141 (+0.072 to +0.209) | +0.014 (-0.003 to +0.031) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B4 | 0.484 (0.454 to 0.514) | 0.393 (0.357 to 0.429) | 0.348 (0.296 to 0.401) | 0.121 (0.065 to 0.176) | +0.000 (-0.084 to +0.081) | 0.121 | +0.095 (+0.044 to +0.149) | +0.119 (+0.059 to +0.177) | -0.119 (-0.167 to -0.070) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B5 | 0.559 (0.525 to 0.594) | 0.438 (0.397 to 0.480) | 0.323 (0.275 to 0.371) | 0.218 (0.164 to 0.264) | +0.097 (+0.049 to +0.149) | 0.073 | +0.192 (+0.136 to +0.244) | +0.216 (+0.161 to +0.263) | -0.043 (-0.082 to -0.005) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| BP | 0.715 (0.693 to 0.738) | 0.703 (0.682 to 0.725) | 0.689 (0.665 to 0.711) | 0.002 (-0.014 to 0.019) | -0.119 (-0.177 to -0.056) | 0.088 | -0.024 (-0.049 to +0.002) | reference | +0.112 (+0.066 to +0.158) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |

### Plain, popularity-only and both separation against B2 on the same retained titles

Every column uses the same titles: retained by both with defined plain and popularity-only percentiles, and the five-title minimum in each band. The adjustments reduce popularity's part without removing it. These titles have dense matching neighborhoods; results need not generalize to excluded titles.

| Rung | Plain against B2 | Popularity-only against B2 | Both against B2 | Retained titles / members by band |
|---|---:|---:|---:|---|
| B1 | -0.048 (-0.121 to +0.021) | -0.040 (-0.120 to +0.035) | -0.095 (-0.159 to -0.031) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B2 | +0.000 (+0.000 to +0.000) | +0.000 (+0.000 to +0.000) | +0.000 (+0.000 to +0.000) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B3 | -0.002 (-0.035 to +0.028) | +0.025 (-0.016 to +0.063) | +0.023 (-0.022 to +0.061) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B4 | +0.001 (-0.083 to +0.077) | +0.013 (-0.070 to +0.090) | +0.000 (-0.084 to +0.081) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| B5 | +0.134 (+0.095 to +0.171) | +0.122 (+0.074 to +0.170) | +0.097 (+0.049 to +0.149) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |
| BP | -0.105 (-0.153 to -0.056) | -0.113 (-0.175 to -0.047) | -0.119 (-0.177 to -0.056) | high: 1,534 titles / 55 members; mid: 963 titles / 41 members; low: 785 titles / 21 members; separation: 20 members |

Supplemental ladder run `20261014T122652-df4894a6-87b3`, harness `c1deebe2c205`; same pack, views, options and predictor hashes as the main rows (apart from the supplemental flag). Its raw figures are checked against them.

### A1 guards: members other than the owner

Guard 1: disliked titles among equally popular candidates (vote count within a factor of 1.5, inclusive; zero or missing votes and empty neighbourhoods excluded). At least five matched disliked hidden titles per member; paired coverage includes only members present for both rungs. Pass requires the paired 95% upper bound below +0.03; otherwise inconclusive. Guard 2: separation among equally popular candidates, at least five matched titles in each band; fails if its paired interval is below zero. Both guards compare with B2. A2 registers G1 only with separation against B2 at least +0.03 and its interval above zero, both A1 guards passed, and none of shows, animation or franchise worse than B2 with an interval excluding zero.

| Rung | Guard 1 against B2 | Paired members | Upper bound (< +0.03) | Guard 1 | Guard 2 against B2 | Paired members | Guard 2 |
|---|---:|---:|---:|---|---:|---:|---|
| B1 | +0.064 (-0.018 to +0.143) | 26 | +0.143 | inconclusive | -0.035 (-0.116 to +0.044) | 26 | pass |
| B2 | reference |  | reference | reference | reference |  | reference |
| B3 | +0.000 (-0.034 to +0.039) | 26 | +0.039 | inconclusive | +0.040 (+0.003 to +0.076) | 26 | pass |
| B4 | -0.046 (-0.122 to +0.036) | 26 | +0.036 | inconclusive | +0.024 (-0.067 to +0.107) | 26 | pass |
| B5 | -0.135 (-0.176 to -0.096) | 26 | -0.096 | pass | +0.126 (+0.089 to +0.166) | 26 | pass |
| BP | +0.171 (+0.119 to +0.230) | 26 | +0.230 | inconclusive | -0.087 (-0.148 to -0.023) | 26 | fail |

### Descriptive: disliked titles among hidden titles reaching the first 50

Each member needs at least five hidden titles in the first 50, any band. The disliked share is averaged per member and compared with that same member's disliked share among all hidden titles. Only qualifying members enter both shares and their difference; this is reported, not judged.

| Rung | Qualifying members | Disliked share | Own hidden disliked share | Difference to own share |
|---|---:|---:|---:|---:|
| B1 | 5 | 0.251 (0.022 to 0.629) | 0.334 (0.201 to 0.532) | -0.084 (-0.213 to +0.119) |
| B2 | 1 | 0.000 | 0.000 | +0.000 |
| B3 | 25 | 0.076 (0.027 to 0.137) | 0.182 (0.109 to 0.267) | -0.106 (-0.156 to -0.059) |
| B4 | 0 | n/a | n/a | n/a |
| B5 | 0 | n/a | n/a | n/a |
| BP | 48 | 0.113 (0.068 to 0.166) | 0.143 (0.094 to 0.201) | -0.031 (-0.057 to -0.007) |

### Guards: the first 50 candidates

The 50 unrated candidates a rung ranks highest in a view, averaged over a member's views, then over the 61 members. The members' own rated titles are 39% shows and 13% animation (production method "Animation"). "Against own mix" is the share in the first 50 minus the member's own share. A franchise is a movie series of the pack; every other title is its own.

| Rung | Shows | Shows against own mix | Animation | Animation against own mix | Most titles from one franchise | Median vote count (descriptive) |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 0.708 | +0.322 (+0.256 to +0.386) | 0.244 | +0.110 (+0.071 to +0.143) | 1.0 | 12,367 |
| B2 | 0.216 | -0.170 (-0.229 to -0.112) | 0.202 | +0.067 (+0.017 to +0.116) | 1.5 | 7,049 |
| B3 | 0.441 | +0.055 (+0.001 to +0.107) | 0.354 | +0.220 (+0.161 to +0.275) | 2.0 | 120,513 |
| B4 | 0.022 | -0.364 (-0.431 to -0.299) | 0.078 | -0.057 (-0.095 to -0.025) | 2.7 | 3,599 |
| B5 | 0.083 | -0.303 (-0.373 to -0.235) | 0.169 | +0.034 (-0.026 to +0.093) | 2.3 | 6,829 |
| BP | 0.043 | -0.343 (-0.417 to -0.270) | 0.054 | -0.080 (-0.121 to -0.045) | 3.6 | 1,466,665 |

| Rung | Shows against B2 | Animation against B2 | Most titles from one franchise against B2 | Median vote count against B2 (descriptive) |
|---|---:|---:|---:|---:|
| B1 | +0.492 (+0.466 to +0.517) | +0.042 (-0.008 to +0.092) | -0.475 (-0.661 to -0.308) | +5,318 (+4,382 to +6,177) |
| B3 | +0.225 (+0.189 to +0.262) | +0.153 (+0.120 to +0.186) | +0.482 (+0.325 to +0.637) | +113,464 (+88,282 to +141,629) |
| B4 | -0.194 (-0.225 to -0.162) | -0.124 (-0.173 to -0.076) | +1.240 (+0.952 to +1.521) | -3,450 (-4,383 to -2,646) |
| B5 | -0.133 (-0.167 to -0.101) | -0.033 (-0.083 to +0.017) | +0.812 (+0.539 to +1.075) | -220 (-3,171 to +4,540) |
| BP | -0.174 (-0.204 to -0.146) | -0.147 (-0.200 to -0.095) | +2.099 (+1.805 to +2.394) | +1,459,615 (+1,384,491 to +1,533,873) |

### Error of the predicted rating on the hidden titles

Only for rungs that give a score (T2a has no calibrator). Error as in T1: the average distance between the rounded prediction and the rating, per member, then averaged.

| Rung | Error | Rated 5 or less | Rated 6 to 7 | Rated 8 or more | Against B1 | Owner: error | Owner: against B1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| B1 | 1.485 (1.314 to 1.671) | 3.158 | 1.333 | 1.557 | reference | 1.010 | reference |
| B4 | 1.417 (1.238 to 1.612) | 3.223 | 1.271 | 1.511 | -0.068 (-0.111 to -0.027) | 0.892 | -0.118 |
| B5 | 1.328 (1.165 to 1.502) | 3.008 | 1.282 | 1.355 | -0.158 (-0.211 to -0.107) | 0.817 | -0.194 |

## The owner alone

One member: 992 hidden titles in 50 views (401 rated 8 or more, 497 rated 6 to 7, 94 rated 5 or less; 12 more rated titles lie outside the candidate universe), rated in 97 sittings. The numbers are plain figures. An interval over sittings is given only when there are 10 or more sittings and none holds more than a quarter of the titles; otherwise the column says why not (the separation reads only titles rated 8 or more or 5 or less, which lie in 60 of the sittings). "Franchises drawn again" is a second figure, not that interval: whole movie series are resampled together and every other title alone (817 units), with sittings ignored.

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Interval over sittings | Franchises drawn again | First 50 (8 or more) | First 200 (8 or more) | First 50 (5 or less, descriptive) | First 200 (5 or less, descriptive) |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| B1 | 0.794 | 0.629 | 0.413 | 0.381 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.323 to +0.438 | 0.015 | 0.037 | 0.000 | 0.000 |
| B2 | 0.554 | 0.482 | 0.333 | 0.221 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.161 to +0.278 | 0.000 | 0.005 | 0.000 | 0.000 |
| B3 | 0.839 | 0.702 | 0.465 | 0.374 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.312 to +0.436 | 0.045 | 0.132 | 0.000 | 0.021 |
| B4 | 0.666 | 0.503 | 0.313 | 0.353 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.305 to +0.402 | 0.000 | 0.000 | 0.000 | 0.000 |
| B5 | 0.696 | 0.486 | 0.245 | 0.451 | n/a: the largest of 60 sittings holds 34% of the hidden titles | +0.406 to +0.496 | 0.000 | 0.000 | 0.000 | 0.000 |
| BP | 0.971 | 0.963 | 0.953 | 0.019 | n/a: the largest of 60 sittings holds 34% of the hidden titles | -0.005 to +0.048 | 0.339 | 0.484 | 0.117 | 0.319 |

| Rung | Separation against B2 | Franchises drawn again | Against B1 | Franchises drawn again | Against BP | Franchises drawn again |
|---|---:|---:|---:|---:|---:|---:|
| B1 | +0.160 | +0.093 to +0.231 | reference |  | +0.362 | +0.300 to +0.423 |
| B2 | reference |  | -0.160 | -0.231 to -0.093 | +0.202 | +0.133 to +0.267 |
| B3 | +0.154 | +0.103 to +0.207 | -0.006 | -0.062 to +0.047 | +0.356 | +0.290 to +0.421 |
| B4 | +0.132 | +0.074 to +0.192 | -0.028 | -0.078 to +0.021 | +0.334 | +0.275 to +0.392 |
| B5 | +0.231 | +0.179 to +0.285 | +0.071 | +0.033 to +0.108 | +0.433 | +0.377 to +0.487 |
| BP | -0.202 | -0.267 to -0.133 | -0.362 | -0.423 to -0.300 | reference |  |

Among equally well-rated titles:

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.570 | 0.522 | 0.487 | 0.082 | +0.071 to +0.094 | -0.101 | -0.157 to -0.041 | reference | +0.076 |
| B2 | 0.520 | 0.460 | 0.337 | 0.183 | +0.123 to +0.241 | reference |  | +0.101 | +0.177 |
| B3 | 0.778 | 0.675 | 0.505 | 0.273 | +0.209 to +0.336 | +0.090 | +0.038 to +0.142 | +0.191 | +0.266 |
| B4 | 0.466 | 0.393 | 0.320 | 0.146 | +0.090 to +0.201 | -0.037 | -0.105 to +0.033 | +0.064 | +0.140 |
| B5 | 0.452 | 0.330 | 0.209 | 0.243 | +0.194 to +0.290 | +0.060 | +0.003 to +0.118 | +0.161 | +0.236 |
| BP | 0.964 | 0.961 | 0.958 | 0.006 | -0.016 to +0.034 | -0.177 | -0.241 to -0.107 | -0.076 | reference |

Among equally popular titles:

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.628 | 0.488 | 0.287 | 0.340 | +0.285 to +0.393 | +0.111 | +0.038 to +0.185 | reference | +0.291 |
| B2 | 0.592 | 0.523 | 0.363 | 0.229 | +0.165 to +0.293 | reference |  | -0.111 | +0.179 |
| B3 | 0.691 | 0.543 | 0.316 | 0.375 | +0.316 to +0.431 | +0.145 | +0.096 to +0.195 | +0.034 | +0.325 |
| B4 | 0.651 | 0.533 | 0.342 | 0.308 | +0.255 to +0.363 | +0.079 | +0.012 to +0.146 | -0.032 | +0.258 |
| B5 | 0.693 | 0.511 | 0.263 | 0.430 | +0.380 to +0.477 | +0.200 | +0.141 to +0.261 | +0.089 | +0.380 |
| BP | 0.698 | 0.656 | 0.648 | 0.050 | +0.026 to +0.074 | -0.179 | -0.245 to -0.113 | -0.291 | reference |

Among titles equally well-rated and equally popular (234 hidden titles have fewer than 50 such candidates and are left out); retained: high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members:

| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP | Retained titles / members by band |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| B1 | 0.510 | 0.491 | 0.471 | 0.039 | +0.026 to +0.052 | -0.034 | -0.112 to +0.045 | reference | +0.073 | high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members |
| B2 | 0.517 | 0.491 | 0.444 | 0.073 | -0.005 to +0.150 | reference |  | +0.034 | +0.107 | high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members |
| B3 | 0.614 | 0.545 | 0.459 | 0.155 | +0.077 to +0.234 | +0.082 | +0.020 to +0.147 | +0.116 | +0.189 | high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members |
| B4 | 0.615 | 0.554 | 0.499 | 0.117 | +0.045 to +0.186 | +0.044 | -0.044 to +0.132 | +0.078 | +0.150 | high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members |
| B5 | 0.628 | 0.533 | 0.405 | 0.223 | +0.157 to +0.289 | +0.150 | +0.074 to +0.227 | +0.184 | +0.257 | high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members |
| BP | 0.685 | 0.684 | 0.719 | -0.034 | -0.060 to -0.006 | -0.107 | -0.187 to -0.026 | -0.073 | reference | high: 278 titles / 1 members; mid: 405 titles / 1 members; low: 75 titles / 1 members; separation: 1 members |

Guards, the first 50 candidates. The owner's own rated titles are 14% shows and 16% animation.

| Rung | Shows | Shows against own mix | Animation | Animation against own mix | Most titles from one franchise | Median vote count (descriptive) |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 0.680 | +0.542 | 0.220 | +0.063 | 1.0 | 9,022 |
| B2 | 0.120 | -0.018 | 0.046 | -0.112 | 1.0 | 3,754 |
| B3 | 0.735 | +0.597 | 0.371 | +0.214 | 1.2 | 36,794 |
| B4 | 0.020 | -0.118 | 0.080 | -0.077 | 2.0 | 3,131 |
| B5 | 0.004 | -0.135 | 0.119 | -0.038 | 4.0 | 3,384 |
| BP | 0.000 | -0.138 | 0.000 | -0.157 | 2.0 | 838,168 |

Descriptive precision for the owner, with the same five-hit minimum:

| Rung | Qualifies | Disliked share | Own hidden disliked share | Difference to own share |
|---|---:|---:|---:|---:|
| B1 | 1 | 0.000 | 0.095 | -0.095 |
| B2 | 0 | n/a | n/a | n/a |
| B3 | 1 | 0.000 | 0.095 | -0.095 |
| B4 | 0 | n/a | n/a | n/a |
| B5 | 0 | n/a | n/a | n/a |
| BP | 1 | 0.048 | 0.095 | -0.047 |

## Runs

| Rung | Run | References | Seconds | Peak memory, MB | Predictor sha256 |
|---|---|---|---:|---:|---|
| B1 | `20261014T070633-7d38ea9d-c41c` | B2 (stored), BP (stored) | 67.7 | 265.1 | `7d38ea9da5c20bf2` |
| B2 | `20261014T070354-0a3aacc3-7233` | B1 (stored), BP (stored) | 151.2 | 216.1 | `0a3aacc3ade1854f` |
| B3 | `20261014T070834-df4894a6-85a6` | B2 (stored), B1 (stored), BP (stored) | 227.9 | 262.5 | `df4894a692d6c43c` |
| B4 | `20261014T071229-566d1e29-8714` | B2 (stored), B1 (stored), BP (stored) | 467.0 | 271.0 | `566d1e29bcf39744` |
| B5 | `20261014T072025-d288d6bc-6742` | B2 (stored), B1 (stored), BP (stored) | 382.4 | 271.0 | `d288d6bc9ddf52ec` |
| BP | `20261014T070741-e0711083-7e34` | B2 (stored), B1 (stored) | 52.3 | 250.8 | `e0711083be2fd06f` |
