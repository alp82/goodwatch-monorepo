# Scoring experiment rounds

Throwaway exploration, 2026-09-23. These experiments are developmental, and establish no clear relevance winner. The candidate inputs are the existing fourteen-query [capture](../capture.json). There were no service calls or model requests in these rounds.

## Portable interface

```js
const { rank, configs } = require('./rankers.cjs');
const rows = rank(capture, configs.find(c => c.id === 'log-evidence'));
```

`rank(cap,cfg)` has no DOM dependency and never branches on a query string, title, or media ID. The source is [rankers.cjs](rankers.cjs). All new families consistently use text fingerprints for overlapping candidates; original vector cosine remains available. Legacy main and concrete-leads modes deliberately retain their original source behavior, pool normalization, and ordering. An ad hoc parity check matched their entire result order to the original template on all fourteen queries. Every configuration produced unique candidate IDs and finite scores without modifying the capture. No test suite was added.

New result rows expose `score`, `primaryScore`, `ev`, `coreScore`, `features` (strength, coverage, soft, deficit), source membership, and fingerprint source. Optional `cfg.coreWeight` multiplies `cap.coreEvidence[key]`, clamped to 0..1. Missing core evidence adds zero and incurs no penalty. This extension is available for a separate evidence experiment; it was not used in these rounds.

## Features and generic choices

Wanted attribute value `v` aligns as `v`; avoided value aligns as `10-v`. Selected dimensions can be all dimensions or the highest-weight fraction. Absolute query weights normalize feature sums unless equal weighting is selected.

- Strength: mean of `(aligned/10)^power`.
- Coverage: mean of `aligned >= 6`.
- Soft coverage: mean of `clamp((aligned-4)/4,0,1)`.
- Deficit: mean of `max(0,6-aligned)^2 / 36`.
- Blend: convex combination of strength and coverage.
- Product: square root of strength times coverage.

Evidence is the captured accumulated scalar score, capped at three. Candidate transformations are linear, `log1p`, rounding, flooring, and presence-only. It is not treated as a literal count of matched phrases. Separate mood and concrete weights use the captured first phrase's concrete flag. Text-first, union, or mood-only union determine candidate eligibility. None of these changes adds recall beyond the capture or verifies the concrete relationship in a phrase.

## Development proxy

To detect obvious regressions while iterating, the script records familiar positive examples already discussed in the previous lab and two known nonsense counterexamples. The full frozen mapping is in `developmentAnchors` and [scoring-sweep.json](scoring-sweep.json). The proxy averages `1/log2(rank+1)` over positive anchors per query, then averages queries equally. The nonsense counterexamples' top-ten count is reported separately. These are not independent, graded relevance judgments; some anchors represent competing interpretations, and missing/unfamiliar good titles do not earn credit. Do not call this NDCG or use its numeric maximum as evidence of a clear winner.

## Round 1: 240 scoring combinations

Twelve shape variants crossed four mood evidence weights (0, .05, .1, .2) and five concrete weights (.15, .3, .55, .8, 1.2). Variants covered strength, coverage blends, soft coverage, deficit penalty, nonlinear strength, selected dimensions, product, and evidence transforms. Results: [scoring-sweep.json](scoring-sweep.json). Reproduce with `node rankers.cjs --sweep` from this directory.

| Development result | Mean anchor discount | Nonsense counterexamples in top 10 |
| --- | ---: | ---: |
| Legacy main approximation | .6080 | 2 |
| Legacy concrete leads | .5455 | 0 |
| Strength + log evidence, concrete weight .55 | .6113 | 0 |
| Strength + linear evidence, concrete weight .30 | .5953 | 0 |
| Strength − .30 deficit, concrete weight .30 | .5917 | 0 |
| 80% strength + 20% coverage, concrete weight .30 | .5901 | 0 |
| Product of strength/coverage, concrete weight .55 | .5868 | 0 |
| Nonlinear strength (power 1.5), concrete weight .55 | .5826 | 0 |
| Rounded evidence, concrete weight .30 | .5652 | 0 |
| Top-weight half of dimensions, concrete weight .55 | .5105 | 0 |

The highest proxy variant puts Tim and Eric at 3, Aqua Teen Hunger Force at 2, Kung Fu Panda at 143 (mood weight zero), Stalker at 9, Begotten at 1, Cooku with Comali at 1, They Live at 1, and How to Train Your Dragon (2010) at 3. But it puts High Life at 129, Sputnik at 371, and Event Horizon at 250, against concrete-leads positions 1/6/51. That loss rules out treating the aggregate proxy maximum as a generally improved ranking.

Inference: scalar text evidence is doing different jobs on different concrete queries. More influence restores cooking and lighthouse anchors while promoting unrelated phrase matches in the space-horror query. Weight tuning cannot establish that a candidate satisfies the requested concrete premise.

## Round 2: 48 source and weight variants

Eight diverse finalist shapes crossed three source policies and equal versus absolute query weighting. Results are in [scoring-source-round.json](scoring-source-round.json). The best development proxy remained the log-evidence strength family; for that setting, text-first/union/mood-union had identical anchor metrics. This does not establish that the full rankings were identical or that union failed to retrieve useful unfamiliar candidates. It demonstrates a limitation of watching a small familiar anchor set.

Equal weighting slightly changed the frontier: log evidence .6093 under text-first, versus .6113 with query weighting. Pure strength and soft-deficit variants slightly preferred equal weighting (.6051). No robust universal advantage appeared for threshold coverage, selected dimensions, or quantized evidence.

## Eight diverse finalists

`configs` exports two legacy references and eight new hypotheses. [scoring-finalists.json](scoring-finalists.json) records their top twenty candidates with score components and the development diagnostics.

| ID | Question |
| --- | --- |
| `strength-intent` | Does a fixed normalized strength scale with bounded mood evidence remove the original evidence imbalance? |
| `coverage-blend` | Does some explicit threshold coverage help beyond strength? |
| `soft-deficit` | Do strong below-threshold mismatches warrant a smooth penalty? |
| `selective-strength` | Are weaker inferred query attributes diluting the main intent? |
| `rounded-evidence` | Is fine variation in the captured text scalar useful? |
| `soft-coverage` | Does smooth coverage improve on a hard threshold? |
| `log-evidence` | Does diminishing marginal text evidence improve its tradeoff with strength? |
| `nonlinear-strength` | Should strongly present attributes outweigh several mediocre ones? |

These are diverse finalists for independent assessment, not the eight highest parameter settings on the same proxy. The worse selective/quantized variants remain useful falsification comparisons.

## What would justify a winner

Use rank-blind judgments of a pooled candidate set with concrete textual evidence, and distinguish missing evidence from a contradiction. Assess concrete premise satisfaction, mood fit, and relevant false positives separately. Freeze the rubric and candidate set before choosing among finalists, then compare per-query outcomes and regressions. Additional queries are needed for held-out validation because the existing fourteen have already informed both the old and new rankers. A larger evidence-based change is a better next experiment than another scalar sweep against the same familiar anchors.
