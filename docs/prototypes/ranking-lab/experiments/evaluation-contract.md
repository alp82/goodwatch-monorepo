# Ranking experiment evaluation contract

Version 1, 2026-09-23. Written before inspecting new experiment scores. The author has read the old lab's failure descriptions, so this is a prospective protocol on previously seen cases, not a claim of complete historical blinding.

The objective is a **reproducible proxy experiment winner**: the best candidate under an explicit, independently applied relevance rubric. Agent judgments are not human judgments. Winning this experiment does not establish user acceptance, production readiness or no regression on the accepted 30-request baseline.

## Freeze the question before running candidates

[query-intents.json](query-intents.json) defines all 14 requests from their wording. It records concrete subjects, modifiers, exclusions and ambiguity. No desired title list or previous result order defines correctness. Commit or hash this rubric before generating new comparison results; record every later change as a new version and re-evaluate every candidate consistently.

Ten requests have a declared working interpretation. Four are ambiguity audits (`tarkovsky`, `furious`, `craty`, `sunglasses at night`), which must be reported separately and cannot decide the winner. `tarkovsky` supports separate creator and style evaluations. `craty` has no unconditional relevance score. No classifier output establishes the user's intent.

All 14 requests have already influenced prototype development. Use six for new tuning and four as a **reused-case confirmation** set:

| Partition | Query indices | Purpose |
| --- | --- | --- |
| Development | 0, 2, 3, 5, 11, 12 | Diagnose, tune, and select a candidate configuration |
| Reused-case confirmation | 4, 8, 9, 13 | One locked check after configuration selection |
| Ambiguity audit | 1, 6, 7, 10 | Conditional intent sensitivity; no decisive aggregate |

The confirmation cases cover exclusion, specific setting, combined topics and temporal complexity. They are not unseen queries and cannot support a generalization claim. Once their scores guide a change, mark them consumed: further rounds are development on all ten. Do not repeatedly tune against them and keep calling the result confirmation. A fresh confirmation requires new requests and judgments; absent that, report an in-sample proxy winner.

## Judge evidence, independently of rank

Form the union of at least the top ten of every compared candidate for each request. Deduplicate by stable media type and catalog ID. Use the same frozen catalog description packet for each identity: title/year/type, synopsis, essence, relevant tags, and source fields. Preserve missing fields explicitly and record packet hashes. If a new candidate adds a title, judge it before scoring; do not mark an unjudged result irrelevant.

Shuffle each query's pooled title packets using a recorded deterministic seed. Hide candidate names, rank, numeric scores, fingerprint contributions, old watch-title flags and producing algorithm. The judge sees the original request, its frozen rubric and the title evidence only. Title identity can remain visible because the task concerns titles, but recognized facts not supported in the packet must be marked external knowledge and cannot silently override supplied evidence.

For each result, store:

- Query index and title identity.
- Grade 0/1/2/3 or null, confidence high/medium/low, and a short rationale.
- Per core requirement and modifier: supported / contradicted / unknown, citing the exact packet field or short supporting excerpt.
- Explicit-exclusion status supported / violated / unknown.
- Judge provenance, rubric version and packet hash.

The grading scale is 3 = core and modifiers strongly supported; 2 = core supported and modifiers plausible or incompletely described; 1 = partial relevance; 0 = explicit conflict or clearly incidental relevance; null = inadequate evidence to choose. A documented contradiction of a requested modifier can lower a result to 1 even when its core is supported. A verified explicit exclusion violation makes the result 0. Absence of a detail in a short synopsis is unknown, not proof the detail is absent. If the synopsis is too sparse to establish the core, use null rather than manufacturing a judgment.

Do not use raw fingerprint thresholds as the judge: that would reward the scoring function for agreeing with itself. Essence is model-generated evidence, not a human reference; record this limitation. Keep the ranker and evaluator separate. An evidence classifier used by a ranking candidate cannot also supply its evaluation labels. When resource limits require the same model family, use an independent judging pass with hidden rankings and disclose shared-model bias.

Audit every newly top-three result, explicit exclusion violation and major per-query regression. Repeat a small recorded sample with reversed presentation order or a second independent pass. Store disagreements; resolve from source evidence rather than choosing the judgment that improves the favored configuration.

## Metrics and a clear winner

Primary metric: macro average **NDCG@10** across the ten non-ambiguous requests, with gains `2^grade - 1` and rank discount `log2(rank + 1)`. The ideal ranking uses the same fully judged pooled candidates for every compared run. It is pool-relative, not a catalog-wide optimum. Grade 2 or 3 counts as acceptable for **acceptable@10**. Also report zero-grade results in the top five and supported explicit-exclusion violations.

Always display per-query scores and development/confirmation averages. Do not hide a broken intent behind the overall average. If a run has fewer than ten results, pad the missing slots with zero gain; empty-result behavior is part of quality.

For any unjudged/null result, show judgment coverage. Withhold the ordinary metric winner until compared top tens have grades. If evidence remains irreducibly unknown, calculate a low/high range with those grades set to 0/3 and label it an uncertainty range, not a confidence interval; a robust result must survive the unfavorable assignment for the proposed winner and favorable assignment for its comparator. This requirement prevents sparse descriptions from masquerading as a clean victory.

A **clear proxy winner** must satisfy all of these predeclared practical thresholds:

1. Exceed the strongest previously compared eligible candidate by at least **0.05 macro NDCG@10**, and improve acceptable@10 by at least **0.5 titles per query on average** across the ten non-ambiguous requests.
2. Lose no more than **0.10 NDCG@10** and no more than **one acceptable result in the top ten** on any single non-ambiguous request. Newly introduced supported exclusion violations in the top five disqualify it. Zero-grade top-five counts must not increase on any such request.
3. On the locked reused-case confirmation subset, achieve nonnegative mean NDCG change and no new per-query guardrail failure. If this subset has already guided tuning, state that this check is in-sample instead.
4. Be directionally consistent under the independent judgment audit. Disputed labels that reverse the decision mean no clear winner yet.
5. Beat or tie both preserved references on the guardrails: the old production-style preset and the previous concrete-phrase-leads preset. Do not remove a troublesome baseline after seeing its score.

These numeric thresholds are a pragmatic local decision rule chosen before results, not a significance claim or externally established optimum. Ten interpreted requests are too few to treat a small average movement as broad product proof. A statistically estimated interval, if added, must resample queries rather than individual result slots because slots within a query are dependent.

If candidates tie or trade wins under this contract, state the trade-off and continue with an explicitly different hypothesis. Never lower the thresholds after seeing results to force a winner. A clear winner can be scoped as "best on the ten interpreted captured requests under the frozen agent rubric"; it cannot be called "the user-preferred ranking".

## Three candidate evolutions worth trying

These are research-motivated hypotheses, not claims that the cited papers validate GoodWatch specifically.

1. **Decompose core evidence from preference strength.** Classify each required concept in the frozen description as supported/unknown/contradicted, then rank supported-core candidates ahead of partial ones and use fingerprint satisfaction for mood within those groups. Keep unknown candidates available as fallback. Cooking, dragons and child bereavement should require semantic support, not just a substring. Start with inspectable labels and a small reranking slate, not a new model-training project. Decomposed Prompting demonstrates modular task decomposition on reasoning tasks; applying it to film search is our extrapolation. [Khot et al., primary paper](https://arxiv.org/abs/2210.02406).
2. **Pairwise description reranking.** On the same candidate slate, ask an independent ranker which of two title descriptions better satisfies the decomposed request; allow ties and insufficient evidence. Run both presentation orders and preserve inconsistent comparisons. Use a deterministic aggregation and freeze its tie rule. Qin et al. study pairwise ranking prompts and report strong results on text-retrieval benchmarks, not movie discovery. The cost/latency and domain transfer must be measured here. [Qin et al., primary paper](https://arxiv.org/abs/2306.17563).
3. **Normalized continuous satisfaction plus evidence coverage.** Replace equal hard-threshold counts with theoretical-range normalized weighted satisfaction, combine it with supported-concept coverage on explicit scales, and tune only a small predeclared coefficient grid. This isolates cliffs and uncalibrated evidence without changing models. Bruch et al. find tuned convex score combination can outperform RRF in their lexical/semantic retrieval experiments; their findings justify testing a calibrated baseline, not assuming it will win. [Bruch et al., primary paper](https://arxiv.org/abs/2210.11934v2).

Changing the candidate pool is a separate axis. Record its policy and size for every run. A reranker can only order available candidates; Qdrant explicitly applies the main query over prefetch outputs. [Qdrant primary documentation](https://qdrant.tech/documentation/search/hybrid-queries/). Report improvements attributable to pool expansion separately from improvements on a fixed slate.

## Iteration record

For each round, save the hypothesis, exact configuration, query partitions, pool IDs, data/rubric hashes, judge record, metric implementation, per-query results, overall scores, guardrail failures, timings/calls and verdict. Preserve the complete previous run. Explain which diagnosed failure the next change addresses before viewing its score. A final browser demo should reproduce the selected ranking from captured scores/evidence without network calls and clearly identify the proxy winner's scope.

The accepted 30-query baseline and its known hygiene checks remain a separate human acceptance requirement. This experiment neither overwrites its review nor fabricates per-title human grades.
