# Round 2 sweeps (dev only)

Proxy NDCG@10: ungraded titles skipped (condensed list), `cov` = graded share of the top 10, `bad5` = grade-0 titles in the top 5 (graded only). `inc@` = rank of Inception for "Incepton". Base = hyb-lin+prior (e5s-notitle, a 0.4, b 0.42, c 0.18, prior 0.1/0.1 additive).

| config | proxy ndcg10 | cov | bad5 | anchor10 | anchor50 | title@1 | Incepton rank |
|---|---|---|---|---|---|---|---|
| base (hyb-lin+prior) | 0.746 | 1.00 | 16 | 0.333 | 0.550 | 4/4 | 7 |
| base no prior (hyb-lin) | 0.723 | 1.00 | 10 | 0.190 | 0.397 | 4/4 | None |
| neg lam=0.1 | 0.753 | 0.91 | 12 | 0.323 | 0.550 | 4/4 | 7 |
| neg lam=0.2 | 0.746 | 0.89 | 12 | 0.323 | 0.569 | 4/4 | 7 |
| neg lam=0.3 | 0.744 | 0.86 | 13 | 0.313 | 0.576 | 4/4 | 7 |
| neg lam=0.5 | 0.714 | 0.82 | 13 | 0.313 | 0.557 | 4/4 | 7 |
| neg lam=0.8 | 0.684 | 0.77 | 11 | 0.321 | 0.523 | 4/4 | 7 |
| neg pos-only | 0.751 | 0.92 | 15 | 0.323 | 0.550 | 4/4 | 7 |
| neg lam=0.3 avoid=0.5 | 0.735 | 0.85 | 13 | 0.317 | 0.557 | 4/4 | 7 |
| neg lam=0.3 avoid=1.0 | 0.724 | 0.83 | 13 | 0.317 | 0.544 | 4/4 | 7 |
| facet f=0.1 auto | 0.741 | 0.98 | 16 | 0.323 | 0.544 | 4/4 | 7 |
| facet f=0.1 phrases | 0.749 | 0.99 | 14 | 0.323 | 0.544 | 4/4 | 7 |
| facet f=0.1 chunks | 0.741 | 0.99 | 16 | 0.333 | 0.550 | 4/4 | 7 |
| facet f=0.2 auto | 0.738 | 0.97 | 14 | 0.307 | 0.521 | 4/4 | 7 |
| facet f=0.2 phrases | 0.745 | 0.98 | 14 | 0.307 | 0.521 | 4/4 | 7 |
| facet f=0.2 chunks | 0.741 | 0.98 | 14 | 0.333 | 0.540 | 4/4 | 7 |
| facet f=0.3 auto | 0.742 | 0.95 | 14 | 0.293 | 0.495 | 4/4 | 7 |
| facet f=0.3 phrases | 0.745 | 0.96 | 14 | 0.293 | 0.511 | 4/4 | 7 |
| facet f=0.3 chunks | 0.743 | 0.98 | 14 | 0.333 | 0.524 | 4/4 | 7 |
| facet f=0.5 auto | 0.731 | 0.93 | 14 | 0.283 | 0.485 | 4/4 | 7 |
| facet f=0.5 phrases | 0.734 | 0.93 | 15 | 0.266 | 0.491 | 4/4 | 7 |
| facet f=0.5 chunks | 0.739 | 0.97 | 13 | 0.340 | 0.524 | 4/4 | 7 |
| prior mult p=0.1 | 0.726 | 0.96 | 12 | 0.220 | 0.485 | 4/4 | 49 |
| prior mult p=0.2 | 0.734 | 0.92 | 15 | 0.250 | 0.530 | 4/4 | 36 |
| prior mult p=0.3 | 0.734 | 0.89 | 16 | 0.288 | 0.551 | 4/4 | 30 |
| prior mult p=0.5 | 0.723 | 0.82 | 20 | 0.272 | 0.544 | 4/4 | 21 |
| prior gate k=10 p=0.1 | 0.739 | 1.00 | 12 | 0.190 | 0.397 | 4/4 | None |
| prior gate k=10 p=0.2 | 0.740 | 1.00 | 12 | 0.190 | 0.397 | 4/4 | None |
| prior gate k=10 p=0.4 | 0.746 | 1.00 | 13 | 0.190 | 0.397 | 4/4 | None |
| prior gate k=20 p=0.1 | 0.734 | 0.96 | 13 | 0.227 | 0.397 | 4/4 | None |
| prior gate k=20 p=0.2 | 0.723 | 0.91 | 19 | 0.217 | 0.397 | 4/4 | None |
| prior gate k=20 p=0.4 | 0.717 | 0.88 | 18 | 0.220 | 0.397 | 4/4 | None |
| prior gate k=30 p=0.1 | 0.736 | 0.96 | 13 | 0.248 | 0.404 | 4/4 | None |
| prior gate k=30 p=0.2 | 0.736 | 0.89 | 16 | 0.238 | 0.404 | 4/4 | None |
| prior gate k=30 p=0.4 | 0.723 | 0.83 | 18 | 0.235 | 0.404 | 4/4 | None |
| prior gate k=50 p=0.1 | 0.743 | 0.97 | 12 | 0.294 | 0.421 | 4/4 | None |
| prior gate k=50 p=0.2 | 0.745 | 0.85 | 16 | 0.290 | 0.421 | 4/4 | None |
| prior gate k=50 p=0.4 | 0.735 | 0.77 | 15 | 0.277 | 0.411 | 4/4 | None |
| title-strict s=0.8 fuzzy=.88 | 0.693 | 0.90 | 16 | 0.357 | 0.555 | 4/4 | 1 |
| title-strict s=0.85 fuzzy=.88 | 0.690 | 0.89 | 17 | 0.357 | 0.555 | 4/4 | 1 |
| title-strict s=0.9 fuzzy=.88 | 0.687 | 0.89 | 17 | 0.357 | 0.555 | 4/4 | 1 |
| title-strict s=0.95 fuzzy=.88 | 0.687 | 0.89 | 17 | 0.357 | 0.555 | 4/4 | 1 |
| title-strict s=0.9 no fuzzy | 0.673 | 0.89 | 18 | 0.357 | 0.555 | 4/4 | 7 |
| fuzzy only .88 | 0.761 | 1.00 | 15 | 0.333 | 0.550 | 4/4 | 1 |
| notext a=0.4 | 0.731 | 0.78 | 18 | 0.264 | 0.517 | 4/4 | 7 |
| notext a=0.5 | 0.726 | 0.86 | 14 | 0.226 | 0.516 | 4/4 | 11 |
| notext a=0.6 | 0.708 | 0.88 | 18 | 0.227 | 0.475 | 4/4 | 29 |
| notext a=0.7 | 0.656 | 0.91 | 20 | 0.188 | 0.389 | 4/4 | None |
| bgeb-notitle a=0.3 | 0.739 | 0.76 | 16 | 0.350 | 0.581 | 4/4 | 5 |
| bgeb-notitle a=0.4 | 0.741 | 0.75 | 10 | 0.298 | 0.569 | 4/4 | 20 |
| bgeb-notitle a=0.5 | 0.725 | 0.72 | 10 | 0.281 | 0.484 | 4/4 | None |
| bgeb (with title) a=0.4 | 0.738 | 0.76 | 8 | 0.350 | 0.575 | 4/4 | 3 |

## Combinations (dev proxy, before round-2 grading)

Same columns. neg = lambda 0.1, facet = 0.1 on Jev phrases, gate = prior 0.4/0.4 gated to the top 10, fuzzy = catalog
fuzzy title match at 0.88, strict = title bonus only at similarity >= 0.9 (+ fuzzy), bgebnt = bgeb-notitle embedding.

| config | proxy ndcg10 | cov | bad5 | anchor10 | anchor50 | title@1 | Incepton rank |
|---|---|---|---|---|---|---|---|
| neg+fuzzy | 0.768 | 0.91 | 11 | 0.323 | 0.550 | 4/4 | 1 |
| neg+facet+fuzzy | 0.770 | 0.90 | 11 | 0.313 | 0.544 | 4/4 | 1 |
| neg+facet+gate+fuzzy | 0.748 | 0.87 | 13 | 0.212 | 0.416 | 4/4 | 1 |
| neg+gate+fuzzy | 0.764 | 0.88 | 12 | 0.220 | 0.416 | 4/4 | 1 |
| facet+fuzzy | 0.764 | 0.99 | 13 | 0.323 | 0.544 | 4/4 | 1 |
| neg+facet+strict | 0.696 | 0.79 | 13 | 0.338 | 0.544 | 4/4 | 1 |
| bgebnt+neg+facet+fuzzy | 0.771 | 0.69 | 7 | 0.302 | 0.578 | 4/4 | 1 |
| bgebnt+neg+fuzzy | 0.764 | 0.69 | 8 | 0.318 | 0.600 | 4/4 | 1 |
| bgebnt a.3+neg+fuzzy | 0.752 | 0.72 | 11 | 0.347 | 0.599 | 4/4 | 1 |
| neg.2+facet.2+fuzzy | 0.758 | 0.87 | 11 | 0.298 | 0.530 | 4/4 | 1 |

Caveat: the proxy punished title-strict (0.69 at 0.89 coverage) because its replacements for the removed
title-word hits were ungraded; after grading, title-strict beat the base (see metrics.md). Proxy numbers
with coverage below ~0.9 are not reliable.
