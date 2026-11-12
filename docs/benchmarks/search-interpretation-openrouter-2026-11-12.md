# OpenRouter native decisions as paid overflow

Measured November 12, 2026. **Ten hosted native decision challengers completed all 42 development queries.** Production JEV 1.13.0 is the control. Five challengers and JEV received three repetitions at concurrency one and four; the remaining five completed the single-pass screen. All 148 fingerprint questions and the query-dependent attributes were retained. No production routing changed.

## Decision

**Liquid d1.1 is the best low-cost candidate to investigate, rather than an established quality-equivalent substitute.** It meets the proposed deterministic check, deadline, exclusion and half-price gates. Its paid cost is about $0.163 per 1,000 readings, about 51% below JEV's list-price allowance consumption. Its repeated check score is lower, and the identity-blinded AI-assisted review preferred JEV 17 times versus d1.1 four times, with 20 ties and one uncertain pair. Extra audience/genre/occasion steering remains a real acceptance concern.

Decider Flash is cheaper at about $0.093 per 1,000, but repeated p95 latency rose above the 1.5-second target. Its blinded review also preferred JEV 24 times versus Flash once, with 13 ties and four uncertain pairs. Decider V1.2 meets the speed/check gates and saves about 44%, but its blinded review preferred JEV 35 times versus Decider once, with five ties and one uncertain pair. These are qualitative AI judgements, not a measured accuracy percentage or human relevance verdict.

Span-02 is a plausible modest-saving alternative on the deterministic screen, but its actual cost reduction is only about 10%, and no blinded semantic or repeated-load acceptance was performed for it. The other candidates fail a quality/exclusion/speed gate or cost more than JEV at the measured workload. No automatic fallback switch is justified by this development benchmark alone.

## Measured comparison

The scores below are partial author-written assertions decoded through production's JEV thresholds, not full classifier accuracy or user-rated search relevance. The cost uses the first complete 42-query cohort. C1 p95 uses repeated samples where available. The JEV row measures consumption of the owner's **free allowance**, with $0 additional cash while covered; other rows consume paid OpenRouter credit.

| Model | Check score | C1 p95 | C4 p95 | Unit cost /1,000 | Complete C1/C4 readings |
| --- | ---: | ---: | ---: | ---: | ---: |
| jev | 92.4% | 0.28s | 0.29s | $0.333 | 126/126 |
| perplexity-pplx-decider-v1.2 | 90.2% | 1.00s | 1.05s | $0.186 | 126/126 |
| perplexity-pplx-decider-flash-v1.2 | 93.3% | 2.02s | 1.81s | $0.093 | 126/126 |
| liquid-d1.1 | 90.3% | 1.01s | 0.91s | $0.163 | 126/126 |
| respan-span-02 | 92.7% | 1.08s | — | $0.298 | 42/0 |
| baseten-joey-1 | 82.7% | 0.49s | 0.51s | $0.138 | 126/126 |
| baseten-elephant-1 | 87.9% | 0.57s | 0.60s | $0.483 | 126/126 |
| scaledown-classify-1 | 94.8% | 10.86s | — | $1.902 | 42/0 |
| nace-ai-drex-max | 92.8% | 9.92s | — | $1.158 | 42/0 |
| morph-reflex | 89.7% | 2.47s | — | $0.422 | 42/0 |
| liquid-d1-ultra | 92.7% | 1.49s | — | $0.342 | 42/0 |

Joey missed six distinct explicit exclusion cases in the 42-query screen (18 misses across its three C1 repetitions), despite its attractive speed and price. Classify-1 also missed one explicit exclusion. The leading three reviewed candidates and the JEV control had zero tested exclusion misses, including the repeated C4 trials where performed.

## Cost and scope

The run retained **2,047 interpretation attempts and 4,921 HTTP calls**. Provider-reported paid OpenRouter credit consumption totals **$0.453595**, exactly matching the shared-key daily counter increase to floating-point precision. Direct JEV controls consumed **$0.183323 of existing free credit**. Seven early compatibility attempts retained partial/unreported per-request accounting; their conservative local reservations remain in the audit trail. There were no credit purchases or key-limit changes.

The owner receives $5 TypeSafe usage per billing cycle, renewing on the 17th. Covered JEV requests remain the first choice at $0 cash. These hosted models are additional paid overflow options after that allowance, not savings on covered requests. Gross prices do not include any fee previously paid when buying OpenRouter credit. The fixed suite is not a traffic-volume or query-mix forecast.

## Limits and reproducibility

- Questions, option identities, rubric text and decoder were fixed. State encoding and explicit chunk limits were adapted where provider contracts required them. Original failures are retained; no questions were silently removed, and no native probabilities were replaced with one-hot choices.
- Liquid used 128-question batches, Morph 64 and Drex 16 with serial HTTP dispatch. Classify-1 needed JSON text for state and existing option labels in place of null criterion explanations. Added HTTP calls count toward cost and latency.
- Actual token counts differ between providers. Span-02, Classify-1 and Drex illustrate why a cheaper or similar advertised rate does not imply proportionally lower full-reading cost.
- Latencies include workstation-to-provider networking and all question batches; they are not full production search latencies. Models ran serially between cohorts, with four complete readings concurrently only in declared C4 phases. Native caches may warm, but no application interpretation cache was used.
- The assertion suite has 42 public author-written cases in English, German, Spanish, French and Turkish. It is not a private holdout, and its partial labels miss unsupported extra predictions. The supplementary reviews are identity-blinded AI assistance, not human acceptance. No frozen-catalog ranked-title comparison or production canary was run.
- All inputs were public authored cases. The benchmark did not start a webapp or access production databases. JEV control usage was separately accounted outside application traffic.

The original local/chat benchmark support code was reused only for production-contract loading, the unchanged decoder and regression fixtures. Actual paid challengers used native Decisions API routes throughout; no chat model was benchmarked here.

[Full protocol, raw evidence and per-language metrics](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/README.md). [Machine-readable comparison](../../goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/comparison.json). [Admission research](../research/openrouter-overflow-admission-2026-11-12.md). The evidence directory retains source snapshots, manifests, original/adapted profiles, compressed raw trials and ledgers, and all three blinded review inputs, mappings and judgements.
