# Search experiment iteration record

The user authorized independent assistant assessments to drive this loop. Assessments are not user ratings or statistical validation. The frozen sample contains 50,000 titles, ten times the original sample; all strategies use the same catalog snapshot. The first 13 requests were development cases, eight additional requests became challenge evidence, and 12 separately frozen requests supplied confirmation evidence. After an operational reasoning-budget fix, eight further untouched requests tested the final configuration: 41 distinct requests altogether.

## Selected winner

**Semantic candidate retrieval plus compact evidence reranking with Gemini 3 Flash Preview, returning IDs only with explicit minimal reasoning.** This is the practical quality winner for the experiment, not a claim that it dominates every request or every cost tradeoff.

The final pipeline runs unchanged D4+ interpretation alongside a Gemini 3.1 Flash Lite semantic planner. It combines precise and broad semantic retrieval with the existing evidence sources, applies validated media/format and artifact checks across the entire union, and reranks up to 24 candidates from compact catalog evidence. Packing v3 removes duplicated tags. IDs-v3 uses explicit minimal reasoning and a 4096-token shared allowance, with exact candidate-ID validation. It does not generate user-facing content assurances.

The decisive improvements are whole-request fit: older people committing a robbery rather than any heist, doctors at work rather than any dry comedy, a driver escaping pursuit rather than pursuing police, reintegration after prison rather than a prison story, and documentaries about making music rather than any musician title. The final eight requests made these distinctions concrete. The train request also removed the old control’s zombie-film leader.

The cheaper Lite reranker remains a credible runner-up, and sometimes wins individual requests. In particular, its political-comedy list is more directly governmental than Flash’s corporate-dynasty leader. Flash earns selection through the accumulated role, setting and conjunction advantages; its price premium is a judgment call, not statistical dominance. See the per-request independent assessments, including the losses.

## Final measurements

- The final configuration returned valid outputs for all **41 distinct requests**: 33 controlled replays and eight fresh final requests. This counts successful responses, not perfect relevance. Earlier versions’ failures remain recorded.
- On the final eight: **5.24 seconds median projected pipeline time**, including captured Jev timing, and **2.33 seconds median reranker time**. One request took **19.03 seconds** in the projection, mainly waiting for the reranker. Startup and UI rendering are excluded.
- The winner’s mean projected model cost on the final eight was **$0.00550 per search** (about $5.50 per 1,000); the median was $0.00543.
- Same-pool Lite completed seven of eight; its provider error is separate from relevance judgment. Its successful-case median projection was 5.14 seconds, with a different denominator.
- Most remaining latency came from the legacy eligibility/retrieval branch, which determined the upstream critical path in six of eight cases. The newer semantic retrieval stage was substantially shorter.
- The complete recorded experiment cost **$1.245328**, including failed, superseded and diagnostic calls: $1.231159 OpenRouter and $0.014169 Jev. This is experiment spend, not per-search pricing.

These figures support a quality selection. They do not settle production timeout, fallback, caching or cost budgets; the observed 19-second tail makes those concrete follow-up decisions.

## What the loop established

- Combining evidence fields makes the underlying text retrieval substantially faster, but does not by itself improve whole-request relevance.
- A semantic planner helps with indirect wording, multilingual requests and conjunctions. Loose expansions confuse related activities; literal required phrases can also eliminate good candidates. Broader candidate recall and precise evidence ranking complement each other.
- Evidence centrality matters. An incidental trope is not equivalent to a story being about that subject. Popularity and familiarity are not independent evidence of relevance.
- Candidate sources must share validated media, format and artifact filters. Otherwise a correct filter in one retriever is bypassed when another source is merged.
- Model input duplication was costly and distracting. Deduplicating tags and retaining compact evidence reduced two controlled inputs by about 70%, while also improving some rankings.
- Model explanations frequently overstate exclusions or endings. The ranking-only finalist requests IDs, while the review presents catalog evidence and separate independent assistant assessments.

## Eliminations

| Approach | Reason |
| --- | --- |
| Full evidence reranker | Eight of 13 failures; excessive latency and payload/output complexity. |
| Compact Gemini 2.5 reranker | Five of 13 failures and weaker whole-request judgments. |
| Loose planner/facet ranking alone | Car combat substituted for chases; incidental trope matches displaced central subjects. |
| Strict canonical phrases alone | Good precision on simple phrases, but natural-language conjunctions could return no candidates. |
| Existing search pool alone | Fast useful control, but insufficient recall for several indirect, multilingual and contextual requests. |
| Verbose model reasons | Added latency and unsupported categorical assurances; independent assessments remain separate. |
| IDs-only, 300-token cap | One of 21 requests exhausted the budget because provider reasoning consumed most tokens. Preserved as a failed variant. |

## Measurement boundaries

Development and replay latency includes explicitly reconstructed upstream work from frozen calls. Cache hits retain original cold model latency and cost for comparisons; actual new spend is separate. Final confirmation uses fresh planning and retrieval, plus previously captured unchanged D4+ Jev stage timing. It is not a production end-to-end benchmark. Sample loading and indexing are recorded separately. Mood retrieval is an in-memory sample fingerprint path, not the production Qdrant fill.

The added requests are assistant-curated stress cases, not a representative sample of real search traffic. Catalog descriptions and tags are evidence, not independently verified ground truth.

The sample cannot establish content absence or a particular emotional ending where the catalog lacks evidence. Tail results can still weaken conjunctions. Exact-title routing, availability, full-catalog behavior and production failure recovery are outside this experiment.

## Assets

- [Interactive review](loop-review.html)
- [Frozen protocol](loop-protocol.md)
- [Reproduction instructions](../../../goodwatch-webapp/scripts/prototype-crate-evidence/LOOP.md)
- [Measured results and component timings](loop-metrics.json)
- [Spend ledger](spend-summary.json)
- [Frozen sample checksum](loop-sample.json)

## Remaining relevance limits

- Ancient-civilization results still admit prehistoric/hominid material, which is adjacent rather than a direct match.
- False memories can still become memory recording, access or erasure; these are not interchangeable.
- Generic heist evidence does not establish that the plan goes wrong; lower ranks remain weaker.
- The final robbery lists include a story about older women covering up an accidental killing rather than committing a robbery.
- Some mood-query tails remain too harsh. Catalog tone scores do not prove an ending will feel hopeful.
- A completely underspecified companion request cannot establish taste. The planner now preserves that ambiguity rather than inventing a child-friendly constraint.

The selected pipeline is a throwaway prototype. Its raw frozen snapshot and cache remain local, while compact results, independent assessments, measurements and the interactive review are preserved on the prototype branch. No production search route was changed.

The approved scratch table was dropped and verified absent on closure; see [cleanup verification](cleanup-result.json). Opening the review and reading the saved results require no database connection.
