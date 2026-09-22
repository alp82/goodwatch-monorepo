# Experiment loop: a clear proxy winner

**Winner: explicit request interpretation → semantic core support → mood/attribute strength.** Open [the tournament](../tournament.html) directly; it is a self-contained offline HTML file.

This wins the declared experiment, not production acceptance. The result includes an interpretation stage, independently inferred semantic support, and three external factual supplements where catalog descriptions were incomplete. It is not a scoring-only ablation on identical text inputs.

## Outcome

The final candidate beats every one of 21 preserved comparators under the fixed margins and per-query guardrails, including independent audit and uncertainty sensitivity.

| Candidate | Macro NDCG@10 range | Acceptable results per top ten | Off-target results across all top fives |
| --- | ---: | ---: | ---: |
| Legacy main approximation | 0.655–0.658 | 6.6 | 10 |
| Previous concrete phrase leads | 0.608–0.611 | 6.6 | 13 |
| Strongest lexical-core comparator | 0.820–0.824 | 8.2 | 3 |
| **Semantic core, then mood** | **0.928–0.933** | **8.8** | **0** |

The range assigns the one unresolved pooled title, Free Guy, each possible grade 0–3 consistently for every algorithm and its ideal ranking. It is an uncertainty range, not a statistical confidence interval. The candidate's own decisive top tens are fully judged. Do not quote 0.933 as an exact fully judged result.

Across all assignments, the minimum NDCG advantage over any comparator is 0.107, above the predeclared 0.05 threshold; the minimum acceptable-result advantage is 0.5/query. No per-query guardrail fails. Using the independent audit labels instead gives winner NDCG 0.921–0.926, minimum margin 0.104, the same 8.8 acceptable results and no guardrail failure.

The selected configuration was frozen on six development queries. It then passed the four held-back **reused-case confirmation** queries: NDCG 0.955, versus 0.841 for the legacy main approximation, with no guardrail failures. These queries appeared in earlier prototype work; this is not an unseen-query generalization test. Four ambiguous queries are excluded from the decisive aggregate and remain available in the demo.

See [machine-readable verification](winner-verification.json), [complete results and sensitivity](semantic-evaluation-all.json), and [selection freeze](selection-freeze.json).

## What the winner does

An independent interpreter reads the original request and states its core subject or premise, modifiers, exclusions and ambiguity. A separate ranker reads that interpretation and the description packet. It produces:

- Core support: 0 = clearly different subject; 1 = partial/unknown essential support; 2 = all essential requirements supported.
- Modifier fit: 0 = mismatch; 1 = mixed/unknown; 2 = strong support.
- Explicit-exclusion contradiction and original-reference identity.
- A short source-grounded explanation.

The fixed formula is `4 × core + fit + 0.25 × normalized attribute strength`, subtracting 8 for a supported explicit exclusion and 4 for the original reference when asking for similar suggestions. The core tier cannot be overcome by mood strength. Mood-only and ambiguous cases retain the generic core-strength base; there are no title-specific score bonuses.

The inference output is captured, not a live endpoint. [semantic-rank.cjs](semantic-rank.cjs) orders the captured labels; [semantic-support-v2.json](semantic-support-v2.json) preserves them; [parsed-intents.json](parsed-intents.json) preserves the independently inferred request meanings.

## Iterations

| Round | Hypothesis | Result |
| --- | --- | --- |
| 1 | Repair ranking with score scales, weighted coverage, soft penalties, selected dimensions and evidence transforms | 240 generic scoring configurations plus 48 source/weight variants. Familiar-title proxy gains concealed major subject failures. No winner. |
| 2 | Add explicit lexical support for the first phrase's subject | Large improvement, but word matches still confuse semantic relationships and analogies. Four variants judged alongside eight scalar finalists. |
| 3 | Infer semantic support independently from descriptions | Substantial improvement, but broad romantic-repetition analogies introduced an off-target Groundhog Day top-five result. Failed the guardrail. |
| 4 | Interpret the required premise before assessing support; supplement missing source facts | Passed development, frozen reused-case confirmation, all comparator guardrails, independent audit and unknown-label sensitivity. |

The final comparison additionally includes all seven remaining original-lab presets, beyond the two preserved references. Adding these comparators did not change the winner or coefficients. All their top tens were already present in the blinded judgment pool.

The 288 initial scoring/source trials used a clearly marked **development watch-title proxy**, not relevance ground truth. Final selection used separate rank-blinded relevance judgments. Trial counts must not be misrepresented as 288 independently judged experiments.

## Evaluation independence and limits

[The fixed contract](evaluation-contract.md) and [query rubric](query-intents.json) precede new relevance scores. Three assessors judged 334 query/title pairs without algorithm names, ranks, weights or watch-title flags. The packets were ordered by stable media identity, not randomly shuffled; this is a recorded deviation from the proposed shuffle. A separate assessor rechecked 56 pairs in reversed identity order, including all final top-three results. The raw audit and original labels are preserved separately; the final report also uses the audit labels as a sensitivity check.

The semantic ranker never saw evaluator labels or rubric. The fresh interpretation agent read query strings only. They share a model family with evaluators, and the catalog essence is generated, so correlated model bias remains possible. These are **agent proxy judgments**, never supplied human judgments. The demo keeps the user's own review separate and in memory until explicitly downloaded.

The corpus is a live read-only catalog snapshot of all 22,089 identities in the existing candidate capture, with creator credits where available. The semantic reranker uses the predeclared pooled slate of earlier top tens: 227 subject/analogy pairs across nine queries. Every compared algorithm's top ten is admitted. This demonstrates reranking feasibility on a rich offline slate; it does not establish an efficient online shortlist or recall beyond the original capture.

Three uncertain analogy packets received independently researched facts from official distributor pages and filmmaker testimony. The ranker received facts, not proposed evaluator grades. [The audit](uncertain-evidence-audit.json) establishes time loops for The Fare and The Final Girls; Free Guy remains unresolved. This extra information is part of the winning pipeline and prevents a pure identical-input scoring attribution.

Early saved diagnostic reports calculated a conditional NDCG ideal with unresolved pooled grades set to zero. Method review identified that ordinary NDCG should remain unresolved even if the candidate's own top ten is graded. The final metric implementation records that conditional value separately and the verdict uses exact shared-label sensitivity. The winner survives every assignment; no grade or threshold was changed to force the outcome.

No production ranking, paid search-provider call, live semantic-model endpoint or database write was introduced. The accepted 30-query human baseline remains separate and was not rerun. Exact current durable-cache probes found no ready interpretations for those fixtures, so a new capture cannot be assumed free. Live inference cost/latency, additional-fact acquisition, fresh-query generalization and human preference are unmeasured.

## Run it

Opening [tournament.html](../tournament.html) requires nothing else. It provides saved-configuration comparison, guided walkthroughs, source inspection, hidden/revealed agent assessments and independent user-review export. The earlier [index.html](../index.html) retains its adjustable scoring controls.

Reproduce the final metrics and rebuild from the repository root, using Node and the committed compressed catalog snapshot:

```sh
node docs/prototypes/ranking-lab/experiments/evaluate-semantic.cjs all semantic-support-v2.json
node docs/prototypes/ranking-lab/experiments/verify-winner.cjs
node docs/prototypes/ranking-lab/experiments/build-tournament.cjs semantic-support-v2.json
```

These commands make no network or model calls. They replay preserved inference output; they do not reproduce the inference process itself. `catalog.json.gz` is the primary-source snapshot; the optional readable `catalog.json` is ignored. The catalog capture script is a separate read-only service operation and is not required for replay.

Desktop and 390px mobile smoke checks covered direct-file loading, both result columns, query/preset changes, guided steps, source inspection, grade visibility, independent review export and invalid URL fallback. No browser exceptions or mobile horizontal overflow were observed. Temporary browser judgments are not part of the artifact. No prototype test suite was added.

## Implementation implication

The direction worth implementing and validating next is semantic subject/premise verification before mood scoring, with an inspectable request interpretation. A production design still needs a cheap bounded shortlist, a measured inference endpoint and cache policy, handling for uncertain descriptions, and the accepted baseline/new-query human review. Keep the preserved experimental branch as evidence; do not merge these captured labels or the HTML shell into production.
