# The T1 ladder, tier A

Built by `lab/table.py T1` from the `ladder` lines of `ledger.jsonl`. Pack 2026-10-13 (`ac1341f55c9b`), harness `0fb3a78ed142`, 10,000 bootstrap draws, seed 20261013. Every row below carries this pack and harness hash and, within one `others` option, one views digest.

What T1 measures (PROTOCOL.md, "What T1 measures"): of the 4,195 targets of members other than the owner, 3,919 (93%) were typed in the same sitting as the member's last history rating and 276 in a later one. This is learning from the ratings a member has entered so far in a sitting. It says little about titles watched later.

Error is the average distance between the rounded prediction and the rating. A difference is the rung minus the reference, per member, then averaged: below zero the rung is better for error, above zero for pair accuracy. Pair accuracy is the share of a member's target pairs with different ratings, inside one block, that the rung's rank orders correctly (0.5 is no order). Intervals are 95%. "Smallest detectable" is the difference this data would find four times out of five.

B2, B3 and BP give no score; the harness calibrates one from the member's history, and below 40 history ratings that score is B0's. Their error is therefore the error of rung plus calibrator. An error comparison between such a rung and a rung that gives its own score is marked "not like for like": read pair accuracy there.

## Each rung against B0: members other than the owner

72 members with 10 or more targets, 4,058 targets. Each member counts once. Others: all.

| Rung | Scorer | Error | Error: difference to B0 | Smallest detectable | Members improved | Skill | Pair accuracy | Pair accuracy: difference to B0 | Error comparison | Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| B0 | Median of the member's ratings so far | 1.466 (1.308 to 1.640) | +0.000 (+0.000 to +0.000) | 0.000 | 0 of 72 | 0.000 | 0.500 (0.500 to 0.500) | +0.000 (+0.000 to +0.000) | like for like | `20261013T121437-3aeac83e-346c` |
| B1 | GoodWatch score plus the member's shrunk offset | 1.472 (1.322 to 1.635) | +0.006 (-0.096 to +0.107) | 0.146 | 36 of 72 | -0.004 | 0.598 (0.566 to 0.629) | +0.098 (+0.066 to +0.129) | like for like | `20261013T121448-7d38ea9d-2d2b` |
| B2 | Today's taste (calibrated) | 1.459 (1.300 to 1.636) | -0.008 (-0.029 to +0.011) | 0.028 | 13 of 72 | 0.005 | 0.528 (0.501 to 0.554) | +0.028 (+0.001 to +0.054) | not like for like | `20261013T121500-0a3aacc3-5a57` |
| B3 | Taste on standardized fingerprints (calibrated) | 1.462 (1.301 to 1.642) | -0.004 (-0.022 to +0.015) | 0.027 | 15 of 72 | 0.003 | 0.560 (0.533 to 0.584) | +0.060 (+0.033 to +0.084) | not like for like | `20261013T122010-df4894a6-7921` |
| B4 | Consensus with offset and slope per member | 1.378 (1.220 to 1.548) | -0.089 (-0.177 to -0.001) | 0.126 | 46 of 72 | 0.061 | 0.616 (0.586 to 0.645) | +0.116 (+0.086 to +0.145) | like for like | `20261013T121741-566d1e29-dc52` |
| B5 | Pooled predictor, personal weights on | 1.351 (1.201 to 1.519) | -0.115 (-0.196 to -0.033) | 0.117 | 53 of 72 | 0.078 | 0.617 (0.588 to 0.644) | +0.117 (+0.088 to +0.144) | like for like | `20261013T121902-d288d6bc-dd1d` |
| BP | Vote count (ranking rung) (calibrated) | 1.448 (1.299 to 1.612) | -0.018 (-0.043 to +0.001) | 0.032 | 13 of 72 | 0.012 | 0.546 (0.515 to 0.575) | +0.046 (+0.015 to +0.075) | not like for like | `20261013T121704-e0711083-cb42` |

## The calibrator floor

What the calibrator alone does to a rank-only rung: the rung's own answers with the ranks permuted within every view, calibrated the same way, averaged over 20 permutations. A scorer that knows nothing must land on B0: the floor has to lie within 0.01 of B0 for members other than the owner. "Rung against its floor" is what the rung's order adds to its error.

| Rung | Others: floor error | Floor minus B0 | Within tolerance | Rung against its floor | Owner: floor minus B0 | Owner: rung against its floor |
|---|---:|---:|---|---:|---:|---:|
| B2 | 1.467 (1.309 to 1.641) | +0.000 (-0.005 to +0.005) | yes | -0.008 (-0.025 to +0.007) | +0.000 | +0.000 |
| B3 | 1.467 (1.309 to 1.641) | +0.001 (-0.003 to +0.005) | yes | -0.005 (-0.021 to +0.013) | +0.002 | -0.118 |
| BP | 1.465 (1.308 to 1.638) | -0.001 (-0.007 to +0.004) | yes | -0.017 (-0.040 to -0.001) | -0.005 | -0.058 |

## What the others had written: all, before the block, without the owner

The same members and targets under three views of other members' data. all: everything other members wrote up to the pull; before: only what other members had written before the block; no-owner: as "all", without the owner's rows. B0, B2, B3 and BP do not read other members' rows.

| Rung | all: error | all: difference to B0 | all: pair accuracy | before: error | before: difference to B0 | before: pair accuracy | no-owner: error | no-owner: difference to B0 | no-owner: pair accuracy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B0 | 1.466 | +0.000 (+0.000 to +0.000) | 0.500 | 1.466 | +0.000 (+0.000 to +0.000) | 0.500 | 1.466 | +0.000 (+0.000 to +0.000) | 0.500 |
| B1 | 1.472 | +0.006 (-0.096 to +0.107) | 0.598 | 1.450 | -0.017 (-0.115 to +0.079) | 0.598 | 1.474 | +0.007 (-0.095 to +0.109) | 0.598 |
| B2 | 1.459 | -0.008 (-0.029 to +0.011) | 0.528 | 1.459 | -0.008 (-0.029 to +0.011) | 0.528 | 1.459 | -0.008 (-0.029 to +0.011) | 0.528 |
| B3 | 1.462 | -0.004 (-0.022 to +0.015) | 0.560 | 1.462 | -0.004 (-0.022 to +0.015) | 0.560 | 1.462 | -0.004 (-0.022 to +0.015) | 0.560 |
| B4 | 1.378 | -0.089 (-0.177 to -0.001) | 0.616 | 1.371 | -0.095 (-0.180 to -0.012) | 0.622 | 1.370 | -0.097 (-0.185 to -0.009) | 0.611 |
| B5 | 1.351 | -0.115 (-0.196 to -0.033) | 0.617 | 1.362 | -0.105 (-0.183 to -0.025) | 0.626 | 1.349 | -0.118 (-0.199 to -0.034) | 0.618 |
| BP | 1.448 | -0.018 (-0.043 to +0.001) | 0.546 | 1.448 | -0.018 (-0.043 to +0.001) | 0.546 | 1.448 | -0.018 (-0.043 to +0.001) | 0.546 |

## Each rung against B0: the owner alone

One member. The numbers are plain figures. An interval over sittings is given only when the owner has 10 or more sittings with targets and none of them holds more than a quarter of the targets; otherwise the column says why not. "Franchises drawn again" is a second figure, not that interval: whole movie series are resampled together and every other title alone, with sittings ignored, so it is too narrow as a statement about the owner's future ratings.

| Rung | Targets | Sittings | Error | Skill | Difference to B0 | Interval over sittings | Franchises drawn again | Pair accuracy | Pair accuracy: difference to B0 | Error comparison |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---|
| B0 | 999 | 97 | 1.075 | 0.000 | +0.000 | n/a: the largest of 97 sittings holds 39% of the targets | +0.000 to +0.000 | 0.500 | +0.000 | like for like |
| B1 | 999 | 97 | 1.008 | 0.062 | -0.067 | n/a: the largest of 97 sittings holds 39% of the targets | -0.141 to +0.004 | 0.686 | +0.186 | like for like |
| B2 | 999 | 97 | 1.075 | 0.000 | +0.000 | n/a: the largest of 97 sittings holds 39% of the targets | -0.023 to +0.023 | 0.555 | +0.055 | not like for like |
| B3 | 999 | 97 | 0.959 | 0.108 | -0.116 | n/a: the largest of 97 sittings holds 39% of the targets | -0.162 to -0.071 | 0.641 | +0.141 | not like for like |
| B4 | 999 | 97 | 0.869 | 0.192 | -0.206 | n/a: the largest of 97 sittings holds 39% of the targets | -0.255 to -0.156 | 0.687 | +0.187 | like for like |
| B5 | 999 | 97 | 0.852 | 0.208 | -0.223 | n/a: the largest of 97 sittings holds 39% of the targets | -0.279 to -0.169 | 0.706 | +0.206 | like for like |
| BP | 999 | 97 | 1.012 | 0.059 | -0.063 | n/a: the largest of 97 sittings holds 39% of the targets | -0.099 to -0.028 | 0.509 | +0.009 | not like for like |

| Rung | all: error | all: difference to B0 | all: pair accuracy | before: error | before: difference to B0 | before: pair accuracy | no-owner: error | no-owner: difference to B0 | no-owner: pair accuracy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B0 | 1.075 | +0.000 | 0.500 | 1.075 | +0.000 | 0.500 | 1.075 | +0.000 | 0.500 |
| B1 | 1.008 | -0.067 | 0.686 | 1.008 | -0.067 | 0.686 | 1.008 | -0.067 | 0.686 |
| B2 | 1.075 | +0.000 | 0.555 | 1.075 | +0.000 | 0.555 | 1.075 | +0.000 | 0.555 |
| B3 | 0.959 | -0.116 | 0.641 | 0.959 | -0.116 | 0.641 | 0.959 | -0.116 | 0.641 |
| B4 | 0.869 | -0.206 | 0.687 | 1.008 | -0.067 | 0.686 | 0.869 | -0.206 | 0.687 |
| B5 | 0.852 | -0.223 | 0.706 | 1.008 | -0.067 | 0.686 | 0.852 | -0.223 | 0.706 |
| BP | 1.012 | -0.063 | 0.509 | 1.012 | -0.063 | 0.509 | 1.012 | -0.063 | 0.509 |

## Rung against rung

Others: all unless the row says otherwise. For every pair the difference in error and, beside it, the difference in pair accuracy.

| Rung | Reference | Others option | Error comparison | Others: error difference | Smallest detectable | Members improved | Others: pair accuracy difference | Owner: error difference | Owner: franchises drawn again | Owner: pair accuracy difference |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| B2 | B1 | all | not like for like | -0.013 (-0.115 to +0.091) | 0.146 | 32 of 72 | -0.069 (-0.117 to -0.027) | +0.067 | -0.004 to +0.139 | -0.131 |
| B3 | B2 | all | like for like | +0.004 (-0.005 to +0.013) | 0.013 | 11 of 72 | +0.031 (+0.013 to +0.051) | -0.116 | -0.158 to -0.074 | +0.086 |
| B4 | B2 | all | not like for like | -0.081 (-0.173 to +0.008) | 0.129 | 44 of 72 | +0.087 (+0.049 to +0.128) | -0.206 | -0.254 to -0.157 | +0.132 |
| B5 | B2 | all | not like for like | -0.107 (-0.192 to -0.025) | 0.119 | 50 of 72 | +0.088 (+0.058 to +0.120) | -0.223 | -0.276 to -0.170 | +0.151 |
| B3 | B1 | all | not like for like | -0.010 (-0.113 to +0.095) | 0.147 | 33 of 72 | -0.038 (-0.078 to -0.001) | -0.049 | -0.113 to +0.016 | -0.045 |
| B4 | B1 | all | like for like | -0.094 (-0.152 to -0.040) | 0.081 | 49 of 72 | +0.018 (-0.008 to +0.044) | -0.139 | -0.195 to -0.082 | +0.001 |
| B5 | B1 | all | like for like | -0.121 (-0.179 to -0.061) | 0.086 | 52 of 72 | +0.019 (-0.014 to +0.050) | -0.156 | -0.211 to -0.100 | +0.020 |
| B5 | B4 | all | like for like | -0.026 (-0.058 to +0.005) | 0.045 | 36 of 72 | +0.001 (-0.020 to +0.022) | -0.017 | -0.048 to +0.012 | +0.019 |
| B2 | B1 | before | not like for like | +0.009 (-0.088 to +0.109) | 0.140 | 28 of 72 | -0.070 (-0.117 to -0.027) | +0.067 | -0.003 to +0.139 | -0.131 |
| B3 | B2 | before | like for like | +0.004 (-0.005 to +0.013) | 0.013 | 11 of 72 | +0.031 (+0.013 to +0.051) | -0.116 | -0.158 to -0.074 | +0.086 |
| B4 | B2 | before | not like for like | -0.088 (-0.174 to -0.005) | 0.121 | 44 of 72 | +0.094 (+0.058 to +0.131) | -0.067 | -0.139 to +0.003 | +0.131 |
| B5 | B2 | before | not like for like | -0.097 (-0.178 to -0.017) | 0.115 | 45 of 72 | +0.097 (+0.068 to +0.127) | -0.067 | -0.139 to +0.003 | +0.131 |
| B3 | B1 | before | not like for like | +0.013 (-0.084 to +0.113) | 0.141 | 29 of 72 | -0.039 (-0.078 to -0.002) | -0.049 | -0.113 to +0.016 | -0.045 |
| B4 | B1 | before | like for like | -0.079 (-0.128 to -0.031) | 0.069 | 46 of 72 | +0.024 (-0.006 to +0.054) | +0.000 | +0.000 to +0.000 | +0.000 |
| B5 | B1 | before | like for like | -0.088 (-0.141 to -0.033) | 0.077 | 46 of 72 | +0.028 (-0.010 to +0.062) | +0.000 | +0.000 to +0.000 | +0.000 |
| B5 | B4 | before | like for like | -0.009 (-0.037 to +0.019) | 0.040 | 33 of 72 | +0.004 (-0.015 to +0.023) | +0.000 | +0.000 to +0.000 | +0.000 |
| B2 | B1 | no-owner | not like for like | -0.015 (-0.117 to +0.089) | 0.146 | 32 of 72 | -0.069 (-0.117 to -0.027) | +0.067 | -0.004 to +0.139 | -0.131 |
| B3 | B2 | no-owner | like for like | +0.004 (-0.005 to +0.013) | 0.013 | 11 of 72 | +0.031 (+0.013 to +0.051) | -0.116 | -0.158 to -0.074 | +0.086 |
| B4 | B2 | no-owner | not like for like | -0.089 (-0.182 to +0.002) | 0.131 | 49 of 72 | +0.083 (+0.047 to +0.119) | -0.206 | -0.254 to -0.157 | +0.132 |
| B5 | B2 | no-owner | not like for like | -0.110 (-0.195 to -0.026) | 0.121 | 51 of 72 | +0.090 (+0.060 to +0.120) | -0.223 | -0.276 to -0.170 | +0.151 |
| B3 | B1 | no-owner | not like for like | -0.011 (-0.114 to +0.093) | 0.147 | 33 of 72 | -0.038 (-0.078 to -0.001) | -0.049 | -0.113 to +0.016 | -0.045 |
| B4 | B1 | no-owner | like for like | -0.104 (-0.160 to -0.049) | 0.079 | 49 of 72 | +0.014 (-0.017 to +0.044) | -0.139 | -0.195 to -0.082 | +0.001 |
| B5 | B1 | no-owner | like for like | -0.125 (-0.182 to -0.068) | 0.082 | 49 of 72 | +0.021 (-0.014 to +0.053) | -0.156 | -0.211 to -0.100 | +0.020 |
| B5 | B4 | no-owner | like for like | -0.021 (-0.055 to +0.013) | 0.050 | 33 of 72 | +0.007 (-0.011 to +0.025) | -0.017 | -0.048 to +0.012 | +0.019 |

## Targets whose rating was edited later

A target keeps its current score as the label. 108 of the 4,058 targets of the members above carry a rating that was edited after it was first written. The primary measure with all targets and with those left out (same members). Others: all.

| Rung | Error, all targets | Difference to B0 | Error, never edited | Difference to B0 | Owner: error, all | Owner: error, never edited |
|---|---:|---:|---:|---:|---:|---:|
| B0 | 1.466 | +0.000 (+0.000 to +0.000) | 1.466 | +0.000 (+0.000 to +0.000) | 1.075 | 1.076 |
| B1 | 1.472 | +0.006 (-0.096 to +0.107) | 1.474 | +0.008 (-0.095 to +0.111) | 1.008 | 1.004 |
| B2 | 1.459 | -0.008 (-0.029 to +0.011) | 1.457 | -0.009 (-0.029 to +0.010) | 1.075 | 1.073 |
| B3 | 1.462 | -0.004 (-0.022 to +0.015) | 1.461 | -0.005 (-0.023 to +0.014) | 0.959 | 0.958 |
| B4 | 1.378 | -0.089 (-0.177 to -0.001) | 1.376 | -0.090 (-0.179 to -0.002) | 0.869 | 0.864 |
| B5 | 1.351 | -0.115 (-0.196 to -0.033) | 1.351 | -0.115 (-0.196 to -0.034) | 0.852 | 0.850 |
| BP | 1.448 | -0.018 (-0.043 to +0.001) | 1.448 | -0.018 (-0.043 to +0.001) | 1.012 | 1.014 |

## Guards: members other than the owner

Low-rating AUC: the chance that a title rated 5 or less ranks below one rated higher, for members with 5 or more of each. Reported, never optimised: error on ratings of 5 or less, 6 to 7, 8 or more. Others: all.

| Rung | Low-rating AUC | Members | Error, low | Error, middle | Error, high |
|---|---:|---:|---:|---:|---:|
| B0 | 0.500 (0.500 to 0.500) | 22 | 3.710 | 1.889 | 1.421 |
| B1 | 0.635 (0.575 to 0.699) | 22 | 2.977 | 1.258 | 1.582 |
| B2 | 0.581 (0.528 to 0.629) | 22 | 3.646 | 1.886 | 1.414 |
| B3 | 0.620 (0.561 to 0.673) | 22 | 3.602 | 1.890 | 1.435 |
| B4 | 0.648 (0.588 to 0.711) | 22 | 3.109 | 1.241 | 1.499 |
| B5 | 0.676 (0.611 to 0.739) | 22 | 2.994 | 1.304 | 1.466 |
| BP | 0.552 (0.496 to 0.609) | 22 | 3.599 | 1.839 | 1.408 |

Chance of a rating of 5 or less: the member's own share so far has a Brier score of 0.094 (0.071 to 0.119) for other members (B0 gives that share as `p_low`: 0.094 (0.071 to 0.119)). No other rung of the ladder gives a chance.

| Own share so far | Targets | Mean predicted | Share rated 5 or less |
|---|---:|---:|---:|
| 0.0 to 0.1 | 1,658 | 0.017 | 0.064 |
| 0.1 to 0.2 | 1,212 | 0.144 | 0.174 |
| 0.2 to 0.3 | 637 | 0.212 | 0.163 |
| 0.3 to 0.4 | 189 | 0.335 | 0.307 |
| 0.4 to 0.5 | 143 | 0.418 | 0.308 |
| 0.5 to 0.6 | 34 | 0.535 | 0.647 |
| 0.6 to 0.7 | 56 | 0.663 | 0.661 |
| 0.7 to 0.8 | 199 | 0.742 | 0.709 |
| 0.8 to 0.9 | 16 | 0.852 | 0.688 |
| 0.9 to 1.0 | 51 | 0.973 | 0.745 |

## Strata, error difference to B0: members other than the owner

Every member with a target in the stratum counts once, whatever their number of targets. Others: all.

| Stratum | Members | Targets | B1 | B2 | B3 | B4 | B5 | BP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| sitting:later | 16 | 276 | -0.286 (-0.712 to +0.150) | +0.037 (-0.010 to +0.096) | +0.032 (-0.034 to +0.131) | +0.015 (-0.296 to +0.340) | +0.012 (-0.321 to +0.399) | +0.070 (-0.005 to +0.191) |
| sitting:same | 97 | 3,919 | +0.022 (-0.085 to +0.137) | -0.007 (-0.023 to +0.006) | -0.003 (-0.017 to +0.011) | -0.058 (-0.148 to +0.037) | -0.108 (-0.186 to -0.028) | -0.014 (-0.033 to +0.000) |
| block:5 | 97 | 590 | +0.084 (-0.071 to +0.238) | +0.000 (+0.000 to +0.000) | +0.000 (+0.000 to +0.000) | -0.028 (-0.156 to +0.099) | -0.071 (-0.186 to +0.039) | +0.000 (+0.000 to +0.000) |
| block:10 | 74 | 585 | -0.035 (-0.175 to +0.115) | +0.000 (+0.000 to +0.000) | +0.000 (+0.000 to +0.000) | -0.074 (-0.184 to +0.040) | -0.056 (-0.171 to +0.068) | +0.000 (+0.000 to +0.000) |
| block:20 | 46 | 701 | -0.024 (-0.127 to +0.084) | +0.000 (+0.000 to +0.000) | +0.000 (+0.000 to +0.000) | -0.122 (-0.232 to -0.012) | -0.141 (-0.255 to -0.033) | +0.000 (+0.000 to +0.000) |
| block:40 | 29 | 862 | +0.015 (-0.219 to +0.236) | -0.033 (-0.141 to +0.076) | +0.029 (-0.073 to +0.149) | -0.033 (-0.196 to +0.143) | -0.117 (-0.273 to +0.040) | -0.090 (-0.270 to +0.039) |
| block:80 | 16 | 770 | +0.083 (-0.085 to +0.273) | -0.152 (-0.358 to -0.021) | -0.261 (-0.653 to -0.034) | +0.003 (-0.137 to +0.178) | -0.093 (-0.200 to +0.034) | -0.142 (-0.350 to -0.014) |
| block:160 | 8 | 648 | +0.175 (-0.204 to +0.677) | -0.024 (-0.071 to +0.023) | -0.047 (-0.143 to +0.067) | +0.101 (-0.240 to +0.581) | -0.054 (-0.285 to +0.303) | -0.044 (-0.129 to +0.021) |
| block:320 | 2 | 39 | +0.031 (+0.000 to +0.062) | +0.012 (-0.062 to +0.087) | +0.012 (-0.062 to +0.087) | +0.094 (+0.000 to +0.188) | +0.000 (+0.000 to +0.000) | +0.231 (+0.087 to +0.375) |
| media:movie | 87 | 2,599 | +0.020 (-0.155 to +0.185) | +0.004 (-0.010 to +0.024) | +0.004 (-0.011 to +0.024) | -0.084 (-0.182 to +0.017) | -0.098 (-0.184 to -0.012) | -0.010 (-0.033 to +0.006) |
| media:show | 82 | 1,596 | +0.014 (-0.127 to +0.160) | -0.009 (-0.027 to +0.006) | -0.008 (-0.026 to +0.011) | -0.010 (-0.144 to +0.130) | -0.076 (-0.206 to +0.055) | -0.011 (-0.032 to +0.007) |
| provenance:typed | 97 | 4,195 | +0.025 (-0.087 to +0.142) | -0.006 (-0.022 to +0.008) | -0.003 (-0.017 to +0.011) | -0.053 (-0.144 to +0.043) | -0.092 (-0.170 to -0.014) | -0.013 (-0.032 to +0.001) |
| fingerprint:with | 97 | 4,153 | +0.018 (-0.093 to +0.135) | -0.006 (-0.022 to +0.007) | -0.003 (-0.017 to +0.011) | -0.057 (-0.150 to +0.041) | -0.099 (-0.179 to -0.018) | -0.013 (-0.032 to +0.000) |
| fingerprint:without | 25 | 42 | +0.161 (-0.072 to +0.467) | +0.080 (+0.000 to +0.200) | +0.080 (+0.000 to +0.200) | +0.187 (-0.107 to +0.533) | +0.187 (-0.053 to +0.440) | +0.040 (+0.000 to +0.120) |
| released:2y_before_rating | 97 | 3,960 | +0.022 (-0.091 to +0.140) | -0.005 (-0.022 to +0.011) | -0.002 (-0.017 to +0.015) | -0.056 (-0.148 to +0.041) | -0.099 (-0.179 to -0.019) | -0.013 (-0.032 to +0.001) |
| released:later_or_unknown | 52 | 235 | -0.021 (-0.313 to +0.257) | -0.012 (-0.161 to +0.136) | -0.018 (-0.165 to +0.121) | -0.025 (-0.257 to +0.223) | -0.090 (-0.297 to +0.128) | +0.013 (-0.033 to +0.067) |
| label:edited_later | 11 | 108 | +0.145 (-0.446 to +0.850) | +0.067 (-0.002 to +0.168) | +0.098 (-0.033 to +0.299) | +0.357 (-0.317 to +1.077) | +0.088 (-0.507 to +0.686) | +0.088 (-0.030 to +0.285) |
| label:never_edited | 97 | 4,087 | +0.027 (-0.085 to +0.145) | -0.006 (-0.022 to +0.007) | -0.004 (-0.018 to +0.010) | -0.054 (-0.144 to +0.042) | -0.092 (-0.170 to -0.013) | -0.013 (-0.032 to +0.000) |

## Strata, error difference to B0: the owner alone

Plain figures; an interval over sittings only where the rule above allows one.

| Stratum | Targets | B1 | B2 | B3 | B4 | B5 | BP |
|---|---:|---:|---:|---:|---:|---:|---:|
| sitting:later | 534 | -0.133 | -0.022 | -0.172 | -0.266 | -0.281 | -0.097 |
| sitting:same | 465 | +0.009 | +0.026 | -0.052 | -0.138 | -0.157 | -0.024 |
| block:5 | 5 | -0.400 | +0.000 | +0.000 | -0.400 | -0.400 | +0.000 |
| block:10 | 10 | +0.000 | +0.000 | +0.000 | +0.000 | +0.000 | +0.000 |
| block:20 | 20 | -0.300 | +0.000 | +0.000 | -0.250 | -0.300 | +0.000 |
| block:40 | 40 | +0.175 | +0.000 | +0.000 | +0.025 | +0.050 | +0.325 |
| block:80 | 80 | +0.062 | +0.087 | +0.025 | -0.062 | -0.037 | +0.013 |
| block:160 | 160 | -0.175 | -0.037 | +0.019 | -0.175 | -0.212 | +0.000 |
| block:320 | 320 | -0.241 | -0.031 | -0.391 | -0.453 | -0.475 | -0.244 |
| block:640 | 364 | +0.093 | +0.025 | +0.011 | -0.060 | -0.077 | +0.003 |
| media:movie | 862 | -0.077 | -0.001 | -0.125 | -0.224 | -0.242 | -0.063 |
| media:show | 137 | -0.007 | +0.007 | -0.058 | -0.095 | -0.102 | -0.066 |
| provenance:typed | 999 | -0.067 | +0.000 | -0.116 | -0.206 | -0.223 | -0.063 |
| fingerprint:with | 989 | -0.066 | +0.000 | -0.115 | -0.205 | -0.221 | -0.065 |
| fingerprint:without | 10 | -0.200 | +0.000 | -0.200 | -0.300 | -0.400 | +0.100 |
| released:2y_before_rating | 956 | -0.071 | +0.000 | -0.122 | -0.213 | -0.228 | -0.065 |
| released:later_or_unknown | 43 | +0.023 (-0.293 to +0.362) | +0.000 (-0.125 to +0.140) | +0.023 (-0.184 to +0.250) | -0.047 (-0.227 to +0.158) | -0.116 (-0.306 to +0.105) | -0.023 (-0.111 to +0.051) |
| label:edited_later | 14 | +0.286 (-0.375 to +0.867) | +0.214 (+0.000 to +0.429) | +0.000 (-0.462 to +0.357) | +0.214 (-0.125 to +0.538) | +0.000 (-0.500 to +0.500) | -0.143 (-0.667 to +0.286) |
| label:never_edited | 985 | -0.072 | -0.003 | -0.118 | -0.212 | -0.226 | -0.062 |

## Runs

| Rung | Others | Run | Seconds | Peak memory, MB | Predictor sha256 | Views digest |
|---|---|---|---:|---:|---|---|
| B0 | all | `20261013T121437-3aeac83e-346c` | 11.4 | 228.1 | `3aeac83e3c915fd1` | `705cfb94cd46` |
| B1 | all | `20261013T121448-7d38ea9d-2d2b` | 10.5 | 227.8 | `7d38ea9da5c20bf2` | `705cfb94cd46` |
| B2 | all | `20261013T121500-0a3aacc3-5a57` | 124.2 | 228.2 | `0a3aacc3ade1854f` | `705cfb94cd46` |
| B3 | all | `20261013T122010-df4894a6-7921` | 143.2 | 229.4 | `df4894a692d6c43c` | `705cfb94cd46` |
| B4 | all | `20261013T121741-566d1e29-dc52` | 81.2 | 228.8 | `566d1e29bcf39744` | `705cfb94cd46` |
| B5 | all | `20261013T121902-d288d6bc-dd1d` | 61.2 | 229.7 | `d288d6bc9ddf52ec` | `705cfb94cd46` |
| BP | all | `20261013T121704-e0711083-cb42` | 36.7 | 227.9 | `e0711083be2fd06f` | `705cfb94cd46` |
| B0 | before | `20261013T122241-3aeac83e-ff8e` | 8.1 | 228.0 | `3aeac83e3c915fd1` | `3c4124f7da58` |
| B1 | before | `20261013T122249-7d38ea9d-93f5` | 29.2 | 228.1 | `7d38ea9da5c20bf2` | `3c4124f7da58` |
| B2 | before | `20261013T122320-0a3aacc3-15a1` | 88.2 | 229.3 | `0a3aacc3ade1854f` | `3c4124f7da58` |
| B3 | before | `20261013T122711-df4894a6-641b` | 223.3 | 230.5 | `df4894a692d6c43c` | `3c4124f7da58` |
| B4 | before | `20261013T122552-566d1e29-c90c` | 34.6 | 229.8 | `566d1e29bcf39744` | `3c4124f7da58` |
| B5 | before | `20261013T122627-d288d6bc-6989` | 43.5 | 230.6 | `d288d6bc9ddf52ec` | `3c4124f7da58` |
| BP | before | `20261013T122448-e0711083-0c39` | 63.6 | 229.1 | `e0711083be2fd06f` | `3c4124f7da58` |
| B0 | no-owner | `20261013T123103-3aeac83e-bd88` | 6.4 | 229.0 | `3aeac83e3c915fd1` | `32a2037f8527` |
| B1 | no-owner | `20261013T123110-7d38ea9d-81bf` | 11.6 | 229.5 | `7d38ea9da5c20bf2` | `32a2037f8527` |
| B2 | no-owner | `20261013T123121-0a3aacc3-ea3f` | 110.9 | 230.3 | `0a3aacc3ade1854f` | `32a2037f8527` |
| B3 | no-owner | `20261013T123510-df4894a6-faa8` | 301.9 | 184.0 | `df4894a692d6c43c` | `32a2037f8527` |
| B4 | no-owner | `20261013T123332-566d1e29-fd9a` | 38.1 | 230.4 | `566d1e29bcf39744` | `32a2037f8527` |
| B5 | no-owner | `20261013T123410-d288d6bc-404a` | 59.6 | 231.3 | `d288d6bc9ddf52ec` | `32a2037f8527` |
| BP | no-owner | `20261013T123314-e0711083-3f67` | 16.5 | 230.1 | `e0711083be2fd06f` | `32a2037f8527` |
