# Search experiment iteration record

**No overall or practical winner has been accepted under the user's cheap-and-fast preference.** The earlier claim that the Flash pipeline was a practical winner is retracted. It is a substantially more expensive quality experiment whose relevance gains do not establish an acceptable cost/latency tradeoff.

## Primary comparison: the original 13 requests

The original 13 requests remain the primary comparison and the default review view. Compare the original corrected D4+ and English phrase controls against new variants on those same requests. [Matched comparison metrics](matched-comparison-metrics.json) reports those costs and timings; do not substitute averages from a different request set.

On those same 13 requests, the baseline mean model cost was **$0.000341 per search** and the Flash experiment mean was **$0.005594**: **16.39× higher**, or roughly **$0.34 versus $5.59 per 1,000 searches**. Median reconstructed pipeline times were **1.11 seconds** for corrected D4+, **0.73 seconds** for English phrase, and **8.19 seconds** for the Flash experiment. The Flash figure reuses frozen upstream timings from before later optimizations; it is not a fresh live end-to-end benchmark. These are materially worse cost/latency results, not a cheap-and-fast win.

The assistant added **28 supplemental stress requests**: eight challenge requests, 12 confirmation requests, and eight further validation requests. They expose useful weaknesses, but they are assistant-curated rather than representative user traffic and do not replace the original 13. The first 33 requests had informed iteration before the last eight were evaluated. Assistant judgments are provisional evidence-based assessments, not user acceptance or statistical validation.

Independent review of the **original 13** found useful gains on wealthy dark comedy, indirect crime/narrator wording, and getaway-driver roles. Simple requests were often close to the baseline. Mood results remain uncertain: the expensive variant’s top five for “tense but not bleak” were *Who Wants to Be a Millionaire?*, *Chopped*, *Jake Paul vs. Mike Tyson*, *89*, and *Raiders*. That is not evidence of an across-the-board quality gain that justifies the cost premium. The baseline text branch is gated for mood-only requests, so its empty panel also makes coverage unequal; it is not a complete production-search comparison.

Every variant uses the frozen 50,000-title snapshot. Historical retrieval, model outputs, failures, and assistant assessments are retained. None of the later ranking experiments changes production search.

## What was measured

The most developed expensive variant combines unchanged D4+ interpretation with a Gemini 3.1 Flash Lite planner, semantic and existing retrieval sources, and up to 24 candidates reranked by Gemini 3 Flash Preview. Packing v3 deduplicates evidence; IDs-v3 uses explicit minimal reasoning with a 4096-token shared allowance and validated output IDs. It produces no user-facing generated content assurances.

This configuration produced valid outputs on 41 distinct requests: 33 controlled replays and the final eight fresh requests. That establishes completion for these observations, not perfect relevance, future reliability, or an accepted winner. Prior variants' failed calls remain part of the record and total spend.

Some supplemental cases improved central subject or role matching, including doctors working together and reintegration after prison. Other cases still favored the cheaper alternative or showed weak lower-ranked matches. These observations motivated research, but do not justify declaring a practical winner despite the user's cost preference.

## Historical supplemental measurements: final eight only

These figures describe **the added final-eight set**, not the original 13 and not all 41:

- Flash IDs-v3: median projected pipeline time **5.24 seconds**, median reranker time **2.33 seconds**, and a **19.03-second** maximum projected pipeline time.
- Mean projected model cost **$0.00550 per search**; median **$0.00543**. This includes upstream model work and is not just the reranker bill.
- Same-pool Lite completed **seven of eight**; its successful-case median projection was **5.14 seconds**, with a different denominator. The failed provider call is retained.
- The legacy eligibility/retrieval branch determined the reconstructed upstream critical path in six of those eight cases.

The complete recorded experiment spent **$1.245328**, including failures, superseded variants, and diagnostic calls: $1.231159 OpenRouter plus $0.014169 Jev. This small total experiment bill does **not** make the recurring per-search premium small. Use the matched original-13 comparison to assess that premium against the baseline.

## Useful findings, without a winner claim

- Consolidated evidence indexing reduces underlying text-query work but does not by itself establish better whole-request relevance.
- Semantic planning helps indirect wording and conjunctions, but loose expansions can confuse related activities while overly literal required phrases eliminate good candidates.
- Central subject evidence matters more than incidental trope mentions. Popularity is not evidence that a title meets the request.
- Imported candidate sources need the same validated media/format and artifact checks as new retrieval.
- Deduplicated compact packing reduced two controlled model inputs by about 70%. This is an operational improvement inside the costly model experiment, not proof that reranking is necessary.
- Generated explanations often overstated content exclusions or endings. IDs-only output removes those model assurances from the product output; independent assessments still need to mark uncertainty.
- Tiny completion caps are unreliable with dynamic provider reasoning. Earlier 300- and 900-token configurations failed; explicit minimal effort and a larger allowance completed the observed later runs.

Earlier full-evidence reranking failed on eight of 13 development requests; compact Gemini 2.5 failed on five of 13. Those variants have demonstrated weaknesses. The existing cheap controls remain valid comparison options rather than being eliminated merely because a costly model sometimes ranks better.

## Measurement and relevance limits

Cold latency is a reconstructed critical path from captured model work and measured retrieval, not production end-to-end latency. Cache hits use original uncached inference metrics for comparison, while actual new spend is recorded separately. Startup, UI rendering, and full-product vector fill are excluded. Mood retrieval uses the local sample's fingerprints, not production Qdrant.

Catalog descriptions and tags are evidence, not independently verified ground truth. Unknown content absence or endings cannot be certified. Remaining errors include prehistoric material for ancient civilizations, memory access or erasure for false memories, generic heists without the requested failure, and overly harsh mood-query tails. Underspecified viewing companions do not establish taste or child-friendly requirements.

The approved scratch table was dropped and verified absent after preserving artifacts; see [cleanup verification](cleanup-result.json). The saved review requires no database access. Any future paid or database work is separate from this offline correction.

## Assets

- [Primary interactive comparison](loop-review.html)
- [Matched original-13 metrics](matched-comparison-metrics.json)
- [Historical experiment measurements](loop-metrics.json)
- [Spend ledger](spend-summary.json)
- [Reproduction instructions](../../../goodwatch-webapp/scripts/prototype-crate-evidence/LOOP.md)
- [Frozen protocol](loop-protocol.md) and [sample checksum](loop-sample.json)
