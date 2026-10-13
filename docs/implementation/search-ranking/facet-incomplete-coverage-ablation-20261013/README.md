# Local facet and incomplete coverage ablation

This evidence records one failed local v1 invocation and one separately authorized successful v2 study. It supports the investigation in #100 and #407; it does not establish ranking quality, production latency or acceptance. Issue #406 remains closed.

The completed study includes 101 English non-reference queries, with 94 graded queries and seven title guards. It retains the original score weights and preparation gates. Facets are enabled for 36 queries and unit coverage for 34. No application, frontend, host, production request or model changed during the study. The previously authorized 132 local encodings are inputs, documented separately in [the encoder evidence](../facet-unit-encoder-20261013/README.md).

| Variant | Mean NDCG@10 | Explicit grade-zero results in top five | Unjudged top-ten results |
| --- | ---: | ---: | ---: |
| C0 base | 0.459234 | 33 | 412 |
| CX base | 0.477937 | 31 | 397 |
| CX facets | 0.491747 | 29 | 383 |
| CX incomplete dense coverage | 0.485169 | 36 | 399 |
| CX facets and incomplete dense coverage | 0.499023 | 35 | 380 |

C0 reproduces the previous [common-union fingerprint study](../common-union-fingerprint-ablation-20261013/README.md) top-100 IDs and scores exactly. C0→CX changes candidates and the population used for standardization. All four CX variants share one expanded population, isolating the fixed facet and incomplete coverage score terms. The maximum observed pool was 1,874, below the fixed 2,800 bound.

Facets use the original 0.1 mean of individually standardized facet columns. The explicitly **INCOMPLETE** coverage ablation uses 0.3 times the standardized minimum of individually standardized dense unit columns. BM25 unit scores and retrieval are unavailable: this is not the complete production coverage signal. Facets reduced aggregate known bad results on the shared pool; incomplete coverage raised them. On holdout5, the CX base/facets/incomplete coverage/both bad-five counts are 5/5/9/9. No quality threshold or pass is introduced.

All variants retain five of seven expected titles at rank 1 and six of seven in the top 20. Production title blending is omitted. Unjudged results remain unjudged, not negative labels. The index and current public catalog are not a historical transaction; their drift is retained. Int8 local dense columns approximate Qdrant float scores. BM25, references, profiles, taste, the full hybrid ranking and current final overlap remain uncomputed. [The exact interpretation](v2/ACTUAL-INTERPRETATION.md) includes per-query regression and coverage qualifications.

V1 exited 1 before output because it read catalog-drift metadata from the new folder rather than the already-bound previous study. Its source, invocation and stderr are preserved unchanged in [v1](v1/). V2 corrected that path and added a pre-compute input preflight and missing/unbound/changed-input regressions. Scoring modules are byte-identical between the versions. V2 authenticates 248 inputs, including compressed index data, matrices, captures, derivative dependencies and evaluator references. The source READMEs and manifests retain their original prepared-only state; exclusive later actual receipts establish execution.

The v2 runner exited 0 in 29.998 s, and the separately invoked evaluator exited 0 in 1.269 s. Summed per-query computation was 26.009 s. These are local study timings, not production request timings. Both stderr files are empty. Independent retained-result validation checks all masks, unique aligned pools, source-gate records, component standardization and five top-100 additive rankings. Candidate-only reconstruction exactly reproduces 200,593 retained partial cosine values across 153 columns. Full-index partial top-300 retrieval was enforced by the reviewed runner, but was not independently rescanned. Component arithmetic reconstruction differed by at most 2.665e-15.

The author and root each ran 11 Node fixtures and two Python evaluator fixtures, including the original three hand-calculated metric checks. Root additionally verified all 101 baseline results, all 153 normalization columns and direct grade-zero counts 33/31/29/36/35. These checks are distinct from a full independent study rerun.

[Evidence bindings](evidence-bindings.json) authenticate 52 byte-exact original source, fixture, invocation, output, metric and validation copies plus one losslessly compressed exact source delta. They retain the hash of the omitted 57,383,197-byte rankings file. Matrices, caches, full index data and corpus captures are not duplicated. Existing input authorities remain hash-bound in [the input closure](v2/input-bindings.json). Original absolute local paths and relative derivative imports are preserved: the copied source is an archival packet, not a standalone command to rerun from this docs directory. Reproduction requires restoring those exact reviewed inputs and dependencies into a fresh output scope; existing exclusive outputs must never be overwritten. No further execution is authorized by these instructions.
