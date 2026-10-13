# Dense and negation ablation evidence

This evidence supports the investigation in #100 and #407. It does not establish usable results, production latency, current-final ranking parity, or acceptance. Issue #406 remains closed. No application implementation or deployment changes are included.

The frozen local study used the verified `20261012T041504Z` index with 42,934 aligned rows and the deployed `927d38b2` scoring primitives. It covers 101 English-routed nonreference queries: 94 graded relevance cases and seven title guardrails. The 67 exclusions comprise 55 English references and 12 non-English routes, including two further references. Exact synchronous preparation texts, stored-reading masks and cached encodings are bound separately. The harness performed no model execution, network requests, production searches or history writes.

| Variant | Mean NDCG@10 (94 queries) | Judged bad@5 total | Unjudged top-ten slots |
|---|---:|---:|---:|
| Dense | 0.3273 | 16 | 598 / 940 |
| Dense + existing priors | 0.3671 | 24 | 557 / 940 |
| Dense + existing negation + priors | 0.3716 | 19 | 552 / 940 |

Unjudged rows contribute zero under the existing metric contract; their absence of grades does not establish poor relevance. Known grade-zero results and only three expected-title-first results out of seven title guardrails nevertheless prevent a usable-result claim. The 22 overlapping historical holdout-five comparisons use older reference lists, not current final results. Current-final overlap is unset.

The study uses actual English 768-dimensional quantized projections, original population z-scores, negative-cosine/label rules and fixed priors. Its candidate pool is only the dense top 500. Fingerprint, BM25, facets, coverage, reference/profile signals, authoritative catalog metadata, taste and final title blending are uncomputed. These omissions change both retrieval coverage and the normalization pool. Local timed computation excludes encoding, reading, catalog, taste, delivery and full ranking; it cannot establish an end-to-end 1.5-second result.

[The frozen study report](study/README.md) gives detailed methods, results and limitations. [Publication qualifications](QUALIFICATIONS.md) correct its reproduction instructions without changing the executed source or reports. The [raw-fingerprint gap memo](raw-fingerprint-gap/README.md) proposes a separate common-union comparison; no raw-fingerprint acquisition or new ablation result is included here.

`evidence-bindings.json` binds every copied artifact to its retained original bytes and SHA-256. Study and input manifests reference the large matrices, vectors, masks, captures and ranking output, which remain outside this publication. The encoder construction is a separately authorized input operation, not an operation performed by this study. Root independently verified all 34 study/input manifest bindings and ran the mathematical primitive checks; this was limited validation, not a full ranking recomputation.

The `encoder-initial`, `encoder-additions`, `prepared-inputs` and `encoder-qualification` directories preserve their original freezes and source qualifications. The native-only qualification does not change this English cohort. No weights, grades, quality threshold or application ranker were invented or tuned.
