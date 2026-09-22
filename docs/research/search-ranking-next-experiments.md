# Search ranking: next offline experiments

Research date: 2026-09-23. Scope: the captured D4 fingerprint/text ranking lab; recommendations below are hypotheses for a throwaway prototype, not accepted production decisions. No services or model calls were used. External documentation was read on this date; deployed versions were not rechecked.

## Recommendation

Make the next lab answer **why a promising configuration improves one request while damaging another**, before selecting a replacement ranker. Keep concrete phrase leads as the comparison point, add a continuous satisfaction experiment, and expose candidate admission separately from scoring. Capture real human judgments without treating the existing watch-title list as relevance ground truth.

## What the repository establishes

- [The ranking lab README](../prototypes/ranking-lab/README.md) records useful fixes for `complete nonsense` and concrete queries, but remaining losses for `tarkovsky` and `fantasy with dragons`. These are exploratory observations, not a measured acceptance verdict.
- [The current lab implementation](../prototypes/ranking-lab/index.html), functions `fingerprint`, `rankRows`, and `compute`, shows three separate effects: binary attribute thresholds, additive text evidence, and candidate-pool routing. The count ignores weight magnitude while the weighted sum retains it. Candidate-dependent normalization also changes when the pool changes.
- `textfirst` concatenates text candidates before vector-only candidates and excludes the latter entirely once the text pool contains at least 100 rows. That is an admission policy; changing score weights cannot recover those excluded rows. `auto` uses only the first phrase's concrete flag to choose that policy. Source: the same `compute` function.
- [The accepted search baseline](../prototypes/search-evaluation/README.md) covers 30 requests and requires no per-request relevance regression, with new results reviewed separately. Overall user acceptance is recorded; individual strong/acceptable/wrong grades are absent. Ranking-lab queries are not a substitute for that baseline.
- [CONTEXT.md](../../CONTEXT.md) defines attribute scores as title characteristics, not quality ratings. [ADR 0001](../adr/0001-no-jev-for-fingerprint-scoring.md) rejects Jev as the fingerprint scorer. Nothing proposed here changes the scoring model or that decision. Query interpretation and fingerprint generation remain different tasks.

## Primary-source findings

**Candidate recall limits reranking.** Qdrant applies the main query to its prefetch results; formula scoring is a rescoring stage. Therefore a perfect formula cannot recover a title absent from all supplied candidates. Sources: [Qdrant hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/#hybrid-and-multi-stage-queries), [formula scoring](https://qdrant.tech/documentation/search/search-relevance/#score-boosting).

**Fusion is a tunable comparison, not a universal cure.** RRF uses ranks rather than score gaps. Qdrant's DBSF uses statistics of each returned candidate list, so changing that list changes normalization. Its current documentation distinguishes configurable RRF `k` (1.16+) and weighted RRF (1.17+). Source: [Qdrant hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/). The earlier [local infrastructure note](qdrant-range-count-ranking.md) reported server 1.15.4; browser experiments need no upgrade, but later implementation must check capabilities again.

**One poor RRF run does not eliminate the family.** Bruch, Gai, and Ingber report that RRF is parameter-sensitive, and that a tuned convex combination of lexical and semantic scores outperformed RRF in their studied settings. Those text-retrieval results motivate a controlled comparison; they do not establish superiority for GoodWatch's 74 named attributes and custom text-hit counts. Source: [An Analysis of Fusion Functions for Hybrid Retrieval, v2](https://arxiv.org/abs/2210.11934v2).

**Evaluation needs judgments for each request.** Elastic's primary documentation defines precision@k as relevant fraction, reciprocal rank from the first relevant hit, and DCG as rank-discounted graded relevance. It exposes unrated documents separately and documents that ignoring versus treating them as irrelevant changes precision. Source: [Ranking evaluation](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-rank-eval). These are metric definitions, not a recommendation to adopt Elasticsearch.

## Experiments, in order

The proposals in this section are inferences from the local failure cases and source findings, not externally validated facts.

### 1. Separate admission failures from score failures

For every watched title, show `vector only`, `text only`, `both`, or `absent from capture`; then show `eligible`, `excluded by pool policy`, or its rank. Display vector/text pool sizes and their overlap. This makes `The Last Sharknado` on `complete nonsense` a candidate-policy walkthrough, instead of encouraging more evidence-weight tuning.

An offline depth control can truncate the recorded vector ordering to 100/500/1,000/2,000. Label this **captured-pool sensitivity**, not catalog recall or an exact rerun of HNSW at a new limit. The capture cannot answer whether a title below the recorded 2,000 would win. Later retrieval experiments require deeper fresh captures or an exact reference pool.

Once there are explicit relevant-title judgments, show the fraction of *known judged relevant titles* present in the selected pool. This is conditional coverage of the judgment set, not recall over every relevant title in the catalog.

### 2. Show the count cliff before replacing it

For two selected titles, show each requested attribute, signed query weight, actual score, range pass/fail, weighted contribution, text evidence, and final score. Include a temporary ±1 attribute edit and reset. Mark edited scores as synthetic and exclude the scenario from recorded-result claims.

Guided example: a positive attribute at 5 versus 6 flips a full count unit even if all other attributes are stronger. Also expose the inverse boundary for avoided attributes at 4 versus 5. This explains why changing strict bands can move several apparently unrelated queries.

Compare three fixed alternatives on the same pool:

1. Existing concrete phrase leads, unchanged.
2. Weighted threshold coverage: `sum(abs(weight) * pass) / sum(abs(weight))`. This isolates whether equal counting of minor and major preferences is the issue; it still has cliffs.
3. Continuous satisfaction: orient each attribute so higher is better (`score` for wanted, `10-score` for avoided), then use `sum(abs(weight) * orientedScore/10) / sum(abs(weight))`. This has theoretical bounds independent of the candidate pool.

Continuous satisfaction is algebraically the existing weighted sum normalized to its theoretical range. It is not a novel ranker. Its value as an experiment is a stable, explicit scale and a controlled evidence comparison. A later optional ramp or saturation curve would test whether very strong scores should compensate for weak dimensions. The README already says one-point near-miss credit was neutral to negative; do not reintroduce it as a discovered improvement.

Evidence must be rescaled explicitly when comparing 0..1 satisfaction to counts. Keep candidate routing fixed first; otherwise pool admission and scoring change together. Show the evidence budget as a fraction of the fingerprint score range, and keep the count baseline available without silently changing its original coefficients.

### 3. Treat concrete/mood as an inspectable hypothesis

Add an override for `captured interpretation`, `concrete`, and `mood`; show all captured phrases, not just the chosen first one. This diagnoses sensitivity to the current classifier without asserting the alternative label is correct.

Keep separate walkthroughs for mood (`complete nonsense`), concrete topic (`feel good cooking show`, `fantasy with dragons`), title analogy (`like groundhog day`), and ambiguous person/style (`tarkovsky`). A one-word person query can plausibly mean a creator lookup or stylistic similarity; the offline interpretation cannot resolve that intention on its own. A mixed request can include both concrete subject matter and mood. The current binary route is a useful experiment, not a complete intent model.

### 4. Make the next decision reviewable

Show baseline and candidate top ten side by side, stable title identities, rank deltas, and candidates newly entering/leaving the top ten. A rank improvement for a familiar watched title is a diagnostic, not automatic evidence of better overall relevance.

Offer per-query/title `strong`, `acceptable`, `wrong`, and default `unjudged`, plus per-query notes. Export/import the configuration, capture identity, actual judgments, and comparison state; keep memory-only operation by default. Never prefill grades from current rank, watch-title presence, or an agent's preference.

For a completely judged displayed top ten, strong-or-acceptable count is the clearest first report. If graded metrics are added, state the gain mapping and judge the pooled candidate results before using NDCG; show judgment coverage alongside every metric. Don't calculate a convincing-looking winner from blanks. Keep constraint violations (adult classification, vote floor, duplicates) separate from relevance gains.

Reserve unseen queries from each intent group for confirmation before production selection. The present hand-picked captures are development cases. The original 30-request acceptance set remains a separate required comparison; its missing individual labels and uncaptured candidate pools prevent claiming it passed merely because the new lab looks better.

## Decision boundary

The next artifact can settle whether these explanations and controls expose the trade-off well enough to review, and identify candidate configurations worth judging. It cannot establish a production winner, global candidate recall, availability suitability, or human acceptance without additional evidence. Any ranking preset should remain explicitly experimental until the accepted baseline and new cases have been reviewed.
