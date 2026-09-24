# round1 metrics

- e5-small variant used by the hybrids: `e5s-notitle` (chosen on dev anchors).
- hyb-lin weights: `{'a': 0.4, 'b': 0.42, 'c': 0.18}` (swept on dev anchors only, see sweep-hyb-lin.md).
- Holdout numbers are computed for information; nothing was tuned on them.

## dev: anchors

Anchor metrics exclude title_lookup queries. `title@1`: title_lookup queries with the expected title at rank 1.

| ranker | queries | anchor10 | anchor50 | avoid5 | title@1 | ndcg10 | good10 | bad5 | unj10 |
|---|---|---|---|---|---|---|---|---|---|
| prod | 37 | 0.190 | 0.348 | 3 | 4/4 | 0.628 | 6.65 | 30 | 0 |
| prod-replay | 37 | 0.190 | 0.348 | 3 | 3/4 | 0.621 | 6.49 | 30 | 0 |
| fp-count | 37 | 0.162 | 0.298 | 1 | 3/4 | 0.592 | 6.32 | 33 | 0 |
| emb-e5s | 37 | 0.032 | 0.135 | 0 | 4/4 | 0.441 | 4.89 | 62 | 0 |
| emb-e5s-notitle | 37 | 0.040 | 0.144 | 0 | 4/4 | 0.483 | 5.46 | 49 | 0 |
| emb-bgeb | 37 | 0.100 | 0.240 | 0 | 4/4 | 0.484 | 4.89 | 51 | 0 |
| hyb-lin | 37 | 0.190 | 0.397 | 0 | 4/4 | 0.723 | 7.81 | 10 | 0 |
| hyb-rrf | 37 | 0.171 | 0.413 | 0 | 4/4 | 0.674 | 6.97 | 29 | 0 |
| emb-then-fp | 37 | 0.082 | 0.250 | 0 | 4/4 | 0.590 | 6.46 | 31 | 0 |
| nojev-knn | 37 | 0.029 | 0.147 | 0 | 4/4 | 0.501 | 5.70 | 40 | 0 |
| hyb-lin+prior | 37 | 0.333 | 0.550 | 0 | 4/4 | 0.746 | 7.59 | 16 | 0 |

### dev: anchor10 / anchor50 by query type

| type (queries) | prod | prod-replay | fp-count | emb-e5s | emb-e5s-notitle | emb-bgeb | hyb-lin | hyb-rrf | emb-then-fp | nojev-knn | hyb-lin+prior |
|---|---|---|---|---|---|---|---|---|---|---|---|
| audience (2) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 |
| creator (1) | 0.00 / 0.33 | 0.00 / 0.33 | 0.00 / 0.00 | 0.00 / 0.33 | 0.00 / 0.33 | 0.00 / 1.00 | 0.00 / 0.67 | 0.00 / 0.67 | 0.00 / 0.67 | 0.00 / 0.33 | 0.00 / 1.00 |
| era_genre (1) | 0.00 / 0.25 | 0.00 / 0.25 | 0.25 / 0.25 | 0.00 / 0.25 | 0.00 / 0.00 | 0.25 / 0.50 | 0.25 / 0.50 | 0.00 / 0.25 | 0.00 / 0.00 | 0.00 / 0.00 | 0.50 / 1.00 |
| like_x_but_y (2) | 0.25 / 0.50 | 0.25 / 0.50 | 0.12 / 0.12 | 0.25 / 0.25 | 0.25 / 0.50 | 0.38 / 0.38 | 0.25 / 0.62 | 0.25 / 0.75 | 0.25 / 0.50 | 0.00 / 0.38 | 0.50 / 0.62 |
| long_descriptive (4) | 0.12 / 0.25 | 0.12 / 0.25 | 0.25 / 0.31 | 0.06 / 0.19 | 0.00 / 0.12 | 0.06 / 0.25 | 0.19 / 0.31 | 0.25 / 0.25 | 0.06 / 0.25 | 0.00 / 0.12 | 0.19 / 0.40 |
| negation (4) | 0.17 / 0.17 | 0.17 / 0.17 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.08 / 0.17 | 0.08 / 0.25 | 0.00 / 0.08 | 0.00 / 0.00 | 0.25 / 0.25 |
| non_english (4) | 0.08 / 0.08 | 0.08 / 0.08 | 0.08 / 0.08 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.08 | 0.00 / 0.08 | 0.00 / 0.00 | 0.00 / 0.00 | 0.08 / 0.17 |
| setting_mood (4) | 0.18 / 0.32 | 0.18 / 0.32 | 0.30 / 0.35 | 0.08 / 0.43 | 0.17 / 0.38 | 0.38 / 0.62 | 0.43 / 0.75 | 0.35 / 0.65 | 0.17 / 0.53 | 0.25 / 0.43 | 0.57 / 0.90 |
| short_vague (5) | 0.22 / 0.27 | 0.22 / 0.27 | 0.17 / 0.22 | 0.00 / 0.08 | 0.00 / 0.00 | 0.00 / 0.05 | 0.17 / 0.22 | 0.13 / 0.22 | 0.00 / 0.00 | 0.00 / 0.00 | 0.22 / 0.35 |
| structural (2) | 0.25 / 0.55 | 0.25 / 0.55 | 0.35 / 0.62 | 0.00 / 0.08 | 0.00 / 0.00 | 0.08 / 0.18 | 0.33 / 0.62 | 0.33 / 0.52 | 0.25 / 0.42 | 0.00 / 0.08 | 0.52 / 0.72 |
| subject_object (6) | 0.23 / 0.63 | 0.23 / 0.63 | 0.19 / 0.59 | 0.00 / 0.09 | 0.03 / 0.25 | 0.07 / 0.31 | 0.26 / 0.62 | 0.23 / 0.63 | 0.14 / 0.42 | 0.00 / 0.25 | 0.43 / 0.76 |
| typo (2) | 1.00 / 1.00 | 1.00 / 1.00 | 0.00 / 1.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 1.00 | 0.00 / 0.00 | 0.00 / 0.00 | 1.00 / 1.00 |

## holdout: anchors

Anchor metrics exclude title_lookup queries. `title@1`: title_lookup queries with the expected title at rank 1.

| ranker | queries | anchor10 | anchor50 | avoid5 | title@1 | ndcg10 | good10 | bad5 | unj10 |
|---|---|---|---|---|---|---|---|---|---|
| prod | 26 | 0.124 | 0.209 | 0 | 1/2 | – | – | – | – |
| prod-replay | 26 | 0.124 | 0.209 | 0 | 1/2 | – | – | – | – |
| fp-count | 26 | 0.056 | 0.161 | 1 | 1/2 | – | – | – | – |
| emb-e5s | 26 | 0.111 | 0.177 | 1 | 1/2 | – | – | – | – |
| emb-e5s-notitle | 26 | 0.119 | 0.205 | 0 | 1/2 | – | – | – | – |
| emb-bgeb | 26 | 0.129 | 0.229 | 1 | 1/2 | – | – | – | – |
| hyb-lin | 26 | 0.154 | 0.315 | 0 | 1/2 | – | – | – | – |
| hyb-rrf | 26 | 0.135 | 0.314 | 1 | 1/2 | – | – | – | – |
| emb-then-fp | 26 | 0.159 | 0.297 | 0 | 1/2 | – | – | – | – |
| nojev-knn | 26 | 0.127 | 0.205 | 0 | 1/2 | – | – | – | – |
| hyb-lin+prior | 26 | 0.280 | 0.495 | 1 | 1/2 | – | – | – | – |

### holdout: anchor10 / anchor50 by query type

| type (queries) | prod | prod-replay | fp-count | emb-e5s | emb-e5s-notitle | emb-bgeb | hyb-lin | hyb-rrf | emb-then-fp | nojev-knn | hyb-lin+prior |
|---|---|---|---|---|---|---|---|---|---|---|---|
| audience (2) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 |
| era_genre (1) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.17 / 0.33 | 0.17 / 0.33 | 0.33 / 0.67 | 0.17 / 0.50 | 0.17 / 0.33 | 0.33 / 0.33 | 0.17 / 0.33 | 0.67 / 0.67 |
| like_x_but_y (1) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.33 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.67 | 0.33 / 0.33 | 0.00 / 0.33 | 0.00 / 0.33 | 0.00 / 0.00 | 0.33 / 0.33 |
| long_descriptive (4) | 0.06 / 0.06 | 0.06 / 0.06 | 0.06 / 0.06 | 0.00 / 0.00 | 0.05 / 0.05 | 0.00 / 0.00 | 0.11 / 0.11 | 0.11 / 0.11 | 0.05 / 0.11 | 0.05 / 0.05 | 0.11 / 0.28 |
| negation (2) | 0.00 / 0.25 | 0.00 / 0.25 | 0.12 / 0.45 | 0.00 / 0.00 | 0.00 / 0.12 | 0.12 / 0.12 | 0.00 / 0.12 | 0.00 / 0.45 | 0.00 / 0.12 | 0.00 / 0.12 | 0.12 / 0.78 |
| non_english (3) | 0.07 / 0.07 | 0.07 / 0.07 | 0.07 / 0.07 | 0.07 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.13 | 0.07 / 0.07 | 0.00 / 0.07 | 0.00 / 0.00 | 0.07 / 0.33 |
| setting_mood (2) | 0.50 / 0.70 | 0.50 / 0.70 | 0.00 / 0.30 | 0.50 / 0.50 | 0.50 / 0.60 | 0.50 / 0.50 | 0.50 / 0.80 | 0.60 / 0.90 | 0.60 / 0.80 | 0.60 / 0.60 | 0.70 / 1.00 |
| short_vague (2) | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.17 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.17 |
| structural (2) | 0.25 / 0.25 | 0.25 / 0.25 | 0.12 / 0.12 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.12 | 0.00 / 0.25 | 0.00 / 0.25 | 0.00 / 0.00 | 0.00 / 0.00 | 0.12 / 0.35 |
| subject_object (6) | 0.19 / 0.31 | 0.19 / 0.31 | 0.07 / 0.19 | 0.23 / 0.42 | 0.27 / 0.53 | 0.27 / 0.42 | 0.32 / 0.61 | 0.23 / 0.50 | 0.38 / 0.71 | 0.27 / 0.53 | 0.54 / 0.75 |
| typo (1) | 0.00 / 0.20 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.20 / 0.20 |

## dev: ndcg10 by query type

Top 4 rankers by dev ndcg10, plus prod. Graded dev queries: 37.

| type (queries) | hyb-lin+prior | hyb-lin | hyb-rrf | fp-count | prod |
|---|---|---|---|---|---|
| audience (2) | 0.799 | 0.918 | 0.692 | 0.356 | 0.563 |
| creator (1) | 0.891 | 0.891 | 0.891 | 0.891 | 0.776 |
| era_genre (1) | 0.841 | 1.000 | 0.752 | 0.298 | 0.595 |
| like_x_but_y (2) | 0.696 | 0.670 | 0.654 | 0.155 | 0.467 |
| long_descriptive (4) | 0.664 | 0.557 | 0.658 | 0.609 | 0.480 |
| negation (4) | 0.748 | 0.768 | 0.513 | 0.464 | 0.606 |
| non_english (4) | 0.642 | 0.515 | 0.469 | 0.513 | 0.572 |
| setting_mood (4) | 0.760 | 0.763 | 0.682 | 0.463 | 0.520 |
| short_vague (5) | 0.793 | 0.804 | 0.785 | 0.767 | 0.713 |
| structural (2) | 0.668 | 0.624 | 0.698 | 0.776 | 0.559 |
| subject_object (6) | 0.872 | 0.864 | 0.872 | 0.823 | 0.846 |
| typo (2) | 0.547 | 0.401 | 0.379 | 0.588 | 0.661 |
| all (37) | 0.746 | 0.723 | 0.674 | 0.592 | 0.628 |

## dev: ndcg10 per query (hyb-lin+prior vs prod, sorted by difference)

| query | type | hyb-lin+prior | prod | diff |
|---|---|---|---|---|
| lab-07 craty | typo | 0.781 | 1.000 | -0.219 |
| core-13 I want something tense that keeps me guessing, but I don’t w | long_descriptive | 0.512 | 0.652 | -0.139 |
| lab-04 tense heist thriller, not bleak | negation | 0.728 | 0.831 | -0.103 |
| core-07 car chases | subject_object | 0.945 | 1.000 | -0.055 |
| core-26 Ich suche etwas Spannendes, das mich rätseln lässt, aber am  | non_english | 0.655 | 0.709 | -0.054 |
| new-17 mindbending | short_vague | 0.874 | 0.916 | -0.041 |
| core-27 Quiero una serie policial realista y cruda, sin animación ni | non_english | 0.611 | 0.645 | -0.034 |
| core-17 Give me car chases, but make it more getaway driver than sup | long_descriptive | 0.773 | 0.801 | -0.028 |
| core-30 spannend aber nicht düster | non_english | 0.659 | 0.682 | -0.022 |
| core-04 Incepton | typo | 0.314 | 0.323 | -0.009 |
| lab-13 time travel complex | structural | 0.874 | 0.877 | -0.004 |
| lab-06 furious | short_vague | 0.945 | 0.945 | +0.000 |
| core-08 sunglasses | subject_object | 0.770 | 0.770 | +0.000 |
| core-21 funny | short_vague | 0.285 | 0.285 | +0.000 |
| core-22 time loop | subject_object | 0.997 | 0.997 | +0.000 |
| core-19 cozy | short_vague | 0.983 | 0.980 | +0.003 |
| new-02 two geniuses in a battle of wits | subject_object | 0.693 | 0.674 | +0.020 |
| core-11 no anime, gritty crime show | negation | 1.000 | 0.945 | +0.055 |
| lab-12 like groundhog day | like_x_but_y | 0.745 | 0.684 | +0.061 |
| lab-10 sunglasses at night | subject_object | 0.879 | 0.793 | +0.086 |
| lab-11 fantasy with dragons | subject_object | 0.946 | 0.845 | +0.101 |
| lab-01 tarkovsky | creator | 0.891 | 0.776 | +0.115 |
| new-04 quiet and lonely in deep space | setting_mood | 0.907 | 0.765 | +0.141 |
| lab-03 slow burn space horror | setting_mood | 0.373 | 0.229 | +0.144 |
| core-15 A crime show that feels grubby and real. No animation, and n | long_descriptive | 0.515 | 0.335 | +0.180 |
| core-25 something short to watch after work | audience | 0.723 | 0.509 | +0.214 |
| new-15 nonlinear storytelling | structural | 0.462 | 0.241 | +0.221 |
| new-09 80s sci-fi action | era_genre | 0.841 | 0.595 | +0.246 |
| core-23 slow atmospheric science fiction | setting_mood | 0.919 | 0.672 | +0.247 |
| new-13 smart sci-fi for adults | audience | 0.874 | 0.616 | +0.258 |
| core-06 tense but not bleak | negation | 0.864 | 0.604 | +0.260 |
| new-11 comedy without romance | negation | 0.402 | 0.042 | +0.360 |
| new-21 un dessin animé drôle pour toute la famille | non_english | 0.645 | 0.251 | +0.393 |
| new-07 like The Matrix but anime | like_x_but_y | 0.647 | 0.251 | +0.396 |
| lab-02 feel good cooking show | setting_mood | 0.840 | 0.415 | +0.425 |
| lab-00 complete nonsense | short_vague | 0.879 | 0.439 | +0.441 |
| new-19 A crew of misfits on a beat-up spaceship taking odd jobs on  | long_descriptive | 0.855 | 0.131 | +0.723 |

## Per query anchor hits in the top 10 / top 50 (all splits)

| query | split | type | prod | prod-replay | fp-count | emb-e5s | emb-e5s-notitle | emb-bgeb | hyb-lin | hyb-rrf | emb-then-fp | nojev-knn | hyb-lin+prior |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lab-00 complete nonsense | dev | short_vague | 2/2 | 2/2 | 2/2 | 0/1 | 0/0 | 0/0 | 2/2 | 1/2 | 0/0 | 0/0 | 2/3 |
| lab-01 tarkovsky | dev | creator | 0/1 | 0/1 | 0/0 | 0/1 | 0/1 | 0/3 | 0/2 | 0/2 | 0/2 | 0/1 | 0/3 |
| lab-02 feel good cooking show | dev | setting_mood | 1/2 | 1/2 | 2/2 | 1/3 | 2/3 | 3/3 | 3/3 | 2/3 | 2/3 | 3/3 | 3/3 |
| lab-03 slow burn space horror | dev | setting_mood | 0/0 | 0/0 | 1/1 | 0/1 | 0/1 | 1/2 | 1/3 | 1/3 | 0/1 | 0/1 | 2/3 |
| lab-04 tense heist thriller, not bleak | dev | negation | 2/2 | 2/2 | 0/0 | 0/0 | 0/0 | 0/0 | 1/2 | 1/2 | 0/1 | 0/0 | 2/2 |
| lab-05 grief after losing a child | holdout | subject_object | 0/1 | 0/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/2 | 0/2 | 1/2 | 1/1 | 2/2 |
| lab-08 melancholy lighthouse keeper mystery | holdout | setting_mood | 1/1 | 1/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| lab-09 scifi with cars | holdout | subject_object | 1/1 | 1/1 | 1/1 | 0/2 | 0/3 | 1/2 | 2/3 | 1/2 | 1/3 | 0/3 | 3/4 |
| lab-10 sunglasses at night | dev | subject_object | 1/1 | 1/1 | 1/1 | 0/0 | 0/1 | 0/0 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 |
| lab-11 fantasy with dragons | dev | subject_object | 1/4 | 1/4 | 1/4 | 0/1 | 1/3 | 1/4 | 2/4 | 1/4 | 1/3 | 0/3 | 2/4 |
| lab-12 like groundhog day | dev | like_x_but_y | 1/3 | 1/3 | 0/0 | 0/0 | 0/1 | 1/1 | 1/2 | 1/3 | 1/1 | 0/0 | 2/2 |
| lab-13 time travel complex | dev | structural | 3/3 | 3/3 | 3/5 | 0/1 | 0/0 | 1/1 | 4/5 | 4/5 | 3/5 | 0/1 | 5/5 |
| core-04 Incepton | dev | typo | 1/1 | 1/1 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 1/1 |
| core-06 tense but not bleak | dev | negation | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-07 car chases | dev | subject_object | 1/3 | 1/3 | 1/3 | 0/0 | 0/1 | 1/2 | 1/4 | 1/4 | 0/3 | 0/1 | 3/4 |
| core-08 sunglasses | dev | subject_object | 1/2 | 1/2 | 1/2 | 0/1 | 0/1 | 0/1 | 1/1 | 1/2 | 1/1 | 0/1 | 1/2 |
| core-09 unreliable narrator | holdout | structural | 2/2 | 2/2 | 1/1 | 0/0 | 0/0 | 0/1 | 0/2 | 0/2 | 0/0 | 0/0 | 1/2 |
| core-10 dark comedy about rich people | holdout | subject_object | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 0/2 | 0/1 | 1/3 | 1/1 | 2/3 |
| core-11 no anime, gritty crime show | dev | negation | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 1/1 |
| core-13 I want something tense that keeps me gue | dev | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-14 Rich people being absolutely awful to ea | holdout | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/3 |
| core-15 A crime show that feels grubby and real. | dev | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 |
| core-16 Something where halfway through you real | holdout | long_descriptive | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 |
| core-17 Give me car chases, but make it more get | dev | long_descriptive | 2/4 | 2/4 | 3/4 | 1/3 | 0/2 | 1/3 | 2/4 | 3/3 | 1/3 | 0/2 | 2/4 |
| core-18 Brain’s fried. Something warm and funny, | holdout | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-19 cozy | dev | short_vague | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-20 bleak | holdout | short_vague | 0/1 | 0/1 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/1 |
| core-21 funny | dev | short_vague | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-22 time loop | dev | subject_object | 0/4 | 0/4 | 0/3 | 0/0 | 0/0 | 0/0 | 0/2 | 0/2 | 0/1 | 0/0 | 0/4 |
| core-23 slow atmospheric science fiction | dev | setting_mood | 1/2 | 1/2 | 0/1 | 0/1 | 0/0 | 1/2 | 1/3 | 1/2 | 0/1 | 0/0 | 2/5 |
| core-24 a hopeful space adventure without horror | holdout | negation | 0/2 | 0/2 | 1/2 | 0/0 | 0/1 | 1/1 | 0/1 | 0/2 | 0/1 | 0/1 | 1/3 |
| core-26 Ich suche etwas Spannendes, das mich rät | dev | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-27 Quiero una serie policial realista y cru | dev | non_english | 1/1 | 1/1 | 1/1 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/0 | 1/2 |
| core-28 Des gens riches qui se comportent horrib | holdout | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/1 |
| core-29 Kafam çok yorgun. Sıcak ve komik ama aşı | holdout | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-30 spannend aber nicht düster | dev | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-01 heist on a train | holdout | subject_object | 1/1 | 1/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| new-02 two geniuses in a battle of wits | dev | subject_object | 1/1 | 1/1 | 0/1 | 0/0 | 0/0 | 0/1 | 1/3 | 1/2 | 0/1 | 0/0 | 3/3 |
| new-03 satire about politics or big corporation | holdout | subject_object | 0/0 | 0/0 | 0/1 | 0/1 | 0/1 | 0/1 | 0/0 | 0/0 | 0/2 | 0/1 | 0/2 |
| new-04 quiet and lonely in deep space | dev | setting_mood | 1/1 | 1/1 | 1/1 | 0/1 | 0/1 | 0/2 | 1/2 | 1/1 | 0/3 | 0/2 | 1/3 |
| new-05 rainy neon cyberpunk city | holdout | setting_mood | 0/2 | 0/2 | 0/3 | 0/0 | 0/1 | 0/0 | 0/3 | 1/4 | 1/3 | 1/1 | 2/5 |
| new-06 kung fu comedy | holdout | subject_object | 2/3 | 2/3 | 1/1 | 2/4 | 2/5 | 2/4 | 2/5 | 3/4 | 4/5 | 2/5 | 3/5 |
| new-07 like The Matrix but anime | dev | like_x_but_y | 1/1 | 1/1 | 1/1 | 2/2 | 2/3 | 2/2 | 1/3 | 1/3 | 1/3 | 0/3 | 2/3 |
| new-08 like Breaking Bad but a comedy | holdout | like_x_but_y | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/2 | 1/1 | 0/1 | 0/1 | 0/0 | 1/1 |
| new-09 80s sci-fi action | dev | era_genre | 0/1 | 0/1 | 1/1 | 0/1 | 0/0 | 1/2 | 1/2 | 0/1 | 0/0 | 0/0 | 2/4 |
| new-10 90s crime movies with great dialogue | holdout | era_genre | 0/0 | 0/0 | 0/0 | 1/2 | 1/2 | 2/4 | 1/3 | 1/2 | 2/2 | 1/2 | 4/4 |
| new-11 comedy without romance | dev | negation | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-12 war movie that isn't about World War II | holdout | negation | 0/0 | 0/0 | 0/2 | 0/0 | 0/0 | 0/0 | 0/0 | 0/2 | 0/0 | 0/0 | 0/4 |
| new-13 smart sci-fi for adults | dev | audience | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 |
| new-14 good first anime for someone who never w | holdout | audience | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-15 nonlinear storytelling | dev | structural | 0/3 | 0/3 | 1/2 | 0/0 | 0/0 | 0/1 | 0/2 | 0/1 | 0/0 | 0/0 | 1/3 |
| new-16 whole movie takes place in one room | holdout | structural | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 |
| new-17 mindbending | dev | short_vague | 1/2 | 1/2 | 0/1 | 0/0 | 0/0 | 0/1 | 0/1 | 1/1 | 0/0 | 0/0 | 1/2 |
| new-18 wholesome | holdout | short_vague | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-19 A crew of misfits on a beat-up spaceship | dev | long_descriptive | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 | 0/1 | 1/1 | 1/1 | 0/1 | 0/0 | 1/1 |
| new-20 An ordinary guy slowly realises his whol | holdout | long_descriptive | 1/1 | 1/1 | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 1/1 | 0/1 | 0/0 | 1/1 |
| new-21 un dessin animé drôle pour toute la fami | dev | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-22 Antikriegsfilm, der zeigt, wie sinnlos K | holdout | non_english | 1/1 | 1/1 | 1/1 | 1/3 | 0/0 | 0/0 | 0/1 | 1/1 | 0/1 | 0/0 | 1/4 |
| new-23 psycological thriler with a big twist | holdout | typo | 0/1 | 0/1 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/0 | 0/0 | 1/1 |

## Offline compute and estimated production latency

Offline ms: this machine, numpy over the full 191k catalog, query embedding cached (informative only).
Added p50: estimated app-server stage time on top of the Jev reading, text pool and embedding path run in parallel; prod ≈ 235 ms.

| ranker | offline mean ms | offline p95 ms | stages | est. p50 after reading (ms) | vs prod |
|---|---|---|---|---|---|
| prod | – | – | crate_text, qdrant_fp2000 | 235 | +0 |
| prod-replay | 2.1 | 5.8 | crate_text, qdrant_fp2000 | 235 | +0 |
| fp-count | 5.2 | 8.0 | crate_text, fp_full | 154 | -81 |
| emb-e5s | 6.9 | 10.3 | qemb, qdrant_emb | 23 | -212 |
| emb-e5s-notitle | 8.3 | 13.1 | qemb, qdrant_emb | 23 | -212 |
| emb-bgeb | 12.3 | 14.9 | qemb, qdrant_emb | 30 | -205 |
| hyb-lin | 13.7 | 23.2 | crate_text, qemb, qdrant_emb, fp_full | 154 | -81 |
| hyb-rrf | 22.6 | 36.0 | crate_text, qemb, qdrant_emb, fp_full | 154 | -81 |
| emb-then-fp | 7.6 | 11.1 | qemb, qdrant_emb, fp_payload | 43 | -192 |
| nojev-knn | 7.9 | 12.1 | qemb, qdrant_emb, fp_payload | 43 | -192 |
| hyb-lin+prior | 10.1 | 13.3 | crate_text, qemb, qdrant_emb, fp_full | 154 | -81 |
