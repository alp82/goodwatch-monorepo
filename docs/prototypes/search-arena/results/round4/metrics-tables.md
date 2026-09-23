| ranker | dev+ ndcg10 | dev | holdout | Δ vs prod | good10 | bad5 | unj10 | anchor10 | title@1 | Incepton | queries < prod − 0.15 | est. p50 after reading |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| prod | 0.528 | 0.583 | 0.450 | +0.000 | 5.78 | 70 | 0 | 0.162 | 5/6 | #7 | – | 235 ms |
| r3-combo | 0.793 | 0.830 | 0.740 | +0.265 | 8.11 | 19 | 0 | 0.377 | 5/6 | #1 | new-01 -0.630, new-08 -0.218 | 156 ms |
| r3-combo-fast | 0.783 | 0.828 | 0.720 | +0.255 | 8.08 | 22 | 0 | 0.363 | 5/6 | #1 | new-01 -0.813, new-08 -0.231, core-18 -0.212 | 52 ms |
| r4-combo | 0.811 | 0.831 | 0.781 | +0.283 | 8.21 | 17 | 0 | 0.356 | 5/6 | #1 | none | 156 ms |
| r4-combo-fast | 0.796 | 0.821 | 0.761 | +0.268 | 8.21 | 15 | 0 | 0.347 | 5/6 | #1 | none | 57 ms |
| r4-fast-noref | 0.794 | 0.820 | 0.757 | +0.266 | 8.17 | 17 | 0 | 0.347 | 5/6 | #1 | none | 57 ms |
| r4-fast-nocov | 0.784 | 0.824 | 0.726 | +0.255 | 8.11 | 19 | 0 | 0.356 | 5/6 | #1 | new-01 -0.813 | 57 ms |
| r4-fast-bigram1 | 0.799 | 0.824 | 0.762 | +0.270 | 8.21 | 17 | 0 | 0.343 | 5/6 | #1 | core-18 -0.212 | 57 ms |

## ndcg10 by query type (dev+)

| type (queries) | prod | r3-combo | r3-combo-fast | r4-combo | r4-combo-fast | r4-fast-noref | r4-fast-nocov | r4-fast-bigram1 |
|---|---|---|---|---|---|---|---|---|
| audience (4) | 0.386 | 0.851 | 0.847 | 0.842 | 0.834 | 0.834 | 0.834 | 0.834 |
| creator (1) | 0.377 | 0.641 | 0.641 | 0.641 | 0.641 | 0.641 | 0.641 | 0.641 |
| era_genre (2) | 0.356 | 0.933 | 0.933 | 0.933 | 0.936 | 0.936 | 0.936 | 0.933 |
| like_x_but_y (3) | 0.548 | 0.630 | 0.625 | 0.726 | 0.699 | 0.660 | 0.699 | 0.699 |
| long_descriptive (8) | 0.430 | 0.755 | 0.721 | 0.757 | 0.727 | 0.727 | 0.732 | 0.715 |
| negation (6) | 0.573 | 0.824 | 0.827 | 0.837 | 0.831 | 0.831 | 0.826 | 0.837 |
| non_english (7) | 0.453 | 0.760 | 0.760 | 0.760 | 0.760 | 0.760 | 0.760 | 0.760 |
| setting_mood (6) | 0.557 | 0.798 | 0.829 | 0.828 | 0.833 | 0.833 | 0.818 | 0.836 |
| short_vague (7) | 0.510 | 0.770 | 0.768 | 0.764 | 0.762 | 0.762 | 0.762 | 0.762 |
| structural (4) | 0.466 | 0.787 | 0.774 | 0.802 | 0.753 | 0.753 | 0.753 | 0.791 |
| subject_object (12) | 0.713 | 0.820 | 0.789 | 0.862 | 0.837 | 0.837 | 0.783 | 0.839 |
| typo (3) | 0.541 | 0.891 | 0.875 | 0.917 | 0.904 | 0.904 | 0.875 | 0.905 |

## ndcg10 per query vs prod (dev+, sorted by r4-combo-fast − prod)

| query | split | type | prod | r3-combo | r3-combo-fast | r4-combo | r4-combo-fast | r4-fast-noref | r4-fast-nocov | r4-fast-bigram1 |
|---|---|---|---|---|---|---|---|---|---|---|
| lab-04 tense heist thriller, not bleak | dev | negation | 0.801 | 0.743 (-0.06) | 0.780 (-0.02) | 0.697 (-0.10) | 0.657 (-0.14) | 0.657 (-0.14) | 0.772 (-0.03) | 0.698 (-0.10) |
| new-01 heist on a train | holdout | subject_object | 0.861 | 0.231 (-0.63) **LOSS** | 0.048 (-0.81) **LOSS** | 0.786 (-0.07) | 0.777 (-0.08) | 0.777 (-0.08) | 0.048 (-0.81) **LOSS** | 0.777 (-0.08) |
| core-18 Brain’s fried. Something warm and funny, but not | holdout | long_descriptive | 0.698 | 0.553 (-0.14) | 0.486 (-0.21) **LOSS** | 0.622 (-0.08) | 0.616 (-0.08) | 0.616 (-0.08) | 0.616 (-0.08) | 0.486 (-0.21) **LOSS** |
| core-17 Give me car chases, but make it more getaway dri | dev | long_descriptive | 0.801 | 0.827 (+0.03) | 0.780 (-0.02) | 0.754 (-0.05) | 0.733 (-0.07) | 0.733 (-0.07) | 0.778 (-0.02) | 0.737 (-0.06) |
| lab-07 craty | dev | typo | 1.000 | 0.958 (-0.04) | 0.958 (-0.04) | 0.958 (-0.04) | 0.958 (-0.04) | 0.958 (-0.04) | 0.958 (-0.04) | 0.958 (-0.04) |
| new-08 like Breaking Bad but a comedy | holdout | like_x_but_y | 0.708 | 0.490 (-0.22) **LOSS** | 0.477 (-0.23) **LOSS** | 0.751 (+0.04) | 0.673 (-0.03) | 0.580 (-0.13) | 0.673 (-0.03) | 0.673 (-0.03) |
| core-26 Ich suche etwas Spannendes, das mich rätseln läs | dev | non_english | 0.709 | 0.676 (-0.03) | 0.676 (-0.03) | 0.676 (-0.03) | 0.676 (-0.03) | 0.676 (-0.03) | 0.676 (-0.03) | 0.676 (-0.03) |
| core-08 sunglasses | dev | subject_object | 0.651 | 0.761 (+0.11) | 0.625 (-0.03) | 0.761 (+0.11) | 0.625 (-0.03) | 0.625 (-0.03) | 0.625 (-0.03) | 0.625 (-0.03) |
| lab-06 furious | dev | short_vague | 0.945 | 0.962 (+0.02) | 0.962 (+0.02) | 0.924 (-0.02) | 0.924 (-0.02) | 0.924 (-0.02) | 0.924 (-0.02) | 0.924 (-0.02) |
| lab-10 sunglasses at night | dev | subject_object | 0.793 | 0.775 (-0.02) | 0.790 (-0.00) | 0.775 (-0.02) | 0.774 (-0.02) | 0.774 (-0.02) | 0.774 (-0.02) | 0.774 (-0.02) |
| lab-09 scifi with cars | holdout | subject_object | 0.855 | 0.823 (-0.03) | 0.838 (-0.02) | 0.835 (-0.02) | 0.849 (-0.01) | 0.849 (-0.01) | 0.838 (-0.02) | 0.849 (-0.01) |
| core-07 car chases | dev | subject_object | 1.000 | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) |
| new-06 kung fu comedy | holdout | subject_object | 1.000 | 0.958 (-0.04) | 0.960 (-0.04) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 0.960 (-0.04) | 1.000 (+0.00) |
| core-13 I want something tense that keeps me guessing, b | dev | long_descriptive | 0.628 | 0.647 (+0.02) | 0.647 (+0.02) | 0.647 (+0.02) | 0.647 (+0.02) | 0.647 (+0.02) | 0.647 (+0.02) | 0.647 (+0.02) |
| core-09 unreliable narrator | holdout | structural | 0.502 | 0.621 (+0.12) | 0.540 (+0.04) | 0.621 (+0.12) | 0.540 (+0.04) | 0.540 (+0.04) | 0.540 (+0.04) | 0.540 (+0.04) |
| lab-08 melancholy lighthouse keeper mystery | holdout | setting_mood | 0.796 | 0.813 (+0.02) | 0.813 (+0.02) | 0.828 (+0.03) | 0.835 (+0.04) | 0.835 (+0.04) | 0.850 (+0.05) | 0.826 (+0.03) |
| lab-13 time travel complex | dev | structural | 0.877 | 0.916 (+0.04) | 0.955 (+0.08) | 0.916 (+0.04) | 0.917 (+0.04) | 0.917 (+0.04) | 0.917 (+0.04) | 0.955 (+0.08) |
| new-17 mindbending | dev | short_vague | 0.916 | 0.964 (+0.05) | 0.964 (+0.05) | 0.964 (+0.05) | 0.964 (+0.05) | 0.964 (+0.05) | 0.964 (+0.05) | 0.964 (+0.05) |
| core-11 no anime, gritty crime show | dev | negation | 0.945 | 1.000 (+0.05) | 1.000 (+0.05) | 1.000 (+0.05) | 1.000 (+0.05) | 1.000 (+0.05) | 1.000 (+0.05) | 1.000 (+0.05) |
| core-22 time loop | dev | subject_object | 0.934 | 0.960 (+0.03) | 1.000 (+0.07) | 0.960 (+0.03) | 1.000 (+0.07) | 1.000 (+0.07) | 1.000 (+0.07) | 1.000 (+0.07) |
| new-18 wholesome | holdout | short_vague | 0.641 | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) | 0.717 (+0.08) |
| lab-12 like groundhog day | dev | like_x_but_y | 0.684 | 0.852 (+0.17) | 0.852 (+0.17) | 0.779 (+0.09) | 0.776 (+0.09) | 0.852 (+0.17) | 0.776 (+0.09) | 0.776 (+0.09) |
| new-02 two geniuses in a battle of wits | dev | subject_object | 0.674 | 0.826 (+0.15) | 0.816 (+0.14) | 0.832 (+0.16) | 0.780 (+0.11) | 0.780 (+0.11) | 0.823 (+0.15) | 0.733 (+0.06) |
| lab-11 fantasy with dragons | dev | subject_object | 0.845 | 0.864 (+0.02) | 0.882 (+0.04) | 0.960 (+0.12) | 0.958 (+0.11) | 0.958 (+0.11) | 0.872 (+0.03) | 0.958 (+0.11) |
| core-30 spannend aber nicht düster | dev | non_english | 0.631 | 0.754 (+0.12) | 0.754 (+0.12) | 0.754 (+0.12) | 0.754 (+0.12) | 0.754 (+0.12) | 0.754 (+0.12) | 0.754 (+0.12) |
| core-24 a hopeful space adventure without horror | holdout | negation | 0.856 | 0.879 (+0.02) | 0.858 (+0.00) | 1.000 (+0.14) | 1.000 (+0.14) | 1.000 (+0.14) | 0.858 (+0.00) | 1.000 (+0.14) |
| core-06 tense but not bleak | dev | negation | 0.604 | 0.765 (+0.16) | 0.765 (+0.16) | 0.765 (+0.16) | 0.765 (+0.16) | 0.765 (+0.16) | 0.765 (+0.16) | 0.765 (+0.16) |
| core-28 Des gens riches qui se comportent horriblement e | holdout | non_english | 0.276 | 0.441 (+0.16) | 0.441 (+0.16) | 0.441 (+0.16) | 0.441 (+0.16) | 0.441 (+0.16) | 0.441 (+0.16) | 0.441 (+0.16) |
| lab-03 slow burn space horror | dev | setting_mood | 0.218 | 0.428 (+0.21) | 0.430 (+0.21) | 0.429 (+0.21) | 0.435 (+0.22) | 0.435 (+0.22) | 0.428 (+0.21) | 0.435 (+0.22) |
| new-04 quiet and lonely in deep space | dev | setting_mood | 0.765 | 1.000 (+0.23) | 1.000 (+0.23) | 1.000 (+0.23) | 1.000 (+0.23) | 1.000 (+0.23) | 1.000 (+0.23) | 1.000 (+0.23) |
| lab-00 complete nonsense | dev | short_vague | 0.439 | 0.691 (+0.25) | 0.675 (+0.24) | 0.688 (+0.25) | 0.675 (+0.24) | 0.675 (+0.24) | 0.675 (+0.24) | 0.675 (+0.24) |
| lab-01 tarkovsky | dev | creator | 0.377 | 0.641 (+0.26) | 0.641 (+0.26) | 0.641 (+0.26) | 0.641 (+0.26) | 0.641 (+0.26) | 0.641 (+0.26) | 0.641 (+0.26) |
| new-20 An ordinary guy slowly realises his whole life i | holdout | long_descriptive | 0.343 | 0.793 (+0.45) | 0.632 (+0.29) | 0.793 (+0.45) | 0.632 (+0.29) | 0.632 (+0.29) | 0.632 (+0.29) | 0.632 (+0.29) |
| core-23 slow atmospheric science fiction | dev | setting_mood | 0.672 | 0.960 (+0.29) | 1.000 (+0.33) | 0.960 (+0.29) | 0.964 (+0.29) | 0.964 (+0.29) | 0.964 (+0.29) | 1.000 (+0.33) |
| new-03 satire about politics or big corporations | holdout | subject_object | 0.567 | 0.899 (+0.33) | 0.901 (+0.33) | 0.875 (+0.31) | 0.859 (+0.29) | 0.859 (+0.29) | 0.901 (+0.33) | 0.859 (+0.29) |
| core-27 Quiero una serie policial realista y cruda, sin  | dev | non_english | 0.645 | 0.946 (+0.30) | 0.946 (+0.30) | 0.946 (+0.30) | 0.946 (+0.30) | 0.946 (+0.30) | 0.946 (+0.30) | 0.946 (+0.30) |
| new-14 good first anime for someone who never watched a | holdout | audience | 0.276 | 0.625 (+0.35) | 0.603 (+0.33) | 0.625 (+0.35) | 0.589 (+0.31) | 0.589 (+0.31) | 0.589 (+0.31) | 0.589 (+0.31) |
| new-13 smart sci-fi for adults | dev | audience | 0.616 | 0.940 (+0.32) | 0.945 (+0.33) | 0.940 (+0.32) | 0.945 (+0.33) | 0.945 (+0.33) | 0.945 (+0.33) | 0.945 (+0.33) |
| core-21 funny | dev | short_vague | 0.183 | 0.517 (+0.33) | 0.517 (+0.33) | 0.517 (+0.33) | 0.517 (+0.33) | 0.517 (+0.33) | 0.517 (+0.33) | 0.517 (+0.33) |
| new-05 rainy neon cyberpunk city | holdout | setting_mood | 0.473 | 0.698 (+0.22) | 0.782 (+0.31) | 0.798 (+0.32) | 0.811 (+0.34) | 0.811 (+0.34) | 0.712 (+0.24) | 0.811 (+0.34) |
| lab-05 grief after losing a child | holdout | subject_object | 0.300 | 0.866 (+0.57) | 0.770 (+0.47) | 0.779 (+0.48) | 0.655 (+0.35) | 0.655 (+0.35) | 0.723 (+0.42) | 0.732 (+0.43) |
| new-09 80s sci-fi action | dev | era_genre | 0.595 | 0.946 (+0.35) | 0.946 (+0.35) | 0.946 (+0.35) | 0.951 (+0.36) | 0.951 (+0.36) | 0.951 (+0.36) | 0.946 (+0.35) |
| core-16 Something where halfway through you realise the  | holdout | long_descriptive | 0.373 | 0.822 (+0.45) | 0.733 (+0.36) | 0.822 (+0.45) | 0.733 (+0.36) | 0.733 (+0.36) | 0.733 (+0.36) | 0.733 (+0.36) |
| core-25 something short to watch after work | dev | audience | 0.509 | 0.876 (+0.37) | 0.876 (+0.37) | 0.876 (+0.37) | 0.876 (+0.37) | 0.876 (+0.37) | 0.876 (+0.37) | 0.876 (+0.37) |
| new-12 war movie that isn't about World War II | holdout | negation | 0.191 | 0.557 (+0.37) | 0.561 (+0.37) | 0.557 (+0.37) | 0.561 (+0.37) | 0.561 (+0.37) | 0.561 (+0.37) | 0.561 (+0.37) |
| new-07 like The Matrix but anime | dev | like_x_but_y | 0.251 | 0.547 (+0.30) | 0.547 (+0.30) | 0.649 (+0.40) | 0.649 (+0.40) | 0.547 (+0.30) | 0.649 (+0.40) | 0.649 (+0.40) |
| core-29 Kafam çok yorgun. Sıcak ve komik ama aşırı duygu | holdout | non_english | 0.465 | 0.910 (+0.45) | 0.910 (+0.45) | 0.910 (+0.45) | 0.910 (+0.45) | 0.910 (+0.45) | 0.910 (+0.45) | 0.910 (+0.45) |
| new-16 whole movie takes place in one room | holdout | structural | 0.242 | 0.661 (+0.42) | 0.728 (+0.49) | 0.720 (+0.48) | 0.718 (+0.48) | 0.718 (+0.48) | 0.718 (+0.48) | 0.793 (+0.55) |
| core-20 bleak | holdout | short_vague | 0.190 | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) | 0.665 (+0.48) |
| new-21 un dessin animé drôle pour toute la famille | dev | non_english | 0.251 | 0.751 (+0.50) | 0.751 (+0.50) | 0.751 (+0.50) | 0.751 (+0.50) | 0.751 (+0.50) | 0.751 (+0.50) | 0.751 (+0.50) |
| lab-02 feel good cooking show | dev | setting_mood | 0.415 | 0.888 (+0.47) | 0.946 (+0.53) | 0.951 (+0.54) | 0.951 (+0.54) | 0.951 (+0.54) | 0.951 (+0.54) | 0.946 (+0.53) |
| new-23 psycological thriler with a big twist | holdout | typo | 0.406 | 0.921 (+0.51) | 0.874 (+0.47) | 1.000 (+0.59) | 0.960 (+0.55) | 0.960 (+0.55) | 0.874 (+0.47) | 0.962 (+0.56) |
| new-19 A crew of misfits on a beat-up spaceship taking  | dev | long_descriptive | 0.103 | 0.706 (+0.60) | 0.678 (+0.57) | 0.721 (+0.62) | 0.666 (+0.56) | 0.666 (+0.56) | 0.666 (+0.56) | 0.678 (+0.57) |
| core-04 Incepton | dev | typo | 0.216 | 0.794 (+0.58) | 0.794 (+0.58) | 0.794 (+0.58) | 0.794 (+0.58) | 0.794 (+0.58) | 0.794 (+0.58) | 0.794 (+0.58) |
| new-15 nonlinear storytelling | dev | structural | 0.241 | 0.951 (+0.71) | 0.874 (+0.63) | 0.951 (+0.71) | 0.836 (+0.60) | 0.836 (+0.60) | 0.836 (+0.60) | 0.874 (+0.63) |
| core-19 cozy | dev | short_vague | 0.253 | 0.874 (+0.62) | 0.874 (+0.62) | 0.874 (+0.62) | 0.874 (+0.62) | 0.874 (+0.62) | 0.874 (+0.62) | 0.874 (+0.62) |
| core-14 Rich people being absolutely awful to each other | holdout | long_descriptive | 0.161 | 0.691 (+0.53) | 0.810 (+0.65) | 0.701 (+0.54) | 0.785 (+0.62) | 0.785 (+0.62) | 0.785 (+0.62) | 0.810 (+0.65) |
| new-22 Antikriegsfilm, der zeigt, wie sinnlos Krieg ist | holdout | non_english | 0.193 | 0.845 (+0.65) | 0.845 (+0.65) | 0.845 (+0.65) | 0.845 (+0.65) | 0.845 (+0.65) | 0.845 (+0.65) | 0.845 (+0.65) |
| core-15 A crime show that feels grubby and real. No anim | dev | long_descriptive | 0.335 | 1.000 (+0.66) | 1.000 (+0.66) | 1.000 (+0.66) | 1.000 (+0.66) | 1.000 (+0.66) | 1.000 (+0.66) | 1.000 (+0.66) |
| core-10 dark comedy about rich people | holdout | subject_object | 0.073 | 0.872 (+0.80) | 0.834 (+0.76) | 0.776 (+0.70) | 0.762 (+0.69) | 0.762 (+0.69) | 0.836 (+0.76) | 0.761 (+0.69) |
| core-12 with my parents | holdout | audience | 0.142 | 0.964 (+0.82) | 0.964 (+0.82) | 0.926 (+0.78) | 0.926 (+0.78) | 0.926 (+0.78) | 0.926 (+0.78) | 0.926 (+0.78) |
| new-10 90s crime movies with great dialogue | holdout | era_genre | 0.116 | 0.921 (+0.80) | 0.921 (+0.80) | 0.921 (+0.80) | 0.921 (+0.80) | 0.921 (+0.80) | 0.921 (+0.80) | 0.921 (+0.80) |
| new-11 comedy without romance | dev | negation | 0.042 | 1.000 (+0.96) | 1.000 (+0.96) | 1.000 (+0.96) | 1.000 (+0.96) | 1.000 (+0.96) | 1.000 (+0.96) | 1.000 (+0.96) |

## Former holdout failures and like-X queries: top 10 with grades

### new-01 heist on a train

Intent: A robbery or theft carried out on or against a train is central. Trains without a heist, or heists without a train, are weak.

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | Robbery (1967) **3** | Money Heist (2017) **0** | Robbery (1967) **3** | Robbery (1967) **3** |
| 2 | Money Train (1995) **3** | Fast Five (2011) **0** | Red Sun (1971) **3** | 10 Minutes Gone (2019) **1** |
| 3 | Red Sun (1971) **3** | Money Heist (2017) **0** | The First Great Train Robbery (1978) **3** | Red Sun (1971) **3** |
| 4 | The 5-Man Army (1969) **3** | Kill (2024) **2** | 10 Minutes Gone (2019) **1** | The First Great Train Robbery (1978) **3** |
| 5 | Drop Zone (1994) **0** | Baby Driver (2017) **0** | Von Ryan's Express (1965) **2** | Von Ryan's Express (1965) **2** |
| 6 | The Cimarron Kid (1952) **2** | Inception (2010) **0** | Money Train (1995) **3** | The Great Train Robbery (2013) **3** |
| 7 | Von Ryan's Express (1965) **2** | The Getaway (1972) **0** | Money Heist (2017) **0** | Inception (2010) **0** |
| 8 | The First Great Train Robbery (1978) **3** | The Thieves (2012) **0** | Inception (2010) **0** | Money Train (1995) **3** |
| 9 | Butch and Sundance: The Early Days (1979) **2** | Reservoir Dogs (1992) **0** | The Great Train Robbery (2013) **3** | Money Heist (2017) **0** |
| 10 | Takers (2010) **0** | Ambulance (2022) **0** | Money Heist (2017) **0** | Kill (2024) **2** |
| ndcg10 | 0.861 | 0.048 | 0.786 | 0.777 |

### new-08 like Breaking Bad but a comedy

Intent: Crime series about an ordinary person drifting into crime, played for laughs. Pure dramas like Breaking Bad itself are weak.

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | The Wrong Mans (2013) **3** | Breaking Bad (2008) **0** | The Wrong Mans (2013) **3** | The Gentlemen (2024) **2** |
| 2 | How to Sell Drugs Online (Fast) (2019) **3** | The Gentlemen (2024) **2** | The Gentlemen (2024) **2** | The Wrong Mans (2013) **3** |
| 3 | Minder (1979) **2** | The Wrong Mans (2013) **3** | Barry (2018) **2** | Barry (2018) **2** |
| 4 | A Touch of Cloth (2012) **0** | Sherlock (2010) **0** | The Outlaws (2021) **2** | The Outlaws (2021) **2** |
| 5 | Murder in Successville (2015) **0** | Vincenzo (2021) **1** | Vincenzo (2021) **1** | Vincenzo (2021) **1** |
| 6 | Studio 60 on the Sunset Strip (2006) **0** | Barry (2018) **2** | Série Noire (2014) **2** | Série Noire (2014) **2** |
| 7 | Chief Kim (2017) **1** | The Outlaws (2021) **2** | Sneaky Pete (2015) **1** | Sneaky Pete (2015) **1** |
| 8 | Community Squad (2023) **1** | It's Always Sunny in Philadelphia (2005) **1** | Better Call Saul (2015) **1** | Better Call Saul (2015) **1** |
| 9 | Comedy Premium League (2021) **0** | The Afterparty (2022) **1** | Crime Scene Cleaner (2011) **2** | Sherlock (2010) **0** |
| 10 | High Desert (2023) **1** | Série Noire (2014) **2** | Sherlock (2010) **0** | Crime Scene Cleaner (2011) **2** |
| ndcg10 | 0.708 | 0.477 | 0.751 | 0.673 |

### core-18 Brain’s fried. Something warm and funny, but not painfully cheesy.

Intent: Easy, warm comedies with wit, avoiding saccharine sentimentality.

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | Moone Boy (2012) **3** | Chef (2014) **2** | Moone Boy (2012) **3** | Moone Boy (2012) **3** |
| 2 | Fever Pitch (1997) **2** | Crocodile Dundee (1986) **2** | Chef (2014) **2** | Chef (2014) **2** |
| 3 | Three Wise Men and a Baby (2022) **1** | 50 First Dates (2004) **2** | Crocodile Dundee (1986) **2** | Crocodile Dundee (1986) **2** |
| 4 | Himouto! Umaru-chan (2015) **2** | Phineas and Ferb (2007) **2** | Phineas and Ferb (2007) **2** | 50 First Dates (2004) **2** |
| 5 | Mister Roberts (1955) **3** | SpongeBob SquarePants (1999) **2** | SpongeBob SquarePants (1999) **2** | Phineas and Ferb (2007) **2** |
| 6 | Starstruck (2021) **3** | Son of Flubber (1963) **2** | Brooklyn Nine-Nine (2013) **3** | SpongeBob SquarePants (1999) **2** |
| 7 | Master Eder and his Pumuckl (1982) **1** | Kingdom (2007) **2** | Son of Flubber (1963) **2** | Son of Flubber (1963) **2** |
| 8 | The Grump (2014) **3** | Brooklyn Nine-Nine (2013) **3** | Whose Line Is It Anyway? (1988) **2** | Brooklyn Nine-Nine (2013) **3** |
| 9 | The Cosby Show (1984) **3** | Whose Line Is It Anyway? (1988) **2** | The Muppets (2011) **2** | Kingdom (2007) **2** |
| 10 | Crocodile Dundee (1986) **2** | Airplane! (1980) **2** | Airplane! (1980) **2** | Whose Line Is It Anyway? (1988) **2** |
| ndcg10 | 0.698 | 0.486 | 0.622 | 0.616 |

### lab-12 like groundhog day

Intent: Other time-loop / repeating-day stories, ideally comedic or about personal growth. Groundhog Day itself is a reference hit, not a discovery.

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | Groundhog Day (1993) **3** | Groundhog Day (1993) **3** | Palm Springs (2020) **3** | The Map of Tiny Perfect Things (2021) **3** |
| 2 | Palm Springs (2020) **3** | The Map of Tiny Perfect Things (2021) **3** | The Map of Tiny Perfect Things (2021) **3** | Palm Springs (2020) **3** |
| 3 | 12 Days of Christmas Eve (2004) **3** | River (2023) **3** | Urusei Yatsura: Beautiful Dreamer (1984) **3** | Urusei Yatsura: Beautiful Dreamer (1984) **3** |
| 4 | Jack Frost (1979) **0** | Mondays: See You 'This' Week! (2022) **3** | Mondays: See You 'This' Week! (2022) **3** | River (2023) **3** |
| 5 | The Fare (2018) **2** | Palm Springs (2020) **3** | River (2023) **3** | Mondays: See You 'This' Week! (2022) **3** |
| 6 | About Time (2013) **1** | Urusei Yatsura: Beautiful Dreamer (1984) **3** | The Fare (2018) **2** | The Fare (2018) **2** |
| 7 | The Map of Tiny Perfect Things (2021) **3** | The Fare (2018) **2** | Jack Frost (1979) **0** | Jack Frost (1979) **0** |
| 8 | The Final Girls (2015) **0** | Jack Frost (1979) **0** | Christmas ...Again?! (2021) **2** | Christmas ...Again?! (2021) **2** |
| 9 | Urusei Yatsura: Beautiful Dreamer (1984) **3** | Naked (2017) **3** | 12 Days of Christmas Eve (2004) **3** | The Devil's Eye (1960) **0** |
| 10 | 50 First Dates (2004) **2** | Christmas ...Again?! (2021) **2** | The Devil's Eye (1960) **0** | Naked (2017) **3** |
| ndcg10 | 0.684 | 0.852 | 0.779 | 0.776 |

### new-07 like The Matrix but anime

Intent: Anime about simulated reality, cyberspace, or AI and identity. The live-action Matrix films themselves are not the answer.

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | Gurren Lagann (2007) **0** | The Animatrix (2003) **3** | The Animatrix (2003) **3** | The Animatrix (2003) **3** |
| 2 | Neon Genesis Evangelion: The End of Evangelion (1997) **1** | Akira (1988) **1** | Akira (1988) **1** | Akira (1988) **1** |
| 3 | The Animatrix (2003) **3** | Battle Angel (1993) **2** | Battle Angel (1993) **2** | Battle Angel (1993) **2** |
| 4 | Cyberpunk: Edgerunners (2022) **1** | Neon Genesis Evangelion (1995) **1** | Ghost in the Shell 2.0 (2008) **3** | Ghost in the Shell 2.0 (2008) **3** |
| 5 | Evangelion: 1.0 You Are (Not) Alone (2007) **1** | Ghost in the Shell 2.0 (2008) **3** | Neon Genesis Evangelion (1995) **1** | Neon Genesis Evangelion (1995) **1** |
| 6 | Mobile Suit Gundam Unicorn (2010) **0** | Cyberpunk: Edgerunners (2022) **1** | Ghost in the Shell: Stand Alone Complex - The Laughing Man (2005) **3** | Ghost in the Shell: Stand Alone Complex - The Laughing Man (2005) **3** |
| 7 | Akira (1988) **1** | Ghost in the Shell: Stand Alone Complex - The Laughing Man (2005) **3** | Ghost in the Shell (1995) **3** | Ghost in the Shell (1995) **3** |
| 8 | Evangelion: 3.0 You Can (Not) Redo (2012) **1** | Neon Genesis Evangelion: The End of Evangelion (1997) **1** | Cyberpunk: Edgerunners (2022) **1** | Cyberpunk: Edgerunners (2022) **1** |
| 9 | Deca-Dence (2020) **3** | Ghost in the Shell (1995) **3** | Ghost in the Shell: Stand Alone Complex (2002) **3** | Ghost in the Shell: Stand Alone Complex (2002) **3** |
| 10 | Evangelion: 2.0 You Can (Not) Advance (2009) **1** | Attack on Titan (2013) **0** | Noein: To Your Other Self (2005) **2** | Noein: To Your Other Self (2005) **2** |
| ndcg10 | 0.251 | 0.547 | 0.649 | 0.649 |

### lab-03 slow burn space horror

Intent: Horror set in space or off-world with gradual, atmospheric dread rather than nonstop action.

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | Texhnolyze (2003) **0** | Alien (1979) **3** | Alien (1979) **3** | Alien (1979) **3** |
| 2 | Galaxy of Terror (1981) **2** | Dark Waters (1993) **1** | Dark Waters (1993) **1** | Dark Waters (1993) **1** |
| 3 | The Dark Side of the Moon (1990) **3** | 2001: A Space Odyssey (1968) **1** | Event Horizon (1997) **3** | Together (2025) **0** |
| 4 | Jordskott (2015) **0** | Event Horizon (1997) **3** | Together (2025) **0** | Event Horizon (1997) **3** |
| 5 | Beyond the Black Rainbow (2010) **1** | Color Out of Space (2020) **1** | Texhnolyze (2003) **0** | The Endless (2017) **1** |
| 6 | Quatermass and the Pit (1958) **1** | Rosemary's Baby (1968) **0** | The Endless (2017) **1** | Come True (2020) **0** |
| 7 | Ad Vitam (2018) **0** | Eraserhead (1977) **0** | Come True (2020) **0** | The Haunting (1963) **1** |
| 8 | The Chestnut Man (2021) **0** | Texhnolyze (2003) **0** | Stalker (1979) **1** | The Incident (2014) **1** |
| 9 | Skinamarink (2023) **0** | Stalker (1979) **1** | The Haunting (1963) **1** | In the Mouth of Madness (1995) **1** |
| 10 | Silo (2023) **0** | The Haunting (1963) **1** | Eraserhead (1977) **0** | Stalker (1979) **1** |
| ndcg10 | 0.218 | 0.430 | 0.429 | 0.435 |

### lab-09 scifi with cars

Intent: Science fiction where cars, driving or road vehicles are material (post-apocalyptic roads, flying cars, deadly races).

| rank | prod | r3-combo-fast | r4-combo | r4-combo-fast |
|---|---|---|---|---|
| 1 | Death Race (2008) **3** | Death Race (2008) **3** | Knight Rider (2008) **3** | Knight Rider (2008) **3** |
| 2 | Knight Rider (2008) **3** | Knight Rider (2008) **3** | Death Race (2008) **3** | Death Race (2008) **3** |
| 3 | The Car: Road to Revenge (2019) **3** | The Last Chase (1981) **3** | The Last Chase (1981) **3** | The Last Chase (1981) **3** |
| 4 | Blood Drive (2017) **3** | Back to the Future (1985) **3** | Knight Rider (1982) **3** | Back to the Future (1985) **3** |
| 5 | Knight Rider (1982) **3** | Knight Rider (1982) **3** | Back to the Future (1985) **3** | Knight Rider (1982) **3** |
| 6 | Fast & Furious: Supercharged (2015) **0** | Mad Max (1979) **3** | The Car: Road to Revenge (2019) **3** | The Car: Road to Revenge (2019) **3** |
| 7 | Speed Racer (1967) **3** | The Car: Road to Revenge (2019) **3** | Terminator 2: Judgment Day (1991) **1** | Mad Max (1979) **3** |
| 8 | The Last Chase (1981) **3** | Terminator 2: Judgment Day (1991) **1** | Mad Max (1979) **3** | MegaForce (1982) **2** |
| 9 | Eureka (2006) **0** | Interstellar (2014) **0** | Interstellar (2014) **0** | Terminator 2: Judgment Day (1991) **1** |
| 10 | Knight Rider (2008) **3** | The Fifth Element (1997) **2** | MegaForce (1982) **2** | Until the End of the World (1991) **1** |
| ndcg10 | 0.855 | 0.838 | 0.835 | 0.849 |

## Grade-0 titles in the top 5 (finalists)

| ranker | query | rank | title |
|---|---|---|---|
| r4-combo | lab-03 slow burn space horror | 4 | Together (2025) |
| r4-combo | lab-03 slow burn space horror | 5 | Texhnolyze (2003) |
| r4-combo | lab-08 melancholy lighthouse keeper mystery | 4 | The Haunting of Hill House (2018) |
| r4-combo | lab-10 sunglasses at night | 5 | Blue Velvet (1986) |
| r4-combo | core-04 Incepton | 4 | Stranger Things (2016) |
| r4-combo | core-08 sunglasses | 3 | Sin City (2005) |
| r4-combo | core-14 Rich people being absolutely awful to each ot | 2 | It's Always Sunny in Philadelphia (2005) |
| r4-combo | core-14 Rich people being absolutely awful to each ot | 5 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r4-combo | core-20 bleak | 1 | Bleak: Who (2022) |
| r4-combo | core-20 bleak | 2 | Bleak - An action Short (2023) |
| r4-combo | core-28 Des gens riches qui se comportent horriblemen | 1 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r4-combo | new-12 war movie that isn't about World War II | 1 | Saving Private Ryan (1998) |
| r4-combo | new-12 war movie that isn't about World War II | 3 | Fires on the Plain (1959) |
| r4-combo | new-12 war movie that isn't about World War II | 5 | Come and See (1985) |
| r4-combo | new-16 whole movie takes place in one room | 5 | Knives Out (2019) |
| r4-combo | new-18 wholesome | 1 | Wholesome (2026) |
| r4-combo | new-20 An ordinary guy slowly realises his whole lif | 2 | Fight Club (1999) |
| r4-combo-fast | lab-03 slow burn space horror | 3 | Together (2025) |
| r4-combo-fast | lab-10 sunglasses at night | 4 | Blue Velvet (1986) |
| r4-combo-fast | core-04 Incepton | 4 | Stranger Things (2016) |
| r4-combo-fast | core-08 sunglasses | 3 | Sin City (2005) |
| r4-combo-fast | core-08 sunglasses | 4 | La Dolce Vita (1960) |
| r4-combo-fast | core-14 Rich people being absolutely awful to each ot | 4 | It's Always Sunny in Philadelphia (2005) |
| r4-combo-fast | core-14 Rich people being absolutely awful to each ot | 5 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r4-combo-fast | core-20 bleak | 1 | Bleak: Who (2022) |
| r4-combo-fast | core-20 bleak | 2 | Bleak - An action Short (2023) |
| r4-combo-fast | core-28 Des gens riches qui se comportent horriblemen | 1 | Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan (2006) |
| r4-combo-fast | new-12 war movie that isn't about World War II | 1 | Saving Private Ryan (1998) |
| r4-combo-fast | new-12 war movie that isn't about World War II | 3 | Fires on the Plain (1959) |
| r4-combo-fast | new-12 war movie that isn't about World War II | 5 | Come and See (1985) |
| r4-combo-fast | new-18 wholesome | 1 | Wholesome (2026) |
| r4-combo-fast | new-20 An ordinary guy slowly realises his whole lif | 1 | Fight Club (1999) |
