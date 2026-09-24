# round2 metrics

Round-2 rankers: hyb-lin+prior (round 1: e5s-notitle, a 0.4 / b 0.42 / c 0.18, prior 0.1/0.1 additive) with one change each, chosen on dev only (proxy sweeps in sweeps.md). Round-1 lists are included unchanged. Holdout ndcg is not computed (holdout is not graded).

| ranker | changes vs hyb-lin+prior | blend |
|---|---|---|
| neg | `{'neg': 0.1}` | `production blend` |
| facet | `{'facet': 0.1, 'facet_source': 'phrases'}` | `production blend` |
| prior-gated | `{'prior': [0.4, 0.4], 'prior_mode': 'gate', 'gate_k': 10}` | `production blend` |
| title-strict | `{}` | `{'strict': 0.9, 'fuzzy': 0.88}` |
| notext | `{'b': 0.6, 'c': 0, 'text': False}` | `production blend` |
| bgeb-notitle | `{'emb': 'bgeb-notitle'}` | `production blend` |
| r2-combo | `{'neg': 0.1, 'facet': 0.1, 'facet_source': 'phrases'}` | `{'fuzzy': 0.88}` |
| r2-combo-bgeb | `{'emb': 'bgeb-notitle', 'neg': 0.1, 'facet': 0.1, 'facet_source': 'phrases'}` | `{'fuzzy': 0.88}` |
| r2-combo-strict | `{'neg': 0.1, 'facet': 0.1, 'facet_source': 'phrases'}` | `{'strict': 0.9, 'fuzzy': 0.88}` |
| r2-combo-bgeb-strict | `{'emb': 'bgeb-notitle', 'neg': 0.1, 'facet': 0.1, 'facet_source': 'phrases'}` | `{'strict': 0.9, 'fuzzy': 0.88}` |

## dev: anchors

Anchor metrics exclude title_lookup queries. `title@1`: title_lookup queries with the expected title at rank 1.

| ranker | queries | anchor10 | anchor50 | avoid5 | title@1 | ndcg10 | good10 | bad5 | unj10 |
|---|---|---|---|---|---|---|---|---|---|
| prod | 37 | 0.190 | 0.348 | 3 | 4/4 | 0.585 | 6.65 | 30 | 0 |
| prod-replay | 37 | 0.190 | 0.348 | 3 | 3/4 | 0.578 | 6.49 | 30 | 0 |
| fp-count | 37 | 0.162 | 0.298 | 1 | 3/4 | 0.549 | 6.32 | 33 | 0 |
| emb-e5s | 37 | 0.032 | 0.135 | 0 | 4/4 | 0.401 | 4.89 | 62 | 0 |
| emb-e5s-notitle | 37 | 0.040 | 0.144 | 0 | 4/4 | 0.444 | 5.46 | 49 | 0 |
| emb-bgeb | 37 | 0.100 | 0.240 | 0 | 4/4 | 0.444 | 4.89 | 51 | 0 |
| hyb-lin | 37 | 0.190 | 0.397 | 0 | 4/4 | 0.680 | 7.81 | 10 | 0 |
| hyb-rrf | 37 | 0.171 | 0.413 | 0 | 4/4 | 0.631 | 6.97 | 29 | 0 |
| emb-then-fp | 37 | 0.082 | 0.250 | 0 | 4/4 | 0.551 | 6.46 | 31 | 0 |
| nojev-knn | 37 | 0.029 | 0.147 | 0 | 4/4 | 0.463 | 5.70 | 40 | 0 |
| hyb-lin+prior | 37 | 0.333 | 0.550 | 0 | 4/4 | 0.700 | 7.59 | 16 | 0 |
| neg | 37 | 0.323 | 0.550 | 0 | 4/4 | 0.722 | 7.84 | 12 | 0 |
| facet | 37 | 0.323 | 0.544 | 0 | 4/4 | 0.704 | 7.65 | 14 | 0 |
| prior-gated | 37 | 0.190 | 0.397 | 0 | 4/4 | 0.703 | 7.86 | 13 | 0 |
| title-strict | 37 | 0.357 | 0.555 | 0 | 4/4 | 0.728 | 7.62 | 17 | 0 |
| notext | 37 | 0.264 | 0.517 | 0 | 4/4 | 0.671 | 7.11 | 25 | 0 |
| bgeb-notitle | 37 | 0.298 | 0.569 | 0 | 4/4 | 0.708 | 7.54 | 11 | 0 |
| r2-combo | 37 | 0.313 | 0.544 | 0 | 4/4 | 0.734 | 7.81 | 11 | 0 |
| r2-combo-bgeb | 37 | 0.302 | 0.578 | 0 | 4/4 | 0.759 | 7.89 | 7 | 0 |
| r2-combo-strict | 37 | 0.338 | 0.544 | 0 | 4/4 | 0.752 | 7.84 | 13 | 0 |
| r2-combo-bgeb-strict | 37 | 0.347 | 0.588 | 0 | 4/4 | 0.783 | 8.05 | 8 | 0 |

### dev: anchor10 / anchor50 by query type

| type (queries) | prod | prod-replay | fp-count | emb-e5s | emb-e5s-notitle | emb-bgeb | hyb-lin | hyb-rrf | emb-then-fp | nojev-knn | hyb-lin+prior | neg | facet | prior-gated | title-strict | notext | bgeb-notitle | r2-combo | r2-combo-bgeb | r2-combo-strict | r2-combo-bgeb-strict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| audience (2) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.40 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.20 |
| creator (1) | 0.00 / 0.33 | 0.00 / 0.33 | 0.00 / 0.00 | 0.00 / 0.33 | 0.00 / 0.33 | 0.00 / 1.00 | 0.00 / 0.67 | 0.00 / 0.67 | 0.00 / 0.67 | 0.00 / 0.33 | 0.00 / 1.00 | 0.00 / 1.00 | 0.00 / 1.00 | 0.00 / 0.67 | 0.33 / 1.00 | 0.00 / 1.00 | 0.00 / 1.00 | 0.00 / 1.00 | 0.00 / 1.00 | 0.33 / 1.00 | 0.67 / 1.00 |
| era_genre (1) | 0.00 / 0.25 | 0.00 / 0.25 | 0.25 / 0.25 | 0.00 / 0.25 | 0.00 / 0.00 | 0.25 / 0.50 | 0.25 / 0.50 | 0.00 / 0.25 | 0.00 / 0.00 | 0.00 / 0.00 | 0.50 / 1.00 | 0.50 / 1.00 | 0.50 / 1.00 | 0.25 / 0.50 | 0.50 / 1.00 | 0.00 / 0.75 | 0.50 / 0.75 | 0.50 / 1.00 | 0.25 / 0.75 | 0.50 / 1.00 | 0.25 / 0.75 |
| like_x_but_y (2) | 0.25 / 0.50 | 0.25 / 0.50 | 0.12 / 0.12 | 0.25 / 0.25 | 0.25 / 0.50 | 0.38 / 0.38 | 0.25 / 0.62 | 0.25 / 0.75 | 0.25 / 0.50 | 0.00 / 0.38 | 0.50 / 0.62 | 0.50 / 0.62 | 0.50 / 0.62 | 0.25 / 0.62 | 0.50 / 0.62 | 0.25 / 0.50 | 0.38 / 0.75 | 0.50 / 0.62 | 0.38 / 0.75 | 0.50 / 0.62 | 0.38 / 0.75 |
| long_descriptive (4) | 0.12 / 0.25 | 0.12 / 0.25 | 0.25 / 0.31 | 0.06 / 0.19 | 0.00 / 0.12 | 0.06 / 0.25 | 0.19 / 0.31 | 0.25 / 0.25 | 0.06 / 0.25 | 0.00 / 0.12 | 0.19 / 0.40 | 0.19 / 0.40 | 0.19 / 0.40 | 0.19 / 0.31 | 0.19 / 0.40 | 0.19 / 0.27 | 0.27 / 0.40 | 0.19 / 0.40 | 0.27 / 0.62 | 0.19 / 0.40 | 0.27 / 0.62 |
| negation (4) | 0.17 / 0.17 | 0.17 / 0.17 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.08 / 0.17 | 0.08 / 0.25 | 0.00 / 0.08 | 0.00 / 0.00 | 0.25 / 0.25 | 0.17 / 0.25 | 0.17 / 0.25 | 0.08 / 0.17 | 0.25 / 0.25 | 0.17 / 0.33 | 0.25 / 0.25 | 0.17 / 0.25 | 0.17 / 0.33 | 0.17 / 0.25 | 0.17 / 0.33 |
| non_english (4) | 0.08 / 0.08 | 0.08 / 0.08 | 0.08 / 0.08 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.08 | 0.00 / 0.08 | 0.00 / 0.00 | 0.00 / 0.00 | 0.08 / 0.17 | 0.08 / 0.17 | 0.08 / 0.17 | 0.00 / 0.08 | 0.08 / 0.17 | 0.08 / 0.17 | 0.08 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 |
| setting_mood (4) | 0.18 / 0.32 | 0.18 / 0.32 | 0.30 / 0.35 | 0.08 / 0.43 | 0.17 / 0.38 | 0.38 / 0.62 | 0.43 / 0.75 | 0.35 / 0.65 | 0.17 / 0.53 | 0.25 / 0.43 | 0.57 / 0.90 | 0.57 / 0.90 | 0.57 / 0.90 | 0.43 / 0.75 | 0.57 / 0.90 | 0.62 / 0.90 | 0.57 / 0.95 | 0.57 / 0.90 | 0.62 / 0.77 | 0.57 / 0.90 | 0.62 / 0.77 |
| short_vague (5) | 0.22 / 0.27 | 0.22 / 0.27 | 0.17 / 0.22 | 0.00 / 0.08 | 0.00 / 0.00 | 0.00 / 0.05 | 0.17 / 0.22 | 0.13 / 0.22 | 0.00 / 0.00 | 0.00 / 0.00 | 0.22 / 0.35 | 0.22 / 0.35 | 0.22 / 0.35 | 0.17 / 0.22 | 0.22 / 0.35 | 0.05 / 0.32 | 0.27 / 0.37 | 0.22 / 0.35 | 0.18 / 0.37 | 0.22 / 0.35 | 0.18 / 0.45 |
| structural (2) | 0.25 / 0.55 | 0.25 / 0.55 | 0.35 / 0.62 | 0.00 / 0.08 | 0.00 / 0.00 | 0.08 / 0.18 | 0.33 / 0.62 | 0.33 / 0.52 | 0.25 / 0.42 | 0.00 / 0.08 | 0.52 / 0.72 | 0.52 / 0.72 | 0.52 / 0.72 | 0.33 / 0.62 | 0.52 / 0.72 | 0.35 / 0.82 | 0.53 / 0.82 | 0.52 / 0.72 | 0.53 / 0.82 | 0.52 / 0.72 | 0.53 / 0.82 |
| subject_object (6) | 0.23 / 0.63 | 0.23 / 0.63 | 0.19 / 0.59 | 0.00 / 0.09 | 0.03 / 0.25 | 0.07 / 0.31 | 0.26 / 0.62 | 0.23 / 0.63 | 0.14 / 0.42 | 0.00 / 0.25 | 0.43 / 0.76 | 0.43 / 0.76 | 0.43 / 0.76 | 0.26 / 0.62 | 0.51 / 0.79 | 0.39 / 0.64 | 0.34 / 0.79 | 0.43 / 0.76 | 0.38 / 0.76 | 0.51 / 0.76 | 0.52 / 0.76 |
| typo (2) | 1.00 / 1.00 | 1.00 / 1.00 | 0.00 / 1.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 1.00 | 0.00 / 0.00 | 0.00 / 0.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 0.00 / 0.00 | 1.00 / 1.00 | 1.00 / 1.00 | 0.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 | 1.00 / 1.00 |

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
| neg | 26 | 0.280 | 0.497 | 1 | 1/2 | – | – | – | – |
| facet | 26 | 0.273 | 0.469 | 1 | 1/2 | – | – | – | – |
| prior-gated | 26 | 0.162 | 0.315 | 1 | 1/2 | – | – | – | – |
| title-strict | 26 | 0.293 | 0.505 | 1 | 1/2 | – | – | – | – |
| notext | 26 | 0.268 | 0.515 | 2 | 1/2 | – | – | – | – |
| bgeb-notitle | 26 | 0.289 | 0.555 | 2 | 1/2 | – | – | – | – |
| r2-combo | 26 | 0.273 | 0.479 | 1 | 1/2 | – | – | – | – |
| r2-combo-bgeb | 26 | 0.271 | 0.543 | 2 | 1/2 | – | – | – | – |
| r2-combo-strict | 26 | 0.287 | 0.479 | 1 | 1/2 | – | – | – | – |
| r2-combo-bgeb-strict | 26 | 0.285 | 0.537 | 2 | 1/2 | – | – | – | – |

### holdout: anchor10 / anchor50 by query type

| type (queries) | prod | prod-replay | fp-count | emb-e5s | emb-e5s-notitle | emb-bgeb | hyb-lin | hyb-rrf | emb-then-fp | nojev-knn | hyb-lin+prior | neg | facet | prior-gated | title-strict | notext | bgeb-notitle | r2-combo | r2-combo-bgeb | r2-combo-strict | r2-combo-bgeb-strict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| audience (2) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 |
| era_genre (1) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.17 / 0.33 | 0.17 / 0.33 | 0.33 / 0.67 | 0.17 / 0.50 | 0.17 / 0.33 | 0.33 / 0.33 | 0.17 / 0.33 | 0.67 / 0.67 | 0.67 / 0.67 | 0.50 / 0.67 | 0.17 / 0.50 | 0.67 / 0.67 | 0.67 / 0.67 | 0.50 / 0.67 | 0.50 / 0.67 | 0.50 / 0.67 | 0.50 / 0.67 | 0.50 / 0.67 |
| like_x_but_y (1) | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.33 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.67 | 0.33 / 0.33 | 0.00 / 0.33 | 0.00 / 0.33 | 0.00 / 0.00 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 | 0.33 / 0.33 |
| long_descriptive (4) | 0.06 / 0.06 | 0.06 / 0.06 | 0.06 / 0.06 | 0.00 / 0.00 | 0.05 / 0.05 | 0.00 / 0.00 | 0.11 / 0.11 | 0.11 / 0.11 | 0.05 / 0.11 | 0.05 / 0.05 | 0.11 / 0.28 | 0.11 / 0.34 | 0.11 / 0.21 | 0.11 / 0.11 | 0.11 / 0.34 | 0.11 / 0.29 | 0.12 / 0.46 | 0.11 / 0.28 | 0.12 / 0.34 | 0.11 / 0.28 | 0.12 / 0.34 |
| negation (2) | 0.00 / 0.25 | 0.00 / 0.25 | 0.12 / 0.45 | 0.00 / 0.00 | 0.00 / 0.12 | 0.12 / 0.12 | 0.00 / 0.12 | 0.00 / 0.45 | 0.00 / 0.12 | 0.00 / 0.12 | 0.12 / 0.78 | 0.12 / 0.68 | 0.12 / 0.68 | 0.00 / 0.12 | 0.12 / 0.78 | 0.38 / 0.78 | 0.12 / 0.78 | 0.12 / 0.68 | 0.00 / 0.88 | 0.12 / 0.68 | 0.00 / 0.88 |
| non_english (3) | 0.07 / 0.07 | 0.07 / 0.07 | 0.07 / 0.07 | 0.07 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.13 | 0.07 / 0.07 | 0.00 / 0.07 | 0.00 / 0.00 | 0.07 / 0.33 | 0.07 / 0.33 | 0.07 / 0.33 | 0.00 / 0.13 | 0.07 / 0.33 | 0.07 / 0.33 | 0.13 / 0.20 | 0.07 / 0.33 | 0.13 / 0.20 | 0.07 / 0.33 | 0.13 / 0.20 |
| setting_mood (2) | 0.50 / 0.70 | 0.50 / 0.70 | 0.00 / 0.30 | 0.50 / 0.50 | 0.50 / 0.60 | 0.50 / 0.50 | 0.50 / 0.80 | 0.60 / 0.90 | 0.60 / 0.80 | 0.60 / 0.60 | 0.70 / 1.00 | 0.70 / 1.00 | 0.70 / 0.90 | 0.50 / 0.80 | 0.70 / 1.00 | 0.80 / 1.00 | 0.60 / 1.00 | 0.70 / 0.90 | 0.60 / 1.00 | 0.70 / 0.90 | 0.60 / 1.00 |
| short_vague (2) | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.17 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.00 | 0.17 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.00 / 0.17 | 0.17 / 0.17 | 0.17 / 0.33 |
| structural (2) | 0.25 / 0.25 | 0.25 / 0.25 | 0.12 / 0.12 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.12 | 0.00 / 0.25 | 0.00 / 0.25 | 0.00 / 0.00 | 0.00 / 0.00 | 0.12 / 0.35 | 0.12 / 0.35 | 0.12 / 0.35 | 0.00 / 0.25 | 0.12 / 0.35 | 0.12 / 0.35 | 0.35 / 0.47 | 0.12 / 0.35 | 0.35 / 0.47 | 0.12 / 0.35 | 0.35 / 0.47 |
| subject_object (6) | 0.19 / 0.31 | 0.19 / 0.31 | 0.07 / 0.19 | 0.23 / 0.42 | 0.27 / 0.53 | 0.27 / 0.42 | 0.32 / 0.61 | 0.23 / 0.50 | 0.38 / 0.71 | 0.27 / 0.53 | 0.54 / 0.75 | 0.54 / 0.75 | 0.54 / 0.75 | 0.35 / 0.61 | 0.54 / 0.75 | 0.41 / 0.83 | 0.46 / 0.80 | 0.54 / 0.75 | 0.46 / 0.80 | 0.54 / 0.75 | 0.46 / 0.72 |
| typo (1) | 0.00 / 0.20 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.20 | 0.00 / 0.20 | 0.00 / 0.00 | 0.00 / 0.00 | 0.00 / 0.00 | 0.20 / 0.20 | 0.20 / 0.20 | 0.20 / 0.20 | 0.00 / 0.20 | 0.20 / 0.20 | 0.00 / 0.20 | 0.60 / 0.80 | 0.20 / 0.20 | 0.40 / 0.80 | 0.20 / 0.20 | 0.40 / 0.80 |

## dev: ndcg10 by query type

Top 4 rankers by dev ndcg10, plus prod. Graded dev queries: 37.

| type (queries) | r2-combo-bgeb-strict | r2-combo-bgeb | r2-combo-strict | r2-combo | prod |
|---|---|---|---|---|---|
| audience (2) | 0.978 | 0.978 | 0.795 | 0.795 | 0.563 |
| creator (1) | 0.643 | 0.487 | 0.618 | 0.487 | 0.424 |
| era_genre (1) | 0.784 | 0.784 | 0.848 | 0.848 | 0.595 |
| like_x_but_y (2) | 0.643 | 0.643 | 0.696 | 0.696 | 0.467 |
| long_descriptive (4) | 0.747 | 0.747 | 0.663 | 0.663 | 0.471 |
| negation (4) | 0.884 | 0.884 | 0.824 | 0.824 | 0.598 |
| non_english (4) | 0.700 | 0.700 | 0.735 | 0.735 | 0.559 |
| setting_mood (4) | 0.769 | 0.769 | 0.758 | 0.758 | 0.518 |
| short_vague (5) | 0.767 | 0.609 | 0.775 | 0.632 | 0.553 |
| structural (2) | 0.753 | 0.753 | 0.668 | 0.668 | 0.559 |
| subject_object (6) | 0.856 | 0.866 | 0.817 | 0.846 | 0.816 |
| typo (2) | 0.704 | 0.704 | 0.677 | 0.677 | 0.608 |
| all (37) | 0.783 | 0.759 | 0.752 | 0.734 | 0.585 |

## dev: ndcg10 per query (r2-combo-bgeb-strict vs prod, sorted by difference)

| query | type | r2-combo-bgeb-strict | prod | diff |
|---|---|---|---|---|
| lab-07 craty | typo | 0.614 | 1.000 | -0.386 |
| core-08 sunglasses | subject_object | 0.527 | 0.651 | -0.125 |
| core-26 Ich suche etwas Spannendes, das mich rätseln lässt, aber am  | non_english | 0.620 | 0.709 | -0.090 |
| lab-04 tense heist thriller, not bleak | negation | 0.766 | 0.801 | -0.035 |
| core-07 car chases | subject_object | 1.000 | 1.000 | +0.000 |
| new-17 mindbending | short_vague | 0.922 | 0.916 | +0.007 |
| lab-06 furious | short_vague | 0.958 | 0.945 | +0.013 |
| core-17 Give me car chases, but make it more getaway driver than sup | long_descriptive | 0.817 | 0.801 | +0.016 |
| lab-10 sunglasses at night | subject_object | 0.813 | 0.793 | +0.020 |
| lab-13 time travel complex | structural | 0.918 | 0.877 | +0.041 |
| core-11 no anime, gritty crime show | negation | 1.000 | 0.945 | +0.055 |
| core-22 time loop | subject_object | 1.000 | 0.934 | +0.066 |
| core-13 I want something tense that keeps me guessing, but I don’t w | long_descriptive | 0.719 | 0.628 | +0.091 |
| lab-11 fantasy with dragons | subject_object | 0.946 | 0.845 | +0.101 |
| new-04 quiet and lonely in deep space | setting_mood | 0.904 | 0.765 | +0.138 |
| core-06 tense but not bleak | negation | 0.770 | 0.604 | +0.166 |
| core-23 slow atmospheric science fiction | setting_mood | 0.839 | 0.672 | +0.167 |
| lab-12 like groundhog day | like_x_but_y | 0.857 | 0.684 | +0.173 |
| new-07 like The Matrix but anime | like_x_but_y | 0.430 | 0.251 | +0.179 |
| new-02 two geniuses in a battle of wits | subject_object | 0.854 | 0.674 | +0.180 |
| new-09 80s sci-fi action | era_genre | 0.784 | 0.595 | +0.189 |
| new-21 un dessin animé drôle pour toute la famille | non_english | 0.453 | 0.251 | +0.201 |
| lab-01 tarkovsky | creator | 0.643 | 0.424 | +0.219 |
| core-27 Quiero una serie policial realista y cruda, sin animación ni | non_english | 0.870 | 0.645 | +0.225 |
| core-30 spannend aber nicht düster | non_english | 0.858 | 0.631 | +0.227 |
| core-21 funny | short_vague | 0.443 | 0.212 | +0.230 |
| lab-00 complete nonsense | short_vague | 0.712 | 0.439 | +0.274 |
| lab-03 slow burn space horror | setting_mood | 0.528 | 0.218 | +0.310 |
| new-15 nonlinear storytelling | structural | 0.588 | 0.241 | +0.348 |
| new-13 smart sci-fi for adults | audience | 1.000 | 0.616 | +0.384 |
| lab-02 feel good cooking show | setting_mood | 0.807 | 0.415 | +0.391 |
| core-15 A crime show that feels grubby and real. No animation, and n | long_descriptive | 0.755 | 0.335 | +0.419 |
| core-25 something short to watch after work | audience | 0.955 | 0.509 | +0.446 |
| core-19 cozy | short_vague | 0.797 | 0.253 | +0.544 |
| new-19 A crew of misfits on a beat-up spaceship taking odd jobs on  | long_descriptive | 0.695 | 0.118 | +0.577 |
| core-04 Incepton | typo | 0.794 | 0.216 | +0.578 |
| new-11 comedy without romance | negation | 1.000 | 0.042 | +0.958 |

## dev: grade-0 titles in the top 5 of r2-combo-bgeb-strict

| query | rank | title | year |
|---|---|---|---|
| lab-03 slow burn space horror | 3 | Texhnolyze | 2003 |
| lab-10 sunglasses at night | 5 | Blue Velvet | 1986 |
| lab-12 like groundhog day | 4 | Jack Frost | 1979 |
| core-04 Incepton | 5 | Stranger Things | 2016 |
| core-08 sunglasses | 3 | La Dolce Vita | 1960 |
| core-08 sunglasses | 4 | Sin City | 2005 |
| core-13 I want something tense that keeps me guessing, but | 4 | Shutter Island | 2010 |
| new-09 80s sci-fi action | 3 | Star Trek Into Darkness | 2013 |

## Per query anchor hits in the top 10 / top 50 (all splits)

| query | split | type | prod | prod-replay | fp-count | emb-e5s | emb-e5s-notitle | emb-bgeb | hyb-lin | hyb-rrf | emb-then-fp | nojev-knn | hyb-lin+prior | neg | facet | prior-gated | title-strict | notext | bgeb-notitle | r2-combo | r2-combo-bgeb | r2-combo-strict | r2-combo-bgeb-strict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lab-00 complete nonsense | dev | short_vague | 2/2 | 2/2 | 2/2 | 0/1 | 0/0 | 0/0 | 2/2 | 1/2 | 0/0 | 0/0 | 2/3 | 2/3 | 2/3 | 2/2 | 2/3 | 0/2 | 2/2 | 2/3 | 1/2 | 2/3 | 1/2 |
| lab-01 tarkovsky | dev | creator | 0/1 | 0/1 | 0/0 | 0/1 | 0/1 | 0/3 | 0/2 | 0/2 | 0/2 | 0/1 | 0/3 | 0/3 | 0/3 | 0/2 | 1/3 | 0/3 | 0/3 | 0/3 | 0/3 | 1/3 | 2/3 |
| lab-02 feel good cooking show | dev | setting_mood | 1/2 | 1/2 | 2/2 | 1/3 | 2/3 | 3/3 | 3/3 | 2/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| lab-03 slow burn space horror | dev | setting_mood | 0/0 | 0/0 | 1/1 | 0/1 | 0/1 | 1/2 | 1/3 | 1/3 | 0/1 | 0/1 | 2/3 | 2/3 | 2/3 | 1/3 | 2/3 | 3/3 | 2/3 | 2/3 | 2/2 | 2/3 | 2/2 |
| lab-04 tense heist thriller, not bleak | dev | negation | 2/2 | 2/2 | 0/0 | 0/0 | 0/0 | 0/0 | 1/2 | 1/2 | 0/1 | 0/0 | 2/2 | 2/3 | 2/2 | 1/2 | 2/2 | 1/3 | 2/2 | 2/3 | 2/2 | 2/3 | 2/2 |
| lab-05 grief after losing a child | holdout | subject_object | 0/1 | 0/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/2 | 0/2 | 1/2 | 1/1 | 2/2 | 2/2 | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| lab-08 melancholy lighthouse keeper mystery | holdout | setting_mood | 1/1 | 1/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| lab-09 scifi with cars | holdout | subject_object | 1/1 | 1/1 | 1/1 | 0/2 | 0/3 | 1/2 | 2/3 | 1/2 | 1/3 | 0/3 | 3/4 | 3/4 | 3/4 | 2/3 | 3/4 | 1/3 | 1/4 | 3/4 | 1/4 | 3/4 | 1/4 |
| lab-10 sunglasses at night | dev | subject_object | 1/1 | 1/1 | 1/1 | 0/0 | 0/1 | 0/0 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| lab-11 fantasy with dragons | dev | subject_object | 1/4 | 1/4 | 1/4 | 0/1 | 1/3 | 1/4 | 2/4 | 1/4 | 1/3 | 0/3 | 2/4 | 2/4 | 2/4 | 2/4 | 2/5 | 3/3 | 2/5 | 2/4 | 3/4 | 2/4 | 3/4 |
| lab-12 like groundhog day | dev | like_x_but_y | 1/3 | 1/3 | 0/0 | 0/0 | 0/1 | 1/1 | 1/2 | 1/3 | 1/1 | 0/0 | 2/2 | 2/2 | 2/2 | 1/2 | 2/2 | 1/1 | 1/3 | 2/2 | 1/3 | 2/2 | 1/3 |
| lab-13 time travel complex | dev | structural | 3/3 | 3/3 | 3/5 | 0/1 | 0/0 | 1/1 | 4/5 | 4/5 | 3/5 | 0/1 | 5/5 | 5/5 | 5/5 | 4/5 | 5/5 | 3/5 | 4/5 | 5/5 | 4/5 | 5/5 | 4/5 |
| core-04 Incepton | dev | typo | 1/1 | 1/1 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 1/1 | 1/1 | 1/1 | 0/0 | 1/1 | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| core-06 tense but not bleak | dev | negation | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-07 car chases | dev | subject_object | 1/3 | 1/3 | 1/3 | 0/0 | 0/1 | 1/2 | 1/4 | 1/4 | 0/3 | 0/1 | 3/4 | 3/4 | 3/4 | 1/4 | 3/4 | 1/3 | 1/4 | 3/4 | 1/4 | 3/4 | 2/4 |
| core-08 sunglasses | dev | subject_object | 1/2 | 1/2 | 1/2 | 0/1 | 0/1 | 0/1 | 1/1 | 1/2 | 1/1 | 0/1 | 1/2 | 1/2 | 1/2 | 1/1 | 1/2 | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 |
| core-09 unreliable narrator | holdout | structural | 2/2 | 2/2 | 1/1 | 0/0 | 0/0 | 0/1 | 0/2 | 0/2 | 0/0 | 0/0 | 1/2 | 1/2 | 1/2 | 0/2 | 1/2 | 1/2 | 2/3 | 1/2 | 2/3 | 1/2 | 2/3 |
| core-10 dark comedy about rich people | holdout | subject_object | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 0/2 | 0/1 | 1/3 | 1/1 | 2/3 | 2/3 | 2/3 | 0/2 | 2/3 | 2/3 | 1/3 | 2/3 | 1/3 | 2/3 | 1/3 |
| core-11 no anime, gritty crime show | dev | negation | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 1/1 | 0/0 | 0/1 | 0/0 | 1/1 | 1/1 | 1/1 | 0/0 | 0/2 | 0/0 | 0/2 |
| core-13 I want something tense that keeps me gue | dev | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/1 |
| core-14 Rich people being absolutely awful to ea | holdout | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/3 | 1/3 | 1/3 | 1/1 | 1/3 | 1/2 | 0/3 | 1/3 | 0/3 | 1/3 | 0/3 |
| core-15 A crime show that feels grubby and real. | dev | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/1 | 0/0 | 0/1 | 0/1 | 1/1 | 0/1 | 1/2 | 0/1 | 1/2 |
| core-16 Something where halfway through you real | holdout | long_descriptive | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/0 | 0/2 | 0/2 | 1/2 | 0/0 | 1/1 | 0/0 | 1/1 |
| core-17 Give me car chases, but make it more get | dev | long_descriptive | 2/4 | 2/4 | 3/4 | 1/3 | 0/2 | 1/3 | 2/4 | 3/3 | 1/3 | 0/2 | 2/4 | 2/4 | 2/4 | 2/4 | 2/4 | 2/2 | 2/4 | 2/4 | 2/4 | 2/4 | 2/4 |
| core-18 Brain’s fried. Something warm and funny, | holdout | long_descriptive | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/1 | 0/0 |
| core-19 cozy | dev | short_vague | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-20 bleak | holdout | short_vague | 0/1 | 0/1 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/1 | 0/1 | 0/1 | 0/0 | 1/1 | 0/1 | 0/1 | 0/1 | 0/1 | 1/1 | 1/2 |
| core-21 funny | dev | short_vague | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 |
| core-22 time loop | dev | subject_object | 0/4 | 0/4 | 0/3 | 0/0 | 0/0 | 0/0 | 0/2 | 0/2 | 0/1 | 0/0 | 0/4 | 0/4 | 0/4 | 0/2 | 2/4 | 0/3 | 0/4 | 0/4 | 0/4 | 2/4 | 1/4 |
| core-23 slow atmospheric science fiction | dev | setting_mood | 1/2 | 1/2 | 0/1 | 0/1 | 0/0 | 1/2 | 1/3 | 1/2 | 0/1 | 0/0 | 2/5 | 2/5 | 2/5 | 1/3 | 2/5 | 2/4 | 2/5 | 2/5 | 3/4 | 2/5 | 3/4 |
| core-24 a hopeful space adventure without horror | holdout | negation | 0/2 | 0/2 | 1/2 | 0/0 | 0/1 | 1/1 | 0/1 | 0/2 | 0/1 | 0/1 | 1/3 | 1/3 | 1/3 | 0/1 | 1/3 | 3/3 | 1/3 | 1/3 | 0/3 | 1/3 | 0/3 |
| core-26 Ich suche etwas Spannendes, das mich rät | dev | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-27 Quiero una serie policial realista y cru | dev | non_english | 1/1 | 1/1 | 1/1 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/0 | 1/2 | 1/2 | 1/2 | 0/1 | 1/2 | 1/2 | 1/2 | 0/2 | 0/2 | 0/2 | 0/2 |
| core-28 Des gens riches qui se comportent horrib | holdout | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| core-29 Kafam çok yorgun. Sıcak ve komik ama aşı | holdout | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| core-30 spannend aber nicht düster | dev | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-01 heist on a train | holdout | subject_object | 1/1 | 1/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/2 | 1/2 | 1/1 | 1/2 | 1/1 | 1/1 |
| new-02 two geniuses in a battle of wits | dev | subject_object | 1/1 | 1/1 | 0/1 | 0/0 | 0/0 | 0/1 | 1/3 | 1/2 | 0/1 | 0/0 | 3/3 | 3/3 | 3/3 | 1/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| new-03 satire about politics or big corporation | holdout | subject_object | 0/0 | 0/0 | 0/1 | 0/1 | 0/1 | 0/1 | 0/0 | 0/0 | 0/2 | 0/1 | 0/2 | 0/2 | 0/2 | 0/0 | 0/2 | 0/3 | 1/2 | 0/2 | 1/2 | 0/2 | 1/2 |
| new-04 quiet and lonely in deep space | dev | setting_mood | 1/1 | 1/1 | 1/1 | 0/1 | 0/1 | 0/2 | 1/2 | 1/1 | 0/3 | 0/2 | 1/3 | 1/3 | 1/3 | 1/2 | 1/3 | 2/4 | 1/4 | 1/3 | 1/3 | 1/3 | 1/3 |
| new-05 rainy neon cyberpunk city | holdout | setting_mood | 0/2 | 0/2 | 0/3 | 0/0 | 0/1 | 0/0 | 0/3 | 1/4 | 1/3 | 1/1 | 2/5 | 2/5 | 2/4 | 0/3 | 2/5 | 3/5 | 1/5 | 2/4 | 1/5 | 2/4 | 1/5 |
| new-06 kung fu comedy | holdout | subject_object | 2/3 | 2/3 | 1/1 | 2/4 | 2/5 | 2/4 | 2/5 | 3/4 | 4/5 | 2/5 | 3/5 | 3/5 | 3/5 | 3/5 | 3/5 | 4/5 | 3/4 | 3/5 | 3/4 | 3/5 | 3/4 |
| new-07 like The Matrix but anime | dev | like_x_but_y | 1/1 | 1/1 | 1/1 | 2/2 | 2/3 | 2/2 | 1/3 | 1/3 | 1/3 | 0/3 | 2/3 | 2/3 | 2/3 | 1/3 | 2/3 | 1/3 | 2/3 | 2/3 | 2/3 | 2/3 | 2/3 |
| new-08 like Breaking Bad but a comedy | holdout | like_x_but_y | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/2 | 1/1 | 0/1 | 0/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| new-09 80s sci-fi action | dev | era_genre | 0/1 | 0/1 | 1/1 | 0/1 | 0/0 | 1/2 | 1/2 | 0/1 | 0/0 | 0/0 | 2/4 | 2/4 | 2/4 | 1/2 | 2/4 | 0/3 | 2/3 | 2/4 | 1/3 | 2/4 | 1/3 |
| new-10 90s crime movies with great dialogue | holdout | era_genre | 0/0 | 0/0 | 0/0 | 1/2 | 1/2 | 2/4 | 1/3 | 1/2 | 2/2 | 1/2 | 4/4 | 4/4 | 3/4 | 1/3 | 4/4 | 4/4 | 3/4 | 3/4 | 3/4 | 3/4 | 3/4 |
| new-11 comedy without romance | dev | negation | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-12 war movie that isn't about World War II | holdout | negation | 0/0 | 0/0 | 0/2 | 0/0 | 0/0 | 0/0 | 0/0 | 0/2 | 0/0 | 0/0 | 0/4 | 0/3 | 0/3 | 0/0 | 0/4 | 0/4 | 0/4 | 0/3 | 0/5 | 0/3 | 0/5 |
| new-13 smart sci-fi for adults | dev | audience | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/0 | 0/1 | 0/2 | 0/1 | 0/0 | 0/1 | 0/0 | 0/1 |
| new-14 good first anime for someone who never w | holdout | audience | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-15 nonlinear storytelling | dev | structural | 0/3 | 0/3 | 1/2 | 0/0 | 0/0 | 0/1 | 0/2 | 0/1 | 0/0 | 0/0 | 1/3 | 1/3 | 1/3 | 0/2 | 1/3 | 1/4 | 2/4 | 1/3 | 2/4 | 1/3 | 2/4 |
| new-16 whole movie takes place in one room | holdout | structural | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/1 | 0/0 | 0/1 | 0/1 | 1/1 | 0/1 | 1/1 | 0/1 | 1/1 |
| new-17 mindbending | dev | short_vague | 1/2 | 1/2 | 0/1 | 0/0 | 0/0 | 0/1 | 0/1 | 1/1 | 0/0 | 0/0 | 1/2 | 1/2 | 1/2 | 0/1 | 1/2 | 1/3 | 2/4 | 1/2 | 2/4 | 1/2 | 2/4 |
| new-18 wholesome | holdout | short_vague | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-19 A crew of misfits on a beat-up spaceship | dev | long_descriptive | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 | 0/1 | 1/1 | 1/1 | 0/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/2 | 1/1 | 1/2 |
| new-20 An ordinary guy slowly realises his whol | holdout | long_descriptive | 1/1 | 1/1 | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 1/1 | 0/1 | 0/0 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/2 | 1/1 | 1/2 | 1/1 | 1/2 |
| new-21 un dessin animé drôle pour toute la fami | dev | non_english | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| new-22 Antikriegsfilm, der zeigt, wie sinnlos K | holdout | non_english | 1/1 | 1/1 | 1/1 | 1/3 | 0/0 | 0/0 | 0/1 | 1/1 | 0/1 | 0/0 | 1/4 | 1/4 | 1/4 | 0/1 | 1/4 | 1/4 | 2/2 | 1/4 | 2/2 | 1/4 | 2/2 |
| new-23 psycological thriler with a big twist | holdout | typo | 0/1 | 0/1 | 0/0 | 0/0 | 0/0 | 0/1 | 0/1 | 0/0 | 0/0 | 0/0 | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 | 0/1 | 3/4 | 1/1 | 2/4 | 1/1 | 2/4 |

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
| neg | 20.1 | 19.0 | crate_text, qemb, qdrant_emb, fp_full, qemb_extra | 154 | -81 |
| facet | 18.3 | 31.3 | crate_text, qemb, qdrant_emb, fp_full, qemb_extra | 154 | -81 |
| prior-gated | 11.8 | 19.6 | crate_text, qemb, qdrant_emb, fp_full | 154 | -81 |
| title-strict | 10.3 | 13.5 | crate_text, qemb, qdrant_emb, fp_full, fuzzy_title | 156 | -79 |
| notext | 11.1 | 16.9 | qemb, qdrant_emb, fp_full | 27 | -208 |
| bgeb-notitle | 37.6 | 28.7 | crate_text, qemb, qdrant_emb, fp_full | 154 | -81 |
| r2-combo | 17.9 | 32.4 | crate_text, qemb, qdrant_emb, fp_full, qemb_extra, fuzzy_title | 156 | -79 |
| r2-combo-bgeb | 30.8 | 53.0 | crate_text, qemb, qdrant_emb, fp_full, qemb_extra, fuzzy_title | 156 | -79 |
| r2-combo-strict | 19.9 | 39.7 | crate_text, qemb, qdrant_emb, fp_full, qemb_extra, fuzzy_title | 156 | -79 |
| r2-combo-bgeb-strict | 32.7 | 57.7 | crate_text, qemb, qdrant_emb, fp_full, qemb_extra, fuzzy_title | 156 | -79 |
