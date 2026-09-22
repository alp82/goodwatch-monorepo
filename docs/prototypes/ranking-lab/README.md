# Ranking lab: search trade-offs

**Throwaway logic prototype. No production ranking has been selected.**

Question: can mood searches improve while concrete matches remain useful, and which losses come from attribute coverage, attribute strength, text evidence, or candidate admission?

Open [index.html](index.html) directly. No installation, server, API calls, or persistence is required. The generated HTML embeds all 14 captured queries and can be shared as one file. URL parameters select a starting query/preset, for example `index.html?q=1&preset=blend`. Controls do not update the URL; download a review snapshot to retain a custom configuration and judgments.

This iteration lives on `proto/search-ranking-exploration`, based on `proto/range-count-ranking` at `c5398a5e`. The original prototype remains in the original branch/worktree. This is an offline experiment about interest discovery; it does not establish unfamiliarity or watchability.

## Inventory and direction

The initial branch provides 2,000 vector candidates for every query, 4,697 text candidates in total, selected fingerprint attributes and query weights, phrase readings, fractional text evidence, and title metadata. It already separates mood and concrete evidence and experiments with candidate-pool combination.

Three investigation notes informed this iteration:

- [Search inventory](../../research/search-ranking-inventory.md): goals, current main versus the prototype branch, accepted constraints, and outstanding implementation work.
- [Capture inventory and experiment results](../../research/ranking-lab-inventory.md): source counts, corrected explanations, stable-ID rank comparisons, and capture limitations.
- [Primary-source research](../../research/search-ranking-next-experiments.md): candidate recall, fusion, relevance judgments, and proposed follow-up experiments.

The accepted [30-query search baseline](../search-evaluation/README.md) remains the separate acceptance reference. The 14 development cases and watched titles do not replace it.

## What changed

The lab retains the original six presets and adds three explicitly experimental primaries:

- **Continuous coverage:** each wanted attribute contributes `min(score / strongMinimum, 1)`; each avoided attribute contributes `min((10 - score) / (10 - weakMaximum), 1)`.
- **Attribute strength:** theoretical-range normalized weighted sum multiplied by the number of selected dimensions.
- **Count + strength:** half the hard match count plus half the attribute-strength score.

All three use the concrete-phrase-leads evidence policy and its 0.25 weighted-sum tiebreak. Continuous coverage is a saturation experiment; attribute strength is a rescaling of the existing weighted sum, not a new retrieval model. Free-play controls expose every active scoring choice.

Four guided walkthroughs reset to known configurations: mood evidence, distinctive versus complete matches, concrete matches, and candidate limits. Each step is executable independently. Additional review tools include:

- Side-by-side top tens and titles entering/leaving them.
- Current-versus-baseline ranks for 80 watched title identities across all 14 queries.
- Stable media IDs and release years, so remakes and same-name titles remain distinct.
- “Excluded by strategy” versus “Absent from capture.” Neither means absent from the catalog.
- Clickable title inspection: score components, selected attributes, query weights, pass/fail, and vector/text fingerprint differences.
- Optional unjudged/off-target/plausible/strong judgments in memory. Unjudged titles are never treated as irrelevant.
- Explicit JSON download containing judgments, current configuration, baseline, top results, and the capture SHA-256. There is no import or automatic save.

## Findings from this iteration

The inherited explanation of the Tarkovsky regression was wrong: Stalker misses `non_linear_narrative=1` and `psychedelic=3`, not one attribute at five. Begotten misses two attributes at four. The 2010 How to Train Your Dragon already matches every selected dragon-query dimension. These expose different questions about completeness, strength, and evidence.

Ranks below compare against **Concrete phrase leads**, not live production:

| Watched identity | Concrete leads | Continuous coverage | Attribute strength | Count + strength |
| --- | ---: | ---: | ---: | ---: |
| Tim and Eric (`show:1229`) | 1 | 1 | 3 | 3 |
| Kung Fu Panda (`show:129959`) | 96 | 81 | 55 | 74 |
| Stalker (`movie:1398`) | 28 | 197 | 9 | 15 |
| Begotten (`movie:1483`) | 24 | 49 | 1 | 2 |
| How to Train Your Dragon 2010 (`movie:10191`) | 31 | 31 | 3 | 7 |
| Cooku with Comali (`show:114574`) | 11 | 11 | 40 | 37 |
| Sputnik (`movie:594718`) | 6 | 18 | 81 | 23 |
| They Live (`movie:8337`) | 1 | 1 | 4 | 1 |

**Verdict:** partial credit alone does not solve the observed Tarkovsky problem. Strength restores some familiar titles while losing positions elsewhere. No preset wins universally, and rank movement is not a human relevance judgment. Nothing from this experiment has been adopted into production code.

Next, judge the competing top tens and describe why results are wrong or useful. Resolve ambiguous creator-versus-style intent separately from score tuning. Before changing production, reconcile conflicting fingerprint sources, capture the full composed search output, and review the accepted baseline plus held-out queries.

## Limits made visible

“Legacy main approximation” is the original simulator preset, not an exact main replay. It lacks some server scoring inputs and differs in normalization. The inherited runtime changes on this branch also are not a new production implementation from this iteration.

The capture contains 68 overlapping candidates with differing vector/text fingerprint values. Text-first uses text values; union uses vector values for overlaps. Switching pools can therefore change both membership and input scores. The inspector shows both values; the experiment does not guess which is correct.

Text evidence is fractional accumulated evidence, not a literal phrase-hit count. Clause labels can be absent. Missing vector attributes were converted to zero by the capture script, so original missingness cannot be recovered. There is no original capture timestamp or saved production result ordering. The first phrase's concrete flag applies to all evidence; mixed intent is not modeled. Capture timings are not reranking timings, and the recorded text duration includes more than a single database query.

## Rebuild and verification

From the repository root:

```sh
python docs/prototypes/ranking-lab/build.py docs/prototypes/ranking-lab/capture.json
```

Edit `template.html`, then rebuild. `index.html` is generated. The capture is unchanged in this iteration.

Browser smoke checks exercised direct-file loading, guided steps, per-title inspection, judgments/export, all-query comparisons, top-ten comparisons, custom union, legacy preset controls, invalid URL parameter fallback, and a 390px mobile viewport. No browser exceptions were observed and the mobile page did not overflow horizontally. No test suite or production-service checks were added for this throwaway artifact.

To capture new queries, the inherited script lives at `goodwatch-webapp/scripts/ranking-lab-capture.ts` and depends on this branch's `prototypeParts` and `textPool` exports. It contacts configured services; uncached readings can incur charges. It was not run in this iteration. Reusing and rebuilding the existing capture is entirely offline.
