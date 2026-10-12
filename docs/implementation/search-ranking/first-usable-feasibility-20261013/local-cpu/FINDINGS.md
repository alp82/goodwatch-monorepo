# Actual local scoring primitive, synthetic timing

This is a local-only microbenchmark, not a ranker implementation or production latency proof. Extracted actual deployed source commit 927d38b2cca815f02a0b1636ec06f63c24603396 functions quantizedCosines, meanSd and topIds. Bun removes TypeScript annotations; the function bodies are unchanged. No application module import, production index blob, user query, model, provider, catalog, taste lookup or service was invoked.

The model specifications have 384 multilingual and 768 English dimensions. SearchIndex requires mix-vector rows to equal title-table rows. The actual title-table row count was not measured here. The retained 244262 collection point count is used only as a conservative upper-bound synthetic row count; 61066 active rows is an explicitly hypothetical quarter-mask. Both use the actual Uint8Array eligibility loop. The fixed main depth is500; topIds sorts all input candidates rather than maintaining a heap.

Local Node26.8.1, i7-1185G7,8logicalCPUs; source roles use a different runtime and host. Synthetic typed arrays occupy281394432B; final processRSS464334848B (not peak). Five iterations each, allocation/initialization excluded:

| Mask | Dual dot-product time | Dual dot+statistics+top500 time |
|---|---:|---:|
| Full244262,first |11323ms|13863ms|
| Full244262,warm |1317–2505ms|2700–4053ms|
| Quarter61066 |298–504ms|549–856ms|

These are observed ranges, not p95 or production throughput. No CPU load/concurrency control was imposed. Full dual scans do not substantiate a1.5s overall response target on this local fixture; even warmed scoring alone consumed most or more than the target. The quarter synthetic mask leaves roughly644–951ms to a1.5s target, but encoding, reading, authoritative catalog lookup, per-member taste, filtering/blending/network and production contention were not timed. It is not evidence that those remaining steps fit. Single-channel or smaller actual eligible cohort may differ and must not be extrapolated as proof.

Important semantics: quantizedCosines currently produces compact scores for every selected row to calculate mean/SD in non-English/English-chip mixing; actual retrieval and union rescoring still come from Qdrant. The local int8 approximation is not demonstrated to reproduce authoritative Qdrant float scores or final ranking. Benchmarking topIds across all synthetic rows measures the existing pure sort cost, not an existing application full-catalog retrieval path. Replacing authoritative search with this primitive would change ranking/coverage semantics unless separately designed and validated; no replacement is proposed here.

Prepared-search timing is also not just await prepareSearch. It first awaits the index and parses/resolves references, then starts encoded and fetched concurrently and returns the object. prepared.encoded resolves only after encodeQueryTexts; prepared.done waits for encoding AND optional profile/seed fetch. rankSearch awaits early vectors, late vectors and fetched together, then prepared.done. The deployed combined route starts preparation on fresh-reading claim, while a cached reading prepares later. A person/reference path can still depend on Qdrant prefetch. A truly reading-independent description provisional can use only ready dense preparation; full reading, authoritative catalog and member taste remain distinct dependencies. No actual prepared embedding duration was measured, and no claim is derived from the source's historical p50 comment.

Source hashes/type-erasure provenance and individual numeric observations are retained in source-provenance.json and result.json. The runtime difference, synthetic values, upper-bound cohort, warm-JIT effect, absent index load and absent authoritative downstream work prevent an end-to-end or production conclusion.

## Historical eligible-size refinement

A separately retained historical Sep25 build had50371 title-table rows (not the full collection count); current Oct11 row count remains unknown. Refined actual-function benchmark at50371 synthetic full-mask rows, five iterations each:

| Actual model dimension | Scans | Dot time | Dot plus one primary top500 |
|---|---:|---:|---:|
| English768 |1|163–289ms|244–423ms|
| English768 |2,second negated vector|328–357ms|416–439ms|
| Multilingual384 |1|96–187ms|194–292ms|
| Multilingual384 |2|188–253ms|262–385ms|

The second scan computes a synthetic independently encoded negative-vector score array. No new penalty blend is implemented; one actual topIds call sorts primary scores only. Additional negation transformation/blending, reading-derived mask generation and downstream work are excluded. Allocation/initialization remains excluded; finalRSS190783488B is not a peak. The raw result's provisional384 label is superseded by the explicit source-bound interpretation:384 is multilingual,768 is English. No384-English benchmark claim is made.

This historical-cohort result is a more relevant CPU estimate than the earlier collection-size upper bound for normal English. It leaves roughly1.06s to a1.5s budget at the observed slowest two-English-scan point, but the current cohort and remaining encoder/reading/catalog/taste/network/contention costs are unmeasured. Thus CPU feasibility is plausible on this local historical-size stand-in; end-to-end production feasibility remains unknown. Raw result SHA and dimension correction are recorded in historical-size-summary.json.
