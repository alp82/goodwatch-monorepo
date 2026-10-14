# The T2b ladder, tier A: ranking later Want to See adds

Built by `lab/table.py T2b` from the `ladder` lines of `ledger.jsonl`. Pack 2026-10-13 (`ac1341f55c9b`), harness `4ba1b09a4a87`, 10,000 bootstrap draws, seed 20261013. Within each part every row carries one views digest.

What T2b measures (PROTOCOL.md, section 4b). A member's later Want to See adds are the targets. The scorer sees what the member wrote before the first target and ranks every title of the candidate universe the member had not rated, added, skipped or marked Not interested by then. Each target is placed, alone, among the listed titles that are not targets. Percentile: the share of them ranked below it (1.0 is the top, 0.5 is no order); it is the primary measure, per member, paired against B2. "In the first 50": fewer than 50 titles rank above it. "Equally well-rated", "equally popular" and "both" count only titles within 3 GoodWatch points, within a factor of 1.5 in votes, and within 3 points and a factor of 2 at once (a target needs 50 such titles for "both").

Read every figure with its member count: few members add titles to Want to See in more than one visit, so the parts below rest on a handful of members. A difference is the rung minus the reference, per member, then averaged; intervals are 95%, from drawing members again.

## Split by sitting, other members before the cutoff (the primary T2b)

3 members other than the owner, 44 targets (of 258 adds; 5 later adds outside the universe and 6 already touched before the cutoff were dropped). About 60,331 titles in a list. 1 members have 3 or more titles skipped or marked Not interested after the cutoff (60 such titles). Titles touched before the cutoff found in any list: 0; in a first 50: 0.

| Rung | Scorer | Percentile | Against B2 | Smallest detectable | Members improved | Against B1 | Against BP | First 50 | First 200 | Equally well-rated | Equally popular | Both |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | GoodWatch score | 0.751 (0.648 to 0.840) | +0.242 (+0.148 to +0.396) | 0.217 | 3 of 3 | reference | +0.013 (-0.069 to +0.086) | 0.000 (0.000 to 0.000) | 0.010 (0.000 to 0.030) | 0.542 (0.509 to 0.570) | 0.698 (0.619 to 0.741) | 0.526 (0.497 to 0.574) (43 targets / 3 members; both_under_min: 1) |
| B2 | Today's taste | 0.509 (0.444 to 0.583) | reference |  |  | -0.242 (-0.396 to -0.148) | -0.228 (-0.464 to -0.062) | 0.000 (0.000 to 0.000) | 0.010 (0.000 to 0.030) | 0.511 (0.457 to 0.577) | 0.495 (0.409 to 0.577) | 0.489 (0.405 to 0.562) (43 targets / 3 members; both_under_min: 1) |
| B3 | Taste on standardized fingerprints | 0.672 (0.500 to 0.761) | +0.163 (+0.000 to +0.317) | 0.257 | 2 of 3 | -0.079 (-0.148 to -0.010) | -0.065 (-0.147 to +0.013) | 0.020 (0.000 to 0.061) | 0.040 (0.000 to 0.121) | 0.623 (0.500 to 0.685) | 0.610 (0.500 to 0.712) | 0.562 (0.500 to 0.649) (43 targets / 3 members; both_under_min: 1) |
| B4 | Consensus with offset and slope per member | 0.664 (0.627 to 0.693) | +0.155 (+0.110 to +0.183) | 0.064 | 3 of 3 | -0.087 (-0.213 to +0.024) | -0.073 (-0.281 to +0.110) | 0.010 (0.000 to 0.030) | 0.010 (0.000 to 0.030) | 0.463 (0.351 to 0.545) | 0.693 (0.670 to 0.717) | 0.529 (0.495 to 0.560) (43 targets / 3 members; both_under_min: 1) |
| B5 | Pooled predictor, personal weights on | 0.693 (0.656 to 0.740) | +0.184 (+0.073 to +0.240) | 0.155 | 3 of 3 | -0.058 (-0.157 to +0.092) | -0.044 (-0.226 to +0.178) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.545 (0.437 to 0.690) | 0.711 (0.651 to 0.780) | 0.613 (0.493 to 0.678) (43 targets / 3 members; both_under_min: 1) |
| BP | Vote count | 0.737 (0.562 to 0.908) | +0.228 (+0.062 to +0.464) | 0.340 | 3 of 3 | -0.013 (-0.086 to +0.069) | reference | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.706 (0.552 to 0.885) | 0.562 (0.540 to 0.588) | 0.581 (0.549 to 0.616) (43 targets / 3 members; both_under_min: 1) |

Equally well-rated, equally popular and both, against B2; then the guards. The members' own rated and added titles are 0.435 shows and 0.168 animation. Later skips: the mean percentile of the titles skipped or marked Not interested after the cutoff (lower is better). Want to See against Skip: the chance a target ranks above such a title, a stand-in.

| Rung | Equally well-rated against B2 | Equally popular against B2 | Both against B2 | Shows against own mix | Animation against own mix | Most from one franchise | Median vote count | Later skips | Want to See against Skip (stand-in) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | +0.031 (-0.007 to +0.090) | +0.202 (+0.119 to +0.324) | +0.037 (-0.003 to +0.101) (43 targets / 3 members; both_under_min: 1) | +0.251 (+0.164 to +0.352) | +0.052 (-0.246 to +0.260) | 1.0 | 11,590 | 0.819 | 0.489 |
| B2 | reference | reference | reference (43 targets / 3 members; both_under_min: 1) | -0.169 (-0.356 to +0.052) | +0.126 (+0.034 to +0.242) | 2.3 | 5,272 | 0.558 | 0.536 |
| B3 | +0.111 (+0.000 to +0.226) | +0.115 (+0.000 to +0.209) | +0.073 (+0.000 to +0.132) (43 targets / 3 members; both_under_min: 1) | -0.095 (-0.356 to +0.092) | +0.186 (+0.100 to +0.282) | 2.3 | 18,844 | 0.737 | 0.498 |
| B4 | -0.048 (-0.106 to +0.045) | +0.198 (+0.140 to +0.282) | +0.040 (-0.029 to +0.090) (43 targets / 3 members; both_under_min: 1) | -0.275 (-0.356 to -0.208) | -0.054 (-0.346 to +0.100) | 2.0 | 6,170 | 0.646 | 0.582 |
| B5 | +0.034 (-0.069 to +0.190) | +0.216 (+0.073 to +0.370) | +0.124 (-0.069 to +0.273) (43 targets / 3 members; both_under_min: 1) | -0.122 (-0.383 to +0.392) | +0.212 (-0.366 to +0.642) | 2.3 | 70,556 | 0.668 | 0.505 |
| BP | +0.195 (+0.052 to +0.428) | +0.067 (-0.018 to +0.179) | +0.092 (+0.016 to +0.212) (43 targets / 3 members; both_under_min: 1) | -0.415 (-0.496 to -0.348) | -0.141 (-0.406 to +0.020) | 4.7 | 1,372,743 | 0.888 | 0.264 |

The owner alone: 80 targets in 55 add sittings, 29 titles skipped after the cutoff. Plain figures; an interval over add sittings only where there are 10 or more and none holds more than a quarter of the targets; beside it the figure with whole franchises drawn again (79 units).

| Rung | Percentile | Interval over sittings | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP | Equally well-rated | Equally popular | Both | First 50 | First 200 | Later skips | Want to See against Skip |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.767 | +0.707 to +0.821 | +0.720 to +0.812 | +0.165 | +0.109 to +0.223 | reference | -0.108 | 0.561 | 0.692 | 0.521 (75 targets / 1 members; both_under_min: 5) | 0.037 | 0.037 | 0.789 | 0.486 |
| B2 | 0.602 | +0.544 to +0.664 | +0.543 to +0.663 | reference |  | -0.165 | -0.274 | 0.573 | 0.609 | 0.550 (75 targets / 1 members; both_under_min: 5) | 0.000 | 0.013 | 0.597 | 0.519 |
| B3 | 0.798 | +0.741 to +0.856 | +0.747 to +0.845 | +0.196 | +0.148 to +0.243 | +0.031 | -0.077 | 0.730 | 0.719 | 0.639 (75 targets / 1 members; both_under_min: 5) | 0.037 | 0.100 | 0.732 | 0.556 |
| B4 | 0.655 | +0.610 to +0.699 | +0.607 to +0.703 | +0.053 | -0.011 to +0.116 | -0.112 | -0.221 | 0.455 | 0.697 | 0.577 (75 targets / 1 members; both_under_min: 5) | 0.000 | 0.000 | 0.454 | 0.751 |
| B5 | 0.653 | +0.600 to +0.708 | +0.605 to +0.700 | +0.051 | -0.005 to +0.107 | -0.114 | -0.223 | 0.403 | 0.687 | 0.546 (75 targets / 1 members; both_under_min: 5) | 0.000 | 0.000 | 0.543 | 0.637 |
| BP | 0.876 | +0.825 to +0.922 | +0.836 to +0.911 | +0.274 | +0.211 to +0.337 | +0.108 | reference | 0.854 | 0.583 | 0.620 (75 targets / 1 members; both_under_min: 5) | 0.050 | 0.075 | 0.966 | 0.302 |

## Split by sitting, other members as of the pull

3 members other than the owner, 44 targets (of 258 adds; 5 later adds outside the universe and 6 already touched before the cutoff were dropped). About 60,331 titles in a list. 1 members have 3 or more titles skipped or marked Not interested after the cutoff (60 such titles). Titles touched before the cutoff found in any list: 0; in a first 50: 0.

| Rung | Scorer | Percentile | Against B2 | Smallest detectable | Members improved | Against B1 | Against BP | First 50 | First 200 | Equally well-rated | Equally popular | Both |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | GoodWatch score | 0.751 (0.648 to 0.840) | +0.242 (+0.148 to +0.396) | 0.217 | 3 of 3 | reference | +0.013 (-0.069 to +0.086) | 0.000 (0.000 to 0.000) | 0.010 (0.000 to 0.030) | 0.542 (0.509 to 0.570) | 0.698 (0.619 to 0.741) | 0.526 (0.497 to 0.574) (43 targets / 3 members; both_under_min: 1) |
| B2 | Today's taste | 0.509 (0.444 to 0.583) | reference |  |  | -0.242 (-0.396 to -0.148) | -0.228 (-0.464 to -0.062) | 0.000 (0.000 to 0.000) | 0.010 (0.000 to 0.030) | 0.511 (0.457 to 0.577) | 0.495 (0.409 to 0.577) | 0.489 (0.405 to 0.562) (43 targets / 3 members; both_under_min: 1) |
| B3 | Taste on standardized fingerprints | 0.672 (0.500 to 0.761) | +0.163 (+0.000 to +0.317) | 0.257 | 2 of 3 | -0.079 (-0.148 to -0.010) | -0.065 (-0.147 to +0.013) | 0.020 (0.000 to 0.061) | 0.040 (0.000 to 0.121) | 0.623 (0.500 to 0.685) | 0.610 (0.500 to 0.712) | 0.562 (0.500 to 0.649) (43 targets / 3 members; both_under_min: 1) |
| B4 | Consensus with offset and slope per member | 0.669 (0.626 to 0.726) | +0.160 (+0.072 to +0.226) | 0.128 | 3 of 3 | -0.082 (-0.214 to +0.078) | -0.068 (-0.282 to +0.164) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.482 (0.344 to 0.639) | 0.697 (0.675 to 0.733) | 0.548 (0.468 to 0.674) (43 targets / 3 members; both_under_min: 1) |
| B5 | Pooled predictor, personal weights on | 0.707 (0.646 to 0.780) | +0.198 (+0.063 to +0.280) | 0.191 | 3 of 3 | -0.043 (-0.144 to +0.132) | -0.030 (-0.213 to +0.218) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.564 (0.464 to 0.725) | 0.724 (0.643 to 0.770) | 0.618 (0.491 to 0.714) (43 targets / 3 members; both_under_min: 1) |
| BP | Vote count | 0.737 (0.562 to 0.908) | +0.228 (+0.062 to +0.464) | 0.340 | 3 of 3 | -0.013 (-0.086 to +0.069) | reference | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.706 (0.552 to 0.885) | 0.562 (0.540 to 0.588) | 0.581 (0.549 to 0.616) (43 targets / 3 members; both_under_min: 1) |

Equally well-rated, equally popular and both, against B2; then the guards. The members' own rated and added titles are 0.435 shows and 0.168 animation. Later skips: the mean percentile of the titles skipped or marked Not interested after the cutoff (lower is better). Want to See against Skip: the chance a target ranks above such a title, a stand-in.

| Rung | Equally well-rated against B2 | Equally popular against B2 | Both against B2 | Shows against own mix | Animation against own mix | Most from one franchise | Median vote count | Later skips | Want to See against Skip (stand-in) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | +0.031 (-0.007 to +0.090) | +0.202 (+0.119 to +0.324) | +0.037 (-0.003 to +0.101) (43 targets / 3 members; both_under_min: 1) | +0.251 (+0.164 to +0.352) | +0.052 (-0.246 to +0.260) | 1.0 | 11,590 | 0.819 | 0.489 |
| B2 | reference | reference | reference (43 targets / 3 members; both_under_min: 1) | -0.169 (-0.356 to +0.052) | +0.126 (+0.034 to +0.242) | 2.3 | 5,272 | 0.558 | 0.536 |
| B3 | +0.111 (+0.000 to +0.226) | +0.115 (+0.000 to +0.209) | +0.073 (+0.000 to +0.132) (43 targets / 3 members; both_under_min: 1) | -0.095 (-0.356 to +0.092) | +0.186 (+0.100 to +0.282) | 2.3 | 18,844 | 0.737 | 0.498 |
| B4 | -0.030 (-0.115 to +0.139) | +0.201 (+0.105 to +0.266) | +0.059 (-0.059 to +0.174) (43 targets / 3 members; both_under_min: 1) | -0.429 (-0.556 to -0.348) | -0.088 (-0.326 to +0.080) | 2.7 | 3,360 | 0.620 | 0.570 |
| B5 | +0.053 (-0.074 to +0.225) | +0.228 (+0.066 to +0.361) | +0.129 (-0.071 to +0.244) (43 targets / 3 members; both_under_min: 1) | -0.315 (-0.516 to -0.028) | +0.079 (-0.406 to +0.382) | 1.3 | 5,009 | 0.655 | 0.508 |
| BP | +0.195 (+0.052 to +0.428) | +0.067 (-0.018 to +0.179) | +0.092 (+0.016 to +0.212) (43 targets / 3 members; both_under_min: 1) | -0.415 (-0.496 to -0.348) | -0.141 (-0.406 to +0.020) | 4.7 | 1,372,743 | 0.888 | 0.264 |

The owner alone: 80 targets in 55 add sittings, 29 titles skipped after the cutoff. Plain figures; an interval over add sittings only where there are 10 or more and none holds more than a quarter of the targets; beside it the figure with whole franchises drawn again (79 units).

| Rung | Percentile | Interval over sittings | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP | Equally well-rated | Equally popular | Both | First 50 | First 200 | Later skips | Want to See against Skip |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.767 | +0.707 to +0.821 | +0.720 to +0.812 | +0.165 | +0.109 to +0.223 | reference | -0.108 | 0.561 | 0.692 | 0.521 (75 targets / 1 members; both_under_min: 5) | 0.037 | 0.037 | 0.789 | 0.486 |
| B2 | 0.602 | +0.544 to +0.664 | +0.543 to +0.663 | reference |  | -0.165 | -0.274 | 0.573 | 0.609 | 0.550 (75 targets / 1 members; both_under_min: 5) | 0.000 | 0.013 | 0.597 | 0.519 |
| B3 | 0.798 | +0.741 to +0.856 | +0.747 to +0.845 | +0.196 | +0.148 to +0.243 | +0.031 | -0.077 | 0.730 | 0.719 | 0.639 (75 targets / 1 members; both_under_min: 5) | 0.037 | 0.100 | 0.732 | 0.556 |
| B4 | 0.623 | +0.584 to +0.665 | +0.582 to +0.665 | +0.021 | -0.040 to +0.083 | -0.144 | -0.253 | 0.433 | 0.658 | 0.512 (75 targets / 1 members; both_under_min: 5) | 0.000 | 0.000 | 0.492 | 0.683 |
| B5 | 0.649 | +0.594 to +0.706 | +0.604 to +0.694 | +0.047 | -0.010 to +0.104 | -0.118 | -0.226 | 0.422 | 0.674 | 0.533 (75 targets / 1 members; both_under_min: 5) | 0.000 | 0.000 | 0.577 | 0.600 |
| BP | 0.876 | +0.825 to +0.922 | +0.836 to +0.911 | +0.274 | +0.211 to +0.337 | +0.108 | reference | 0.854 | 0.583 | 0.620 (75 targets / 1 members; both_under_min: 5) | 0.050 | 0.075 | 0.966 | 0.302 |

## Split by entry order, other members before the cutoff: learning from the adds made earlier in the same visit

9 members other than the owner, 68 targets (of 306 adds; 5 later adds outside the universe and 8 already touched before the cutoff were dropped). About 60,587 titles in a list. 6 members have 3 or more titles skipped or marked Not interested after the cutoff (288 such titles). Titles touched before the cutoff found in any list: 0; in a first 50: 0.

| Rung | Scorer | Percentile | Against B2 | Smallest detectable | Members improved | Against B1 | Against BP | First 50 | First 200 | Equally well-rated | Equally popular | Both |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | GoodWatch score | 0.745 (0.665 to 0.835) | +0.135 (+0.050 to +0.208) | 0.119 | 8 of 9 | reference | -0.149 (-0.250 to -0.042) | 0.037 (0.000 to 0.111) | 0.077 (0.000 to 0.225) | 0.562 (0.514 to 0.629) | 0.619 (0.539 to 0.726) | 0.536 (0.485 to 0.612) (66 targets / 9 members; both_under_min: 2) |
| B2 | Today's taste | 0.610 (0.531 to 0.703) | reference |  |  | -0.135 (-0.208 to -0.050) | -0.284 (-0.382 to -0.178) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.600 (0.516 to 0.701) | 0.569 (0.493 to 0.665) | 0.584 (0.508 to 0.676) (66 targets / 9 members; both_under_min: 2) |
| B3 | Taste on standardized fingerprints | 0.715 (0.584 to 0.848) | +0.105 (+0.025 to +0.202) | 0.135 | 6 of 9 | -0.030 (-0.119 to +0.069) | -0.178 (-0.302 to -0.062) | 0.005 (0.000 to 0.016) | 0.047 (0.000 to 0.121) | 0.673 (0.559 to 0.793) | 0.581 (0.511 to 0.668) | 0.573 (0.522 to 0.628) (66 targets / 9 members; both_under_min: 2) |
| B4 | Consensus with offset and slope per member | 0.605 (0.512 to 0.716) | -0.005 (-0.101 to +0.077) | 0.135 | 6 of 9 | -0.140 (-0.190 to -0.095) | -0.289 (-0.420 to -0.147) | 0.003 (0.000 to 0.008) | 0.003 (0.000 to 0.008) | 0.345 (0.274 to 0.412) | 0.619 (0.544 to 0.715) | 0.480 (0.423 to 0.541) (66 targets / 9 members; both_under_min: 2) |
| B5 | Pooled predictor, personal weights on | 0.624 (0.514 to 0.734) | +0.014 (-0.046 to +0.080) | 0.098 | 5 of 9 | -0.121 (-0.193 to -0.043) | -0.270 (-0.409 to -0.138) | 0.000 (0.000 to 0.000) | 0.003 (0.000 to 0.008) | 0.436 (0.346 to 0.536) | 0.607 (0.528 to 0.703) | 0.493 (0.418 to 0.577) (66 targets / 9 members; both_under_min: 2) |
| BP | Vote count | 0.893 (0.820 to 0.960) | +0.284 (+0.178 to +0.382) | 0.155 | 8 of 9 | +0.149 (+0.042 to +0.250) | reference | 0.139 (0.000 to 0.361) | 0.139 (0.000 to 0.361) | 0.866 (0.776 to 0.950) | 0.609 (0.566 to 0.667) | 0.655 (0.597 to 0.729) (66 targets / 9 members; both_under_min: 2) |

Equally well-rated, equally popular and both, against B2; then the guards. The members' own rated and added titles are 0.448 shows and 0.117 animation. Later skips: the mean percentile of the titles skipped or marked Not interested after the cutoff (lower is better). Want to See against Skip: the chance a target ranks above such a title, a stand-in.

| Rung | Equally well-rated against B2 | Equally popular against B2 | Both against B2 | Shows against own mix | Animation against own mix | Most from one franchise | Median vote count | Later skips | Want to See against Skip (stand-in) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | -0.039 (-0.119 to +0.020) | +0.050 (-0.035 to +0.110) | -0.048 (-0.117 to +0.000) (66 targets / 9 members; both_under_min: 2) | +0.259 (+0.095 to +0.416) | +0.132 (+0.020 to +0.220) | 1.0 | 12,636 | 0.815 (0.696 to 0.917) | 0.362 (0.177 to 0.544) |
| B2 | reference | reference | reference (66 targets / 9 members; both_under_min: 2) | -0.114 (-0.253 to +0.046) | +0.052 (-0.020 to +0.136) | 1.3 | 6,694 | 0.604 (0.486 to 0.749) | 0.443 (0.253 to 0.622) |
| B3 | +0.073 (-0.009 to +0.170) | +0.012 (-0.025 to +0.047) | -0.012 (-0.056 to +0.032) (66 targets / 9 members; both_under_min: 2) | -0.070 (-0.191 to +0.052) | +0.152 (+0.051 to +0.278) | 1.9 | 105,084 | 0.733 (0.556 to 0.910) | 0.380 (0.200 to 0.547) |
| B4 | -0.256 (-0.359 to -0.163) | +0.050 (-0.013 to +0.105) | -0.104 (-0.189 to -0.022) (66 targets / 9 members; both_under_min: 2) | -0.299 (-0.506 to -0.119) | -0.026 (-0.116 to +0.054) | 2.3 | 5,074 | 0.667 (0.553 to 0.784) | 0.403 (0.247 to 0.528) |
| B5 | -0.165 (-0.263 to -0.078) | +0.038 (+0.015 to +0.065) | -0.091 (-0.198 to -0.004) (66 targets / 9 members; both_under_min: 2) | -0.279 (-0.483 to -0.106) | +0.197 (+0.006 to +0.390) | 1.8 | 27,118 | 0.641 (0.498 to 0.787) | 0.432 (0.258 to 0.608) |
| BP | +0.265 (+0.110 to +0.395) | +0.040 (-0.078 to +0.153) | +0.071 (-0.043 to +0.169) (66 targets / 9 members; both_under_min: 2) | -0.416 (-0.594 to -0.253) | -0.072 (-0.174 to +0.009) | 3.4 | 1,627,490 | 0.918 (0.859 to 0.972) | 0.565 (0.340 to 0.792) |

The owner alone: 87 targets in 59 add sittings, 29 titles skipped after the cutoff. Plain figures; an interval over add sittings only where there are 10 or more and none holds more than a quarter of the targets; beside it the figure with whole franchises drawn again (86 units).

| Rung | Percentile | Interval over sittings | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP | Equally well-rated | Equally popular | Both | First 50 | First 200 | Later skips | Want to See against Skip |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.779 | +0.721 to +0.831 | +0.733 to +0.821 | +0.183 | +0.128 to +0.241 | reference | -0.100 | 0.567 | 0.706 | 0.524 (81 targets / 1 members; both_under_min: 6) | 0.034 | 0.046 | 0.789 | 0.506 |
| B2 | 0.596 | +0.542 to +0.653 | +0.538 to +0.653 | reference |  | -0.183 | -0.283 | 0.566 | 0.603 | 0.537 (81 targets / 1 members; both_under_min: 6) | 0.000 | 0.011 | 0.597 | 0.510 |
| B3 | 0.790 | +0.737 to +0.844 | +0.741 to +0.837 | +0.195 | +0.149 to +0.240 | +0.012 | -0.088 | 0.715 | 0.709 | 0.616 (81 targets / 1 members; both_under_min: 6) | 0.046 | 0.115 | 0.732 | 0.549 |
| B4 | 0.668 | +0.619 to +0.714 | +0.617 to +0.718 | +0.072 | +0.014 to +0.135 | -0.111 | -0.211 | 0.471 | 0.695 | 0.552 (81 targets / 1 members; both_under_min: 6) | 0.000 | 0.011 | 0.476 | 0.740 |
| B5 | 0.667 | +0.614 to +0.720 | +0.621 to +0.713 | +0.071 | +0.018 to +0.124 | -0.112 | -0.212 | 0.401 | 0.693 | 0.524 (81 targets / 1 members; both_under_min: 6) | 0.000 | 0.000 | 0.569 | 0.639 |
| BP | 0.879 | +0.831 to +0.923 | +0.841 to +0.912 | +0.283 | +0.223 to +0.345 | +0.100 | reference | 0.855 | 0.584 | 0.618 (81 targets / 1 members; both_under_min: 6) | 0.057 | 0.080 | 0.966 | 0.301 |

## Split by entry order, other members as of the pull

9 members other than the owner, 68 targets (of 306 adds; 5 later adds outside the universe and 8 already touched before the cutoff were dropped). About 60,587 titles in a list. 6 members have 3 or more titles skipped or marked Not interested after the cutoff (288 such titles). Titles touched before the cutoff found in any list: 0; in a first 50: 0.

| Rung | Scorer | Percentile | Against B2 | Smallest detectable | Members improved | Against B1 | Against BP | First 50 | First 200 | Equally well-rated | Equally popular | Both |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | GoodWatch score | 0.745 (0.665 to 0.835) | +0.135 (+0.050 to +0.208) | 0.119 | 8 of 9 | reference | -0.149 (-0.250 to -0.042) | 0.037 (0.000 to 0.111) | 0.077 (0.000 to 0.225) | 0.562 (0.514 to 0.629) | 0.619 (0.539 to 0.726) | 0.536 (0.485 to 0.612) (66 targets / 9 members; both_under_min: 2) |
| B2 | Today's taste | 0.610 (0.531 to 0.703) | reference |  |  | -0.135 (-0.208 to -0.050) | -0.284 (-0.382 to -0.178) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.600 (0.516 to 0.701) | 0.569 (0.493 to 0.665) | 0.584 (0.508 to 0.676) (66 targets / 9 members; both_under_min: 2) |
| B3 | Taste on standardized fingerprints | 0.715 (0.584 to 0.848) | +0.105 (+0.025 to +0.202) | 0.135 | 6 of 9 | -0.030 (-0.119 to +0.069) | -0.178 (-0.302 to -0.062) | 0.005 (0.000 to 0.016) | 0.047 (0.000 to 0.121) | 0.673 (0.559 to 0.793) | 0.581 (0.511 to 0.668) | 0.573 (0.522 to 0.628) (66 targets / 9 members; both_under_min: 2) |
| B4 | Consensus with offset and slope per member | 0.609 (0.520 to 0.704) | -0.001 (-0.100 to +0.089) | 0.144 | 4 of 9 | -0.136 (-0.200 to -0.076) | -0.285 (-0.415 to -0.160) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.391 (0.312 to 0.463) | 0.613 (0.545 to 0.689) | 0.512 (0.441 to 0.582) (66 targets / 9 members; both_under_min: 2) |
| B5 | Pooled predictor, personal weights on | 0.635 (0.528 to 0.737) | +0.026 (-0.047 to +0.102) | 0.115 | 5 of 9 | -0.109 (-0.190 to -0.023) | -0.258 (-0.396 to -0.135) | 0.000 (0.000 to 0.000) | 0.000 (0.000 to 0.000) | 0.470 (0.378 to 0.568) | 0.615 (0.535 to 0.700) | 0.519 (0.448 to 0.601) (66 targets / 9 members; both_under_min: 2) |
| BP | Vote count | 0.893 (0.820 to 0.960) | +0.284 (+0.178 to +0.382) | 0.155 | 8 of 9 | +0.149 (+0.042 to +0.250) | reference | 0.139 (0.000 to 0.361) | 0.139 (0.000 to 0.361) | 0.866 (0.776 to 0.950) | 0.609 (0.566 to 0.667) | 0.655 (0.597 to 0.729) (66 targets / 9 members; both_under_min: 2) |

Equally well-rated, equally popular and both, against B2; then the guards. The members' own rated and added titles are 0.448 shows and 0.117 animation. Later skips: the mean percentile of the titles skipped or marked Not interested after the cutoff (lower is better). Want to See against Skip: the chance a target ranks above such a title, a stand-in.

| Rung | Equally well-rated against B2 | Equally popular against B2 | Both against B2 | Shows against own mix | Animation against own mix | Most from one franchise | Median vote count | Later skips | Want to See against Skip (stand-in) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | -0.039 (-0.119 to +0.020) | +0.050 (-0.035 to +0.110) | -0.048 (-0.117 to +0.000) (66 targets / 9 members; both_under_min: 2) | +0.259 (+0.095 to +0.416) | +0.132 (+0.020 to +0.220) | 1.0 | 12,636 | 0.815 (0.696 to 0.917) | 0.362 (0.177 to 0.544) |
| B2 | reference | reference | reference (66 targets / 9 members; both_under_min: 2) | -0.114 (-0.253 to +0.046) | +0.052 (-0.020 to +0.136) | 1.3 | 6,694 | 0.604 (0.486 to 0.749) | 0.443 (0.253 to 0.622) |
| B3 | +0.073 (-0.009 to +0.170) | +0.012 (-0.025 to +0.047) | -0.012 (-0.056 to +0.032) (66 targets / 9 members; both_under_min: 2) | -0.070 (-0.191 to +0.052) | +0.152 (+0.051 to +0.278) | 1.9 | 105,084 | 0.733 (0.556 to 0.910) | 0.380 (0.200 to 0.547) |
| B4 | -0.210 (-0.328 to -0.096) | +0.045 (-0.014 to +0.097) | -0.073 (-0.172 to +0.012) (66 targets / 9 members; both_under_min: 2) | -0.443 (-0.612 to -0.291) | -0.037 (-0.131 to +0.040) | 3.0 | 3,426 | 0.655 (0.522 to 0.788) | 0.383 (0.235 to 0.507) |
| B5 | -0.130 (-0.239 to -0.037) | +0.046 (+0.007 to +0.085) | -0.065 (-0.170 to +0.026) (66 targets / 9 members; both_under_min: 2) | -0.396 (-0.567 to -0.239) | +0.143 (-0.036 to +0.325) | 1.9 | 3,939 | 0.626 (0.486 to 0.772) | 0.485 (0.321 to 0.644) |
| BP | +0.265 (+0.110 to +0.395) | +0.040 (-0.078 to +0.153) | +0.071 (-0.043 to +0.169) (66 targets / 9 members; both_under_min: 2) | -0.416 (-0.594 to -0.253) | -0.072 (-0.174 to +0.009) | 3.4 | 1,627,490 | 0.918 (0.859 to 0.972) | 0.565 (0.340 to 0.792) |

The owner alone: 87 targets in 59 add sittings, 29 titles skipped after the cutoff. Plain figures; an interval over add sittings only where there are 10 or more and none holds more than a quarter of the targets; beside it the figure with whole franchises drawn again (86 units).

| Rung | Percentile | Interval over sittings | Franchises drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP | Equally well-rated | Equally popular | Both | First 50 | First 200 | Later skips | Want to See against Skip |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 0.779 | +0.721 to +0.831 | +0.733 to +0.821 | +0.183 | +0.128 to +0.241 | reference | -0.100 | 0.567 | 0.706 | 0.524 (81 targets / 1 members; both_under_min: 6) | 0.034 | 0.046 | 0.789 | 0.506 |
| B2 | 0.596 | +0.542 to +0.653 | +0.538 to +0.653 | reference |  | -0.183 | -0.283 | 0.566 | 0.603 | 0.537 (81 targets / 1 members; both_under_min: 6) | 0.000 | 0.011 | 0.597 | 0.510 |
| B3 | 0.790 | +0.737 to +0.844 | +0.741 to +0.837 | +0.195 | +0.149 to +0.240 | +0.012 | -0.088 | 0.715 | 0.709 | 0.616 (81 targets / 1 members; both_under_min: 6) | 0.046 | 0.115 | 0.732 | 0.549 |
| B4 | 0.631 | +0.592 to +0.668 | +0.591 to +0.671 | +0.035 | -0.024 to +0.095 | -0.148 | -0.248 | 0.433 | 0.665 | 0.504 (81 targets / 1 members; both_under_min: 6) | 0.000 | 0.000 | 0.492 | 0.693 |
| B5 | 0.657 | +0.605 to +0.711 | +0.613 to +0.700 | +0.061 | +0.007 to +0.116 | -0.122 | -0.222 | 0.413 | 0.680 | 0.516 (81 targets / 1 members; both_under_min: 6) | 0.000 | 0.000 | 0.579 | 0.608 |
| BP | 0.879 | +0.831 to +0.923 | +0.841 to +0.912 | +0.283 | +0.223 to +0.345 | +0.100 | reference | 0.855 | 0.584 | 0.618 (81 targets / 1 members; both_under_min: 6) | 0.057 | 0.080 | 0.966 | 0.301 |

## Runs

| Rung | Split | Others | Run | References | Seconds | Peak memory, MB | Predictor sha256 |
|---|---|---|---|---|---:|---:|---|
| B1 | sitting | before | `20261014T065717-7d38ea9d-0af7` | B2 (stored), BP (stored) | 1.3 | 153.0 | `7d38ea9da5c20bf2` |
| B2 | sitting | before | `20261014T065713-0a3aacc3-3282` | B1, BP | 4.0 | 151.6 | `0a3aacc3ade1854f` |
| B3 | sitting | before | `20261014T065719-df4894a6-7069` | B2 (stored), B1 (stored), BP (stored) | 5.9 | 168.9 | `df4894a692d6c43c` |
| B4 | sitting | before | `20261014T065726-566d1e29-611d` | B2 (stored), B1 (stored), BP (stored) | 9.2 | 270.2 | `566d1e29bcf39744` |
| B5 | sitting | before | `20261014T065735-d288d6bc-9327` | B2 (stored), B1 (stored), BP (stored) | 12.6 | 270.2 | `d288d6bc9ddf52ec` |
| BP | sitting | before | `20261014T065718-e0711083-4fe4` | B2 (stored), B1 (stored) | 0.9 | 150.2 | `e0711083be2fd06f` |
| B1 | sitting | all | `20261014T065915-7d38ea9d-6dc6` | B2 (stored), BP (stored) | 1.8 | 152.6 | `7d38ea9da5c20bf2` |
| B2 | sitting | all | `20261014T065909-0a3aacc3-3fd8` | B1, BP | 5.6 | 153.0 | `0a3aacc3ade1854f` |
| B3 | sitting | all | `20261014T065919-df4894a6-a984` | B2 (stored), B1 (stored), BP (stored) | 4.0 | 169.1 | `df4894a692d6c43c` |
| B4 | sitting | all | `20261014T065923-566d1e29-4b85` | B2 (stored), B1 (stored), BP (stored) | 15.8 | 270.9 | `566d1e29bcf39744` |
| B5 | sitting | all | `20261014T065939-d288d6bc-655e` | B2 (stored), B1 (stored), BP (stored) | 17.5 | 271.0 | `d288d6bc9ddf52ec` |
| BP | sitting | all | `20261014T065917-e0711083-96b8` | B2 (stored), B1 (stored) | 1.5 | 150.5 | `e0711083be2fd06f` |
| B1 | order | before | `20261014T065759-7d38ea9d-60bd` | B2 (stored), BP (stored) | 3.0 | 154.4 | `7d38ea9da5c20bf2` |
| B2 | order | before | `20261014T065748-0a3aacc3-daa7` | B1, BP | 10.4 | 154.7 | `0a3aacc3ade1854f` |
| B3 | order | before | `20261014T065806-df4894a6-51c3` | B2 (stored), B1 (stored), BP (stored) | 9.3 | 169.1 | `df4894a692d6c43c` |
| B4 | order | before | `20261014T065816-566d1e29-7ae0` | B2 (stored), B1 (stored), BP (stored) | 15.1 | 270.7 | `566d1e29bcf39744` |
| B5 | order | before | `20261014T065831-d288d6bc-2d0e` | B2 (stored), B1 (stored), BP (stored) | 36.1 | 270.7 | `d288d6bc9ddf52ec` |
| BP | order | before | `20261014T065802-e0711083-da8b` | B2 (stored), B1 (stored) | 3.2 | 152.2 | `e0711083be2fd06f` |
| B1 | order | all | `20261014T070006-7d38ea9d-55ae` | B2 (stored), BP (stored) | 5.0 | 154.9 | `7d38ea9da5c20bf2` |
| B2 | order | all | `20261014T065957-0a3aacc3-126d` | B1, BP | 8.3 | 153.6 | `0a3aacc3ade1854f` |
| B3 | order | all | `20261014T070015-df4894a6-546b` | B2 (stored), B1 (stored), BP (stored) | 8.9 | 169.4 | `df4894a692d6c43c` |
| B4 | order | all | `20261014T070024-566d1e29-ebf3` | B2 (stored), B1 (stored), BP (stored) | 29.0 | 270.9 | `566d1e29bcf39744` |
| B5 | order | all | `20261014T070053-d288d6bc-bd1f` | B2 (stored), B1 (stored), BP (stored) | 26.9 | 271.0 | `d288d6bc9ddf52ec` |
| BP | order | all | `20261014T070011-e0711083-d43c` | B2 (stored), B1 (stored) | 3.6 | 152.4 | `e0711083be2fd06f` |
