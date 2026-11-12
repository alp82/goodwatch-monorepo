# OpenRouter decision-model overflow benchmark

Measured November 12, 2026. Ten native hosted challengers plus direct production JEV 1.13.0. No production routing or provider key limits changed.

## Measured results

Quality is the provisional production-decoder assertion score; explicit exclusion checks remain separate gates. All complete cohorts contain the same 42 author-written development queries in five languages, using every production question. A high score does not measure all extra predictions or ranked-result relevance. **The JEV cost row is free-allowance consumption, with $0 cash while covered; other model rows are paid overflow costs.**

| Model | Check score | C1 p95 ms | C4 p95 ms | Explicit exclusion misses C1 | $/1k unique readings | Readings C1/C4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| jev | 92.4% | 275 | 294 | 0 | $0.333 | 126/126 |
| perplexity-pplx-decider-v1.2 | 90.2% | 1,001 | 1,051 | 0 | $0.186 | 126/126 |
| perplexity-pplx-decider-flash-v1.2 | 93.3% | 2,020 | 1,808 | 0 | $0.093 | 126/126 |
| liquid-d1.1 | 90.3% | 1,005 | 906 | 0 | $0.163 | 126/126 |
| respan-span-02 | 92.7% | 1,077 | — | 0 | $0.298 | 42/0 |
| baseten-joey-1 | 82.7% | 487 | 506 | 18 | $0.138 | 126/126 |
| baseten-elephant-1 | 87.9% | 575 | 597 | 0 | $0.483 | 126/126 |
| scaledown-classify-1 | 94.8% | 10,859 | — | 1 | $1.902 | 42/0 |
| nace-ai-drex-max | 92.8% | 9,918 | — | 0 | $1.158 | 42/0 |
| morph-reflex | 89.7% | 2,468 | — | 0 | $0.422 | 42/0 |
| liquid-d1-ultra | 92.7% | 1,491 | — | 0 | $0.342 | 42/0 |

The cost column uses the first complete 42-query cohort for that serving profile, not the cheaper of repeated/cached trials. C1 percentiles use repeated readings where available; C4 is a separate closed-loop load test with four simultaneous complete readings. Timing includes every required HTTP chunk and workstation-to-provider network time, rather than production end-to-end search latency.

## Actual budget

Provider-reported known OpenRouter charges, including failed attempts with a known billed half: **$0.453595**. Direct JEV control consumed **$0.183323 of the existing free TypeSafe allowance**; it is not additional cash cost. 7 failed/partial readings have an unreported half; their conservative reservations remain recorded rather than pretending they cost zero. The combined local cash guard was $1, with no change to the shared provider key limit.

The owner has $5 free TypeSafe usage per cycle renewing on the 17th. Covered JEV requests remain $0 out of pocket. OpenRouter costs apply only to additional paid overflow; a smaller list-price ratio does not beat free covered requests.

The aggregate OpenRouter key usage increase matched the sum of reported charges at the end of the run; see `billing-cross-check.json`. This is an aggregate cross-check, not an independent invoice.

## Protocol and limitations

- Production questionnaires, option identities, rubric text and decoder stayed fixed. Generic chat generation, one-hot projections, question dropping, silent truncation, automatic retries and provider fallback were excluded. Model IDs, canonical response versions, one provider per model, and rate ceilings were checked or pinned.
- Liquid required 128-question batches; Morph used 64; Drex Max needed 16 and serialized HTTP calls. Classify-1 received the same object state encoded as JSON text and null phrase-criterion explanations represented by their existing option label. These are explicitly identified serving profiles, with original compatibility failures retained. Chunked requests used at most two HTTP calls at a time per interpretation, except Drex's serial profile.
- Native SDK/model caches can warm; no application reading cache was used. Repeated-state cost is stored separately. No private production search queries or database access were used. The public author suite includes named-title cases that current production may resolve deterministically before inference; its cost average is a fixed test mix, not a forecast of actual overflow traffic. Provider output tokens were free on the admitted routes.
- The initial diagnostic repeat selection ranked the weighted score before applying all quality gates, adding repeats for Joey and Elephant. Their failing quality/exclusion results remain visible. Subsequent selection applies gates first; additional dedicated repeats cover Flash and d1.1. More repeats never qualify an otherwise inaccurate model.
- Proposed screening gates: >=90% provisional check score, p95 <=1,500 ms, <=1% errors and zero explicit exclusion misses. The quality/speed score is equally weighted: `0.5*quality + 0.5*1500/(1500+p95Ms)`. A >=50% observed unit-cost reduction is a separate economic gate. These are development gates, not a user-approved quality regression margin.
- Case assertions are partial and public, and the cohort is small. There is no sealed private holdout, model-specific calibration acceptance, blind human review, matched ranked-title evaluation or production canary. The supplementary blinded review is AI-assisted and inspects interpretations, not actual search results.
- Original/adapted/serial configurations, source snapshots, manifests, cost ledgers and raw native distributions are retained. New adapter cohorts have their own identities. Partial cohorts are never promoted to 42-case quality measurements.

## Blinded semantic checks

For blind-review-unblinded.json, the independent AI-assisted reviewer preferred {"jev":24,"tie":13,"uncertain":4,"perplexity-pplx-decider-flash-v1.2":1} across 42 paired queries. These preferences are qualitative intent judgements, not an accuracy percentage. See the unblinded details for omissions and extra steering; do not infer quality parity from the partial assertions alone.

For blind-review-second-unblinded.json, the independent AI-assisted reviewer preferred {"tie":20,"jev":17,"uncertain":1,"liquid-d1.1":4} across 42 paired queries. These preferences are qualitative intent judgements, not an accuracy percentage. See the unblinded details for omissions and extra steering; do not infer quality parity from the partial assertions alone.

For blind-review-third-unblinded.json, the independent AI-assisted reviewer preferred {"jev":35,"tie":5,"perplexity-pplx-decider-v1.2":1,"uncertain":1} across 42 paired queries. These preferences are qualitative intent judgements, not an accuracy percentage. See the unblinded details for omissions and extra steering; do not infer quality parity from the partial assertions alone.

## Follow-up decision

The measured cheap C1 candidates are: liquid-d1.1. C4 results and the blinded semantic reviews must be read alongside this gate. This report does not automatically enable overflow routing or claim JEV quality is preserved.
