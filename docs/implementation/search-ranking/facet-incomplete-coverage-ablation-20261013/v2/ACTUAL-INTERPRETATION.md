# Completed local facet and incomplete coverage study

The separately authorized v2 runner exited 0 in 29.998 s, followed by evaluation exit 0 in 1.269 s. Summed per-query computation was 26.009 s. These local timings include matrix/cache work and are not production search latency. The original v1 failed invocation and source remain unchanged; it produced no rankings. The prepared-only source README describes the earlier preparation state, not this later execution.

All 101 English non-reference queries were included, with 94 graded queries and seven separate title guards. Original facet eligibility enabled 36 queries; original unit eligibility enabled 34. C0 reproduces all previous common-union-fingerprint top-100 IDs and scores exactly. CX adds the same source-gated partial retrieval union to every expanded-pool variant. Its maximum observed size was 1,874, below the fixed 2,800 bound.

| Variant | Mean NDCG@10 | Explicit bad top-five | Unjudged top-ten |
| --- | ---: | ---: | ---: |
| C0 base | 0.459234 | 33 | 412 |
| CX base | 0.477937 | 31 | 397 |
| CX facets | 0.491747 | 29 | 383 |
| CX incomplete dense coverage | 0.485169 | 36 | 399 |
| CX facets and incomplete dense coverage | 0.499023 | 35 | 380 |

C0→CX changes retrieval and the normalization population. Comparisons between CX variants share one population and isolate the fixed original scoring terms. Facets use 0.1 times the mean of individually standardized facet columns. The explicitly INCOMPLETE coverage term uses 0.3 times the standardized minimum of individually standardized dense unit columns. Unit BM25 scores and retrieval are unavailable, so this does not implement the production coverage signal.

Against CX base, facets improved NDCG for 23 queries and worsened it for 11, with no query increasing explicit bad-five count. Incomplete coverage improved 13 and worsened 17, increasing bad-five count in five queries. Both terms improved 28 and worsened 22, with the same five bad-increase queries. On holdout5, CX base/facets/incomplete coverage/both have bad-five counts 5/5/9/9. Thus the largest aggregate NDCG does not establish better relevance on every query or a quality pass.

All five variants retain five of seven expected titles at rank 1 and six of seven in the top 20. These guards omit production title blending and do not prove title-lookup behavior. Graded relevant catalog-pair coverage increases from 1,358 in C0 to 1,362 in CX out of 1,763 known relevant catalog pairs; this denominator is not eligible recall. Unjudged titles remain unjudged rather than being counted as bad.

Independent retained-result validation checked masks, aligned unique candidate pools, source-gate availability records, component population normalization and all five top-100 additive rankings. A separate candidate-only calculation reproduced all 200,593 retained partial cosine values across 153 columns exactly from the bound int8 matrix and cached vectors. It did not independently repeat full-index partial top-300 retrieval scans. Floating-point reconstruction of component aggregation differed by at most 2.665e-15. Every aggregate bad-five count also equals an independent literal grade-zero count.

These results remain local signal evidence. Dense int8 columns approximate Qdrant stored float scores; ANN retrieval, BM25, references, profiles, taste, production title blending, full hybrid ranking and current final overlap remain uncomputed. Catalog/index drift is retained, with no transaction or historical-change timing claim. No new weights, quality threshold, model call, host operation, application change or production request was introduced.
