# Item 005 explore results

Candidates were frozen before the first real-pack result; each ran once on T1, T2a and both T2b splits.
T1/T2a use others=all; T2b uses others=before. B2 is primary; B1 and B5 are further references.
All intervals are 95%, with 10,000 draws and seed 20261013. Others resample members.
Owner T1/T2a intervals over sittings are unavailable (largest sitting is 39%/34%); franchise intervals below are a sensitivity check, not uncertainty about future ratings. Owner T2b has sitting intervals.
T1 compares candidate scores with B2 plus its calibrator, so the error comparison is not like for like.
T2b keeps only 3 others (sitting) or 9 (order); it cannot support a population claim.

## Primary measures and paired differences

| Candidate | Task | Others: value | vs B2 | SDE vs B2 | vs B1 | vs B5 | Owner: value | vs B2 | vs B2, franchises | vs B1 | vs B5 | vs B5, franchises |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c1_rated.py | T1 | 1.352175 (1.201612 to 1.519421) | -0.106563 (-0.192055 to -0.023498) | 0.120225 | -0.119993 (-0.178408 to -0.059511) | +0.000744 (-0.006060 to +0.007338) | 0.846847 | -0.228228 | -0.228228 (-0.281166 to -0.174948) | -0.161161 (-0.215744 to -0.105867) | -0.005005 | -0.005005 (-0.016194 to +0.005911) |
| c1_rated.py | T2a | 0.224131 (0.167405 to 0.279064) | +0.089789 (+0.047545 to +0.130329) | 0.061067 | +0.138576 (+0.093232 to +0.184001) | -0.042914 (-0.064848 to -0.021417) | 0.453985 | +0.233048 | +0.233048 (+0.176751 to +0.291363) | +0.073069 (+0.038812 to +0.106627) | +0.002546 | +0.002546 (-0.013837 to +0.019773) |
| c1_rated.py | T2b sitting | 0.779645 (0.731432 to 0.815544) | +0.270577 (+0.148323 to +0.371451) | 0.182923 | +0.028924 (-0.032960 to +0.143927) | +0.086727 (+0.052017 to +0.133116) | 0.759213 (0.706581 to 0.811222) | +0.157331 (+0.098692 to +0.217109) | +0.157331 (+0.104065 to +0.210083) | -0.008066 (-0.054947 to +0.036270) | +0.106336 (+0.087434 to +0.126903) | +0.106336 (+0.088145 to +0.125116) |
| c1_rated.py | T2b order | 0.721541 (0.629144 to 0.818062) | +0.111799 (+0.063121 to +0.173888) | 0.085218 | -0.023211 (-0.067108 to +0.043929) | +0.097987 (+0.059836 to +0.138512) | 0.769082 (0.717508 to 0.818845) | +0.173470 (+0.118202 to +0.229060) | +0.173470 (+0.123008 to +0.223923) | -0.009549 (-0.049822 to +0.029491) | +0.102448 (+0.085021 to +0.121143) | +0.102448 (+0.084948 to +0.120371) |
| c2_clipped.py | T1 | 1.357933 (1.206307 to 1.526440) | -0.100804 (-0.182650 to -0.019653) | 0.116405 | -0.114235 (-0.172998 to -0.054131) | +0.006502 (-0.002700 to +0.016346) | 0.844845 | -0.230230 | -0.230230 (-0.283115 to -0.176876) | -0.163163 (-0.217523 to -0.108280) | -0.007007 | -0.007007 (-0.021718 to +0.007247) |
| c2_clipped.py | T2a | 0.223014 (0.166504 to 0.277531) | +0.088672 (+0.046675 to +0.128914) | 0.060295 | +0.137459 (+0.091861 to +0.182956) | -0.044031 (-0.066923 to -0.022155) | 0.449417 | +0.228480 | +0.228480 (+0.172101 to +0.287152) | +0.068501 (+0.033886 to +0.102340) | -0.002022 | -0.002022 (-0.019838 to +0.016704) |
| c2_clipped.py | T2b sitting | 0.756695 (0.715061 to 0.813571) | +0.247627 (+0.158343 to +0.369478) | 0.176744 | +0.005974 (-0.026168 to +0.067030) | +0.063777 (-0.024880 to +0.131143) | 0.762590 (0.710816 to 0.813896) | +0.160708 (+0.102597 to +0.219942) | +0.160708 (+0.107837 to +0.213197) | -0.004689 (-0.051063 to +0.039382) | +0.109714 (+0.091563 to +0.129670) | +0.109714 (+0.092197 to +0.127803) |
| c2_clipped.py | T2b order | 0.726795 (0.639482 to 0.819919) | +0.117053 (+0.073389 to +0.174279) | 0.078604 | -0.017957 (-0.058524 to +0.047687) | +0.103241 (+0.059540 to +0.150135) | 0.776951 (0.725984 to 0.826030) | +0.181338 (+0.126807 to +0.236001) | +0.181338 (+0.131265 to +0.231380) | -0.001680 (-0.041724 to +0.037129) | +0.110317 (+0.093193 to +0.128418) | +0.110317 (+0.093003 to +0.127852) |
| c3_average.py | T1 | 1.352175 (1.201612 to 1.519421) | -0.106563 (-0.192055 to -0.023498) | 0.120225 | -0.119993 (-0.178408 to -0.059511) | +0.000744 (-0.006060 to +0.007338) | 0.846847 | -0.228228 | -0.228228 (-0.281166 to -0.174948) | -0.161161 (-0.215744 to -0.105867) | -0.005005 | -0.005005 (-0.016194 to +0.005911) |
| c3_average.py | T2a | 0.183300 (0.127690 to 0.239081) | +0.048958 (+0.011748 to +0.082603) | 0.052035 | +0.097746 (+0.051322 to +0.145197) | -0.083744 (-0.111817 to -0.054943) | 0.452757 | +0.231819 | +0.231819 (+0.180169 to +0.286421) | +0.071840 (+0.029452 to +0.112064) | +0.001318 | +0.001318 (-0.029853 to +0.031412) |
| c3_average.py | T2b sitting | 0.800509 (0.765867 to 0.843701) | +0.291442 (+0.182759 to +0.399608) | 0.175378 | +0.049789 (+0.001476 to +0.143927) | +0.107591 (+0.052017 to +0.161273) | 0.801714 (0.746687 to 0.855895) | +0.199832 (+0.147966 to +0.252192) | +0.199832 (+0.150942 to +0.248049) | +0.034436 (-0.010086 to +0.075986) | +0.148838 (+0.120598 to +0.180832) | +0.148838 (+0.121000 to +0.178087) |
| c3_average.py | T2b order | 0.747639 (0.635049 to 0.861162) | +0.137897 (+0.077850 to +0.211405) | 0.101447 | +0.002887 (-0.062027 to +0.078271) | +0.124085 (+0.076066 to +0.181311) | 0.803699 (0.751325 to 0.854938) | +0.208086 (+0.161030 to +0.255397) | +0.208086 (+0.162677 to +0.254505) | +0.025068 (-0.016964 to +0.065307) | +0.137065 (+0.109928 to +0.165336) | +0.137065 (+0.109614 to +0.164690) |

## T2a first-50 guards

Each absolute measure and its paired difference against B2 are reported; owner composition figures are descriptive.

| Candidate | Task | Member group | Guard | Value | vs B2 |
|---|---|---|---|---|---|
| c1_rated.py | T2a | others | first50_high | 0.004637 (0.001580 to 0.008274) | -0.014305 (-0.024403 to -0.005378) |
| c1_rated.py | T2a | others | first50_low | 0.001839 (0.000000 to 0.005004) | +0.000714 (-0.002349 to +0.004411) |
| c1_rated.py | T2a | others | top_shows | 0.122879 (0.098272 to 0.149196) | -0.093360 (-0.128069 to -0.059500) |
| c1_rated.py | T2a | others | top_shows_vs_own | -0.262940 (-0.333945 to -0.194104) | -0.093360 (-0.128069 to -0.059500) |
| c1_rated.py | T2a | others | top_animation | 0.208739 (0.165294 to 0.255421) | +0.007140 (-0.041791 to +0.054963) |
| c1_rated.py | T2a | others | top_animation_vs_own | 0.074421 (0.015846 to 0.133128) | +0.007140 (-0.041791 to +0.054963) |
| c1_rated.py | T2a | others | top_franchise_max | 2.200820 (2.005941 to 2.400737) | +0.726310 (+0.470367 to +0.983818) |
| c1_rated.py | T2a | others | top_votes_median | 9855.074989 (5218.947428 to 18039.912896) | +2805.999838 (-1871.461786 to +10968.778470) |
| c1_rated.py | T2a | owner | first50_high | 0.002494 | +0.002494 |
| c1_rated.py | T2a | owner | first50_low | 0.000000 | +0.000000 |
| c1_rated.py | T2a | owner | top_shows | 0.038800 | -0.081200 |
| c1_rated.py | T2a | owner | top_shows_vs_own | -0.099305 | -0.081200 |
| c1_rated.py | T2a | owner | top_animation | 0.194800 | +0.149200 |
| c1_rated.py | T2a | owner | top_animation_vs_own | 0.037542 | +0.149200 |
| c1_rated.py | T2a | owner | top_franchise_max | 3.860000 | +2.860000 |
| c1_rated.py | T2a | owner | top_votes_median | 4275.360000 | +521.860000 |
| c2_clipped.py | T2a | others | first50_high | 0.013579 (0.007092 to 0.021380) | -0.005363 (-0.014193 to +0.002732) |
| c2_clipped.py | T2a | others | first50_low | 0.001839 (0.000000 to 0.005004) | +0.000714 (-0.002349 to +0.004411) |
| c2_clipped.py | T2a | others | top_shows | 0.257612 (0.219111 to 0.298816) | +0.041373 (-0.005330 to +0.088004) |
| c2_clipped.py | T2a | others | top_shows_vs_own | -0.128207 (-0.205776 to -0.048590) | +0.041373 (-0.005330 to +0.088004) |
| c2_clipped.py | T2a | others | top_animation | 0.247699 (0.194294 to 0.304812) | +0.046100 (-0.009763 to +0.102907) |
| c2_clipped.py | T2a | others | top_animation_vs_own | 0.113382 (0.045620 to 0.181145) | +0.046100 (-0.009763 to +0.102907) |
| c2_clipped.py | T2a | others | top_franchise_max | 1.914322 (1.736161 to 2.093249) | +0.439812 (+0.221595 to +0.650541) |
| c2_clipped.py | T2a | others | top_votes_median | 16164.316411 (10744.458044 to 24327.192966) | +9115.241261 (+3701.128433 to +17269.010902) |
| c2_clipped.py | T2a | owner | first50_high | 0.009975 | +0.009975 |
| c2_clipped.py | T2a | owner | first50_low | 0.000000 | +0.000000 |
| c2_clipped.py | T2a | owner | top_shows | 0.158800 | +0.038800 |
| c2_clipped.py | T2a | owner | top_shows_vs_own | 0.020695 | +0.038800 |
| c2_clipped.py | T2a | owner | top_animation | 0.204000 | +0.158400 |
| c2_clipped.py | T2a | owner | top_animation_vs_own | 0.046742 | +0.158400 |
| c2_clipped.py | T2a | owner | top_franchise_max | 1.000000 | +0.000000 |
| c2_clipped.py | T2a | owner | top_votes_median | 10637.350000 | +6883.850000 |
| c3_average.py | T2a | others | first50_high | 0.075369 (0.057879 to 0.094004) | +0.056428 (+0.041343 to +0.072117) |
| c3_average.py | T2a | others | first50_low | 0.008275 (0.001256 to 0.017511) | +0.007151 (-0.000303 to +0.016665) |
| c3_average.py | T2a | others | top_shows | 0.304061 (0.264333 to 0.343428) | +0.087822 (+0.042246 to +0.133366) |
| c3_average.py | T2a | others | top_shows_vs_own | -0.081758 (-0.156557 to -0.007062) | +0.087822 (+0.042246 to +0.133366) |
| c3_average.py | T2a | others | top_animation | 0.453690 (0.389902 to 0.515436) | +0.252092 (+0.203692 to +0.299827) |
| c3_average.py | T2a | others | top_animation_vs_own | 0.319373 (0.247532 to 0.388089) | +0.252092 (+0.203692 to +0.299827) |
| c3_average.py | T2a | others | top_franchise_max | 2.146336 (1.926190 to 2.374647) | +0.671826 (+0.465424 to +0.881478) |
| c3_average.py | T2a | others | top_votes_median | 58387.269105 (45792.014259 to 72079.280635) | +51338.193954 (+38899.837068 to +64888.370326) |
| c3_average.py | T2a | owner | first50_high | 0.044888 | +0.044888 |
| c3_average.py | T2a | owner | first50_low | 0.000000 | +0.000000 |
| c3_average.py | T2a | owner | top_shows | 0.446000 | +0.326000 |
| c3_average.py | T2a | owner | top_shows_vs_own | 0.307895 | +0.326000 |
| c3_average.py | T2a | owner | top_animation | 0.428800 | +0.383200 |
| c3_average.py | T2a | owner | top_animation_vs_own | 0.271542 | +0.383200 |
| c3_average.py | T2a | owner | top_franchise_max | 1.000000 | +0.000000 |
| c3_average.py | T2a | owner | top_votes_median | 22797.620000 | +19044.120000 |

## T2b first-50 guards

Each absolute measure and its paired difference against B2 are reported; owner composition figures are descriptive.

| Candidate | Task | Member group | Guard | Value | vs B2 |
|---|---|---|---|---|---|
| c1_rated.py | T2b sitting | others | first50 | 0.000000 (0.000000 to 0.000000) | +0.000000 (+0.000000 to +0.000000) |
| c1_rated.py | T2b sitting | others | top_shows | 0.326667 (0.080000 to 0.720000) | +0.060000 (-0.120000 to +0.320000) |
| c1_rated.py | T2b sitting | others | top_shows_vs_own | -0.108801 (-0.375556 to 0.372174) | +0.060000 (-0.120000 to +0.320000) |
| c1_rated.py | T2b sitting | others | top_animation | 0.260000 (0.000000 to 0.700000) | -0.033333 (-0.360000 to +0.360000) |
| c1_rated.py | T2b sitting | others | top_animation_vs_own | 0.092211 (-0.325542 to 0.602174) | -0.033333 (-0.360000 to +0.360000) |
| c1_rated.py | T2b sitting | others | top_franchise_max | 2.000000 (1.000000 to 3.000000) | -0.333333 (-2.000000 to +1.000000) |
| c1_rated.py | T2b sitting | others | top_votes_median | 14935.666667 (2759.500000 to 25505.000000) | +9663.166667 (-1714.000000 to +21459.000000) |
| c1_rated.py | T2b sitting | others | touched_first50 | 0 | n/a |
| c1_rated.py | T2b sitting | others | touched_listed | 0 | n/a |
| c1_rated.py | T2b sitting | others | later_pct | 0.759655 | +0.201847 |
| c1_rated.py | T2b sitting | others | auc | 0.497475 | -0.038889 |
| c1_rated.py | T2b sitting | owner | first50 | 0.000000 | +0.000000 |
| c1_rated.py | T2b sitting | owner | top_shows | 0.180000 | +0.060000 |
| c1_rated.py | T2b sitting | owner | top_shows_vs_own | 0.016512 | +0.060000 |
| c1_rated.py | T2b sitting | owner | top_animation | 0.180000 | +0.140000 |
| c1_rated.py | T2b sitting | owner | top_animation_vs_own | 0.031953 | +0.140000 |
| c1_rated.py | T2b sitting | owner | top_franchise_max | 2.000000 | +1.000000 |
| c1_rated.py | T2b sitting | owner | top_votes_median | 11946.500000 | +8229.500000 |
| c1_rated.py | T2b sitting | owner | touched_first50 | 0 | n/a |
| c1_rated.py | T2b sitting | owner | touched_listed | 0 | n/a |
| c1_rated.py | T2b sitting | owner | later_pct | 0.710866 | +0.113865 |
| c1_rated.py | T2b sitting | owner | auc | 0.567241 | +0.048707 |
| c1_rated.py | T2b order | others | first50 | 0.000000 (0.000000 to 0.000000) | +0.000000 (+0.000000 to +0.000000) |
| c1_rated.py | T2b order | others | top_shows | 0.275556 (0.164444 to 0.400000) | -0.057778 (-0.366722 to +0.217778) |
| c1_rated.py | T2b order | others | top_shows_vs_own | -0.171988 (-0.412028 to 0.037005) | -0.057778 (-0.366722 to +0.217778) |
| c1_rated.py | T2b order | others | top_animation | 0.268889 (0.124444 to 0.440000) | +0.100000 (-0.035556 to +0.237778) |
| c1_rated.py | T2b order | others | top_animation_vs_own | 0.152135 (-0.005006 to 0.332629) | +0.100000 (-0.035556 to +0.237778) |
| c1_rated.py | T2b order | others | top_franchise_max | 1.777778 (1.222222 to 2.555556) | +0.444444 (+0.111111 to +0.888889) |
| c1_rated.py | T2b order | others | top_votes_median | 8843.333333 (5214.297222 to 13406.652778) | +2149.388889 (-3178.333333 to +8120.248611) |
| c1_rated.py | T2b order | others | touched_first50 | 0 | n/a |
| c1_rated.py | T2b order | others | touched_listed | 0 | n/a |
| c1_rated.py | T2b order | others | later_pct | 0.730632 (0.596673 to 0.866619) | +0.126170 (+0.069948 to +0.187588) |
| c1_rated.py | T2b order | others | auc | 0.496800 (0.288889 to 0.681554) | +0.053613 (-0.018088 to +0.144828) |
| c1_rated.py | T2b order | owner | first50 | 0.000000 | +0.000000 |
| c1_rated.py | T2b order | owner | top_shows | 0.440000 | +0.320000 |
| c1_rated.py | T2b order | owner | top_shows_vs_own | 0.280513 | +0.320000 |
| c1_rated.py | T2b order | owner | top_animation | 0.160000 | +0.120000 |
| c1_rated.py | T2b order | owner | top_animation_vs_own | 0.017012 | +0.120000 |
| c1_rated.py | T2b order | owner | top_franchise_max | 1.000000 | +0.000000 |
| c1_rated.py | T2b order | owner | top_votes_median | 11574.000000 | +7857.000000 |
| c1_rated.py | T2b order | owner | touched_first50 | 0 | n/a |
| c1_rated.py | T2b order | owner | touched_listed | 0 | n/a |
| c1_rated.py | T2b order | owner | later_pct | 0.733659 | +0.136447 |
| c1_rated.py | T2b order | owner | auc | 0.572335 | +0.062228 |
| c2_clipped.py | T2b sitting | others | first50 | 0.000000 (0.000000 to 0.000000) | +0.000000 (+0.000000 to +0.000000) |
| c2_clipped.py | T2b sitting | others | top_shows | 0.313333 (0.080000 to 0.740000) | +0.046667 (-0.120000 to +0.340000) |
| c2_clipped.py | T2b sitting | others | top_shows_vs_own | -0.122135 (-0.435556 to 0.392174) | +0.046667 (-0.120000 to +0.340000) |
| c2_clipped.py | T2b sitting | others | top_animation | 0.346667 (0.100000 to 0.700000) | +0.053333 (-0.340000 to +0.360000) |
| c2_clipped.py | T2b sitting | others | top_animation_vs_own | 0.178877 (-0.305542 to 0.602174) | +0.053333 (-0.340000 to +0.360000) |
| c2_clipped.py | T2b sitting | others | top_franchise_max | 2.666667 (2.000000 to 3.000000) | +0.333333 (-2.000000 to +2.000000) |
| c2_clipped.py | T2b sitting | others | top_votes_median | 128442.166667 (8115.000000 to 350115.000000) | +123169.666667 (+817.000000 to +345641.500000) |
| c2_clipped.py | T2b sitting | others | touched_first50 | 0 | n/a |
| c2_clipped.py | T2b sitting | others | touched_listed | 0 | n/a |
| c2_clipped.py | T2b sitting | others | later_pct | 0.765683 | +0.207874 |
| c2_clipped.py | T2b sitting | others | auc | 0.506566 | -0.029798 |
| c2_clipped.py | T2b sitting | owner | first50 | 0.000000 | +0.000000 |
| c2_clipped.py | T2b sitting | owner | top_shows | 0.260000 | +0.140000 |
| c2_clipped.py | T2b sitting | owner | top_shows_vs_own | 0.096512 | +0.140000 |
| c2_clipped.py | T2b sitting | owner | top_animation | 0.180000 | +0.140000 |
| c2_clipped.py | T2b sitting | owner | top_animation_vs_own | 0.031953 | +0.140000 |
| c2_clipped.py | T2b sitting | owner | top_franchise_max | 1.000000 | +0.000000 |
| c2_clipped.py | T2b sitting | owner | top_votes_median | 11419.000000 | +7702.000000 |
| c2_clipped.py | T2b sitting | owner | touched_first50 | 0 | n/a |
| c2_clipped.py | T2b sitting | owner | touched_listed | 0 | n/a |
| c2_clipped.py | T2b sitting | owner | later_pct | 0.736809 | +0.139808 |
| c2_clipped.py | T2b sitting | owner | auc | 0.555603 | +0.037069 |
| c2_clipped.py | T2b order | others | first50 | 0.000000 (0.000000 to 0.000000) | +0.000000 (+0.000000 to +0.000000) |
| c2_clipped.py | T2b order | others | top_shows | 0.208889 (0.113333 to 0.304444) | -0.124444 (-0.280000 to +0.022222) |
| c2_clipped.py | T2b order | others | top_shows_vs_own | -0.238655 (-0.386246 to -0.102627) | -0.124444 (-0.280000 to +0.022222) |
| c2_clipped.py | T2b order | others | top_animation | 0.286667 (0.146667 to 0.455556) | +0.117778 (-0.026667 to +0.266667) |
| c2_clipped.py | T2b order | others | top_animation_vs_own | 0.169913 (0.006699 to 0.354276) | +0.117778 (-0.026667 to +0.266667) |
| c2_clipped.py | T2b order | others | top_franchise_max | 1.888889 (1.222222 to 2.666667) | +0.555556 (-0.111111 to +1.222222) |
| c2_clipped.py | T2b order | others | top_votes_median | 56412.166667 (11873.050000 to 132405.166667) | +49718.222222 (+4059.451389 to +127217.236111) |
| c2_clipped.py | T2b order | others | touched_first50 | 0 | n/a |
| c2_clipped.py | T2b order | others | touched_listed | 0 | n/a |
| c2_clipped.py | T2b order | others | later_pct | 0.737250 (0.608904 to 0.868047) | +0.132788 (+0.079295 to +0.190528) |
| c2_clipped.py | T2b order | others | auc | 0.494961 (0.288889 to 0.681007) | +0.051774 (-0.022292 to +0.144444) |
| c2_clipped.py | T2b order | owner | first50 | 0.000000 | +0.000000 |
| c2_clipped.py | T2b order | owner | top_shows | 0.120000 | +0.000000 |
| c2_clipped.py | T2b order | owner | top_shows_vs_own | -0.039487 | +0.000000 |
| c2_clipped.py | T2b order | owner | top_animation | 0.120000 | +0.080000 |
| c2_clipped.py | T2b order | owner | top_animation_vs_own | -0.022988 | +0.080000 |
| c2_clipped.py | T2b order | owner | top_franchise_max | 1.000000 | +0.000000 |
| c2_clipped.py | T2b order | owner | top_votes_median | 18168.500000 | +14451.500000 |
| c2_clipped.py | T2b order | owner | touched_first50 | 0 | n/a |
| c2_clipped.py | T2b order | owner | touched_listed | 0 | n/a |
| c2_clipped.py | T2b order | owner | later_pct | 0.743868 | +0.146657 |
| c2_clipped.py | T2b order | owner | auc | 0.570353 | +0.060246 |
| c3_average.py | T2b sitting | others | first50 | 0.010101 (0.000000 to 0.030303) | +0.010101 (+0.000000 to +0.030303) |
| c3_average.py | T2b sitting | others | top_shows | 0.333333 (0.180000 to 0.620000) | +0.066667 (-0.020000 to +0.220000) |
| c3_average.py | T2b sitting | others | top_shows_vs_own | -0.102135 (-0.375556 to 0.272174) | +0.066667 (-0.020000 to +0.220000) |
| c3_average.py | T2b sitting | others | top_animation | 0.393333 (0.000000 to 0.780000) | +0.100000 (-0.100000 to +0.440000) |
| c3_average.py | T2b sitting | others | top_animation_vs_own | 0.225544 (-0.005542 to 0.682174) | +0.100000 (-0.100000 to +0.440000) |
| c3_average.py | T2b sitting | others | top_franchise_max | 1.333333 (1.000000 to 2.000000) | -1.000000 (-2.000000 to +0.000000) |
| c3_average.py | T2b sitting | others | top_votes_median | 17786.500000 (2759.500000 to 27492.000000) | +12514.000000 (-1714.000000 to +23446.000000) |
| c3_average.py | T2b sitting | others | touched_first50 | 0 | n/a |
| c3_average.py | T2b sitting | others | touched_listed | 0 | n/a |
| c3_average.py | T2b sitting | others | later_pct | 0.769326 | +0.211517 |
| c3_average.py | T2b sitting | others | auc | 0.493434 | -0.042929 |
| c3_average.py | T2b sitting | owner | first50 | 0.037500 | +0.037500 |
| c3_average.py | T2b sitting | owner | top_shows | 0.480000 | +0.360000 |
| c3_average.py | T2b sitting | owner | top_shows_vs_own | 0.316512 | +0.360000 |
| c3_average.py | T2b sitting | owner | top_animation | 0.420000 | +0.380000 |
| c3_average.py | T2b sitting | owner | top_animation_vs_own | 0.271953 | +0.380000 |
| c3_average.py | T2b sitting | owner | top_franchise_max | 1.000000 | +0.000000 |
| c3_average.py | T2b sitting | owner | top_votes_median | 29947.500000 | +26230.500000 |
| c3_average.py | T2b sitting | owner | touched_first50 | 0 | n/a |
| c3_average.py | T2b sitting | owner | touched_listed | 0 | n/a |
| c3_average.py | T2b sitting | owner | later_pct | 0.743568 | +0.146567 |
| c3_average.py | T2b sitting | owner | auc | 0.581034 | +0.062500 |
| c3_average.py | T2b order | others | first50 | 0.002584 (0.000000 to 0.007752) | +0.002584 (+0.000000 to +0.007752) |
| c3_average.py | T2b order | others | top_shows | 0.328889 (0.251111 to 0.426667) | -0.004444 (-0.182222 to +0.126667) |
| c3_average.py | T2b order | others | top_shows_vs_own | -0.118655 (-0.224299 to 0.010990) | -0.004444 (-0.182222 to +0.126667) |
| c3_average.py | T2b order | others | top_animation | 0.288889 (0.137722 to 0.462222) | +0.120000 (+0.026667 to +0.224444) |
| c3_average.py | T2b order | others | top_animation_vs_own | 0.172135 (0.029949 to 0.343886) | +0.120000 (+0.026667 to +0.224444) |
| c3_average.py | T2b order | others | top_franchise_max | 1.777778 (1.222222 to 2.555556) | +0.444444 (-0.111111 to +1.111111) |
| c3_average.py | T2b order | others | top_votes_median | 36015.555556 (13292.888889 to 63743.129167) | +29321.611111 (+6363.526389 to +56866.611111) |
| c3_average.py | T2b order | others | touched_first50 | 0 | n/a |
| c3_average.py | T2b order | others | touched_listed | 0 | n/a |
| c3_average.py | T2b order | others | later_pct | 0.740662 (0.579184 to 0.902139) | +0.136200 (+0.069614 to +0.211437) |
| c3_average.py | T2b order | others | auc | 0.441461 (0.238889 to 0.621812) | -0.001725 (-0.052713 to +0.058333) |
| c3_average.py | T2b order | owner | first50 | 0.022989 | +0.022989 |
| c3_average.py | T2b order | owner | top_shows | 0.540000 | +0.420000 |
| c3_average.py | T2b order | owner | top_shows_vs_own | 0.380513 | +0.420000 |
| c3_average.py | T2b order | owner | top_animation | 0.420000 | +0.380000 |
| c3_average.py | T2b order | owner | top_animation_vs_own | 0.277012 | +0.380000 |
| c3_average.py | T2b order | owner | top_franchise_max | 1.000000 | +0.000000 |
| c3_average.py | T2b order | owner | top_votes_median | 29947.500000 | +26230.500000 |
| c3_average.py | T2b order | owner | touched_first50 | 0 | n/a |
| c3_average.py | T2b order | owner | touched_listed | 0 | n/a |
| c3_average.py | T2b order | owner | later_pct | 0.757116 | +0.159904 |
| c3_average.py | T2b order | owner | auc | 0.569164 | +0.059057 |

## Ledger lines

| Candidate | Task | Run id | Status | Seconds | Peak MB | Sandbox |
|---|---|---|---|---|---|---|
| c1_rated.py | T1 | 20261014T091952-a55f7c29-4bdd | ok | 26.2 | 247.8 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c1_rated.py | T2a | 20261014T091424-a55f7c29-409b | ok | 291.7 | 281.7 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c1_rated.py | T2b sitting | 20261014T092019-a55f7c29-03eb | ok | 2.8 | 278.0 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c1_rated.py | T2b order | 20261014T092022-a55f7c29-1657 | ok | 7.9 | 278.9 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c2_clipped.py | T1 | 20261014T092030-400d000d-a989 | ok | 26.0 | 248.1 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c2_clipped.py | T2a | 20261014T092108-400d000d-d723 | ok | 321.0 | 281.4 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c2_clipped.py | T2b sitting | 20261014T092056-400d000d-db5b | ok | 5.1 | 278.0 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c2_clipped.py | T2b order | 20261014T092101-400d000d-ae25 | ok | 6.5 | 278.7 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c3_average.py | T1 | 20261014T092629-3bf70829-5eec | ok | 37.1 | 248.6 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c3_average.py | T2a | 20261014T092722-3bf70829-680c | ok | 491.0 | 282.1 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c3_average.py | T2b sitting | 20261014T092706-3bf70829-3ffd | ok | 5.8 | 278.7 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |
| c3_average.py | T2b order | 20261014T092712-3bf70829-d41b | ok | 9.4 | 279.4 | {'attempts': 0, 'examples': [], 'landlock': True, 'namespaces': True, 'net_isolated': True, 'seccomp': True} |

## Candidate tests and frozen code

Three tests passed on synthetic views. C1 versus B5 in a rated-title-dominated T1 view: Spearman rho = 1.000000000. The C1 test also checks rated-row imputation, normalization and deduplication. C2 stays inside the independently computed rated-row 1st/99th percentile bounds, including extreme targets. C3 equals the independent midrank-percentile average (including ties and B3 fallback) and retains C1 score.

Command: `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1 python3 -m pytest docs/research/taste-loop/lab/candidates/005/test_candidates.py -q -s -p no:cacheprovider`.

| Candidate | sha256 |
|---|---|
| c1_rated.py | `a55f7c2915d48464cba4e7a46e286058b5e225bb0a998f85ff37216446d2440e` |
| c2_clipped.py | `400d000d5b3534b9fa84f04cacbe262b01db615059d61e959e23c94c676e7e14` |
| c3_average.py | `3bf7082967d1f21c3dc51dd1c1de55a9bcc247de56404ba4cc64a02e10bf944f` |

## Selection and handback

B3 first-50 loved-title share (others) is 0.089997, from `20261014T070834-df4894a6-85a6`. All three candidates fall below this point estimate; none qualifies. PREREG.md was therefore not written. C3 is closest but its interval overlapping B3 is not the fixed selection rule.

12 explore runs used (brief maximum 14; item budget 20); no registered run, gate look or commit. Candidate code did not change after results. The committed ledger is an unchanged prefix, all runs have full Landlock/seccomp/namespaces/network isolation and zero attempts, and peak run memory is 282.1 MB. The ladder and harness were unchanged. The orchestrator lists the owner top 20; no candidate top listing was run here.
