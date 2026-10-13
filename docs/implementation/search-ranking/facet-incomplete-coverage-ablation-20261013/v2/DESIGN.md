# Next offline facet and incomplete coverage study

Design only: no scoring study, encoder, application, host or production request is executed by this packet. Preserve the completed common-union study unchanged. Proceed to a concrete runner only after root reviews this design and the exact successor encoder run/cache evidence. No quality threshold or PASS is introduced.

Use the same 101 English-routed nonreference captures, 94 graded cases and seven separate title guards. Keep the pinned 42,934-row index, raw unnormalized 74-dimensional fingerprint matrix, original masks intersected with mandatory validity, original signed reading weights, dense/negative rules and priors. Keep current catalog drift visible; do not replace index votes or silently filter the 29 current below-floor records. The one missing fingerprint remains excluded from every variant's common valid universe.

## Inputs and gates

Authenticate the current source/input manifests, completed rankings/metrics, masks, validity/raw matrix, index files, grades/queries/historical references, source helpers and the new encoder's exact plan/source/dependency/model receipts. Bind the actual merged-cache SHA only after successful execution, observed termination, deadline proof and postflight. Require every previous cache vector to remain bit-exact. A pending cache is unavailable, not a placeholder or permission to encode inside the runner. The intended additions are exactly the existing 132 missing English facet/unit texts; no further encoding, model fallback, network or profile lookup.

Reconstruct `readingFields(cap.language.text ?? cap.query, cap.reading.raw, false)` and original synchronous preparation for each bound capture. The cohort is English-routed/nonreference; `nativeOnly=false` affects summarized chips, not these English fingerprint/filter inputs. Use the original pure parsing helpers and word-frequency/collocation adapter already bound to `loadBuild`, rather than new token or entity rules.

Facets: only when `positive` is truthy, call original `facets(searchedPhrases, negated, empty reference-word set)` because this cohort has no found reference. The helper removes phrases containing negated/reference words and returns no facets unless at least two survive. Preserve helper ordering and any source-retained duplicate phrases; do not introduce a new deduplication policy.

Coverage units: original `!found && tokens(positive).length <= 5` gate; `facetUnits` uses spell-corrected content words, stopword/generic/numeric exclusions, collocation joins and overlap/dedup rules, returning at least two units. Then require at least one unit word to match a decoded `isConcrete` word. If that check fails, the whole unit set is empty. Do not add a guessed genre, reference or long-query gate. Existing source-derived availability has 36 facet-active and 34 unit-active queries; changing these counts must refuse or be explicitly investigated before scoring.

## Retrieval and common comparators

For each query, let C0 be the completed filtered/common-valid dense top500 ∪ rawDot top500. Independently verify the retained pools against source/input hashes; local int8 dense is an approximation, not Qdrant ANN/float parity.

For each active facet and coverage unit, scan the same valid mask using the original English768 quantized cosine primitive. Take the local top300 per text (source PART_DEPTH), including nonpositive scores as original dense `joinAll` does. Preserve stable index-row ties. No per-title BM25/sparse postings are available: do not generate a guessed BM25 top list or label a zero array as observed BM25.

Let CX = C0 ∪ all facet-dense top300 ∪ all unit-dense top300. Retain C0, each partial list and CX IDs. The existing availability record has at most two facet lists, four unit lists and six combined lists, so CX has at most 2,800 rows before overlap; still require every row eligible/common-valid and enforce this bound. If those list counts change, refuse pending source review rather than silently widen the computation.

Compute five variants, retaining every component over its declared population:

1. Original dense+raw fingerprint+negation+priors over C0, for exact prior baseline comparison.
2. The same base score over CX, with all z statistics recomputed over CX.
3. Variant 2 plus original facet term: `0.1 * mean_over_facets(z_CX(facetCosine))`. There is no outer z of the facet mean.
4. Variant 2 plus explicitly **incomplete dense-only coverage**: `0.3 * z_CX(min_over_units(z_CX(unitCosine)))`.
5. Variant 2 plus both terms 3 and 4.

A missing/empty active signal adds no term. Each shared-CX comparison uses identical candidates, source weights and base components. C0 versus CX base isolates retrieval/population effects jointly, not a pure weight effect. CX base versus facets isolates the facet term; CX base versus incomplete coverage isolates the declared missing-BM25 surrogate. CX+facets versus CX+both isolates that surrogate in facet context. Never compare expanded scored output against C0 and attribute the entire difference to a single term.

The production coverage formula is `0.3 * z(min_over_units(z(unitDense) + 0.5*z(unitBM25)))`. Variant 4 deliberately omits both the BM25 score contribution and BM25 retrieval candidates. It is not exact coverage replay, not proof that production coverage helps or hurts, and not a new application ranker. Even the facet formula preserves only aggregation: local int8 scores approximate Qdrant stored floats and local top300 approximates production retrieval.

## Evidence and checks

Before any actual run, freeze the concrete source and input manifest; use O_EXCL fresh local outputs. No retry, overwrite or rerun of previous studies. Authenticate helpers before import, run only pure helpers and local matrices/cache, and write typed omissions instead of fabricated measurements.

Meaningful fixtures must cover: original facet positive/negation/minimum-phrase gates; unit short-query/concrete-word/collocation gates; signed raw Dot and missing-row validity; shared CX equality and stable ties; original facet mean(z) against a hand calculation that distinguishes outer-z; min over per-unit z followed by outer-z; an explicit example showing unknown BM25 can change coverage ordering; constant/empty signal behavior; unchanged base scores with the same population; fixed .1/.3/.48 weights; C0-vs-CX pool effect separate from weight effect; known grade/alternate-cut arithmetic and title namespace/rank outcomes.

Retain top100 outputs, all pool IDs and component columns or sufficient population values so the exact added terms can be independently checked. Reuse original #145 metric arithmetic and grades, current frozen cut adapter, 22 overlapping historical holdout5 comparisons and zero aligned r6 holdout4 comparisons; never replace current-final overlap with historical overlap. Report overall/per-class/per-split, all seven title guards, individual known-bad regressions, unjudged coverage, anchors/avoids and directly observed candidate coverage with catalog-versus-eligible denominator qualifications.

Specifically inspect the fourteen previously bad-increase queries, subject/object, setting/mood and holdout2. Five previously bad-increase queries have neither facet nor coverage active, so these terms cannot alone explain or suppress every regression. No organic share or quality threshold is inferred. Local scan/score timings exclude upstream reading/catalog/taste/transport/contended VM conditions and cannot establish the <1500 ms acceptance requirement.
