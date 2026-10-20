# V1 decision-model diagnostic screen — 20 October 2026

**Tentative next step: validate Liquid d1 more broadly; consider Microsoft Decision1 for a targeted applicability/coverage follow-up. Keep production unchanged.** Independent frontier-model review supports that screening priority with moderate confidence, but confidence in production suitability is low. **HUMANSELECTIONPENDING. No next calls are authorized.**

The bounded screen is `completed_reviewed`; the overall research goal is not complete. This report summarizes fifteen returned outputs, including invalid attempts, without canonical acceptance. The accepted [Jev scoring ADR](../../../../../adr/0001-no-jev-for-fingerprint-scoring.md) remains unchanged. This exploratory screen does not establish a reason to replace its production decision.

## What was compared

Five models each received the same title-specific synopsis, whole-title task, 74 V1 definitions in declaration order and sixteen numeric/nonordinal option meanings. Eleven numeric choices map directly to integers 0–10; insufficient support, conflict, unresolved identity/scope, not applicable and not assessed remain distinct null states. Probabilities are not trait intensity or calibrated factual confidence. These are attribute-score vectors, not search embeddings.

The three exposed development titles were Fight Club (1999; edition unrecorded), How I Met Your Mother (2005; overall series through 2014), and Death Note (2006 anime; overall series through 2007, dub/version unrecorded). Within a title, model-visible state and questions were identical across models; routing/model/price fields differed. Requests followed a fixed rotated order, once per configuration, with zero inference retries or repeats. Reviewer passages, catalog scores, prior answers and personal data were not supplied to the models. Prior exposure, including unscheduled synthetic drafts, prevents any holdout claim.

## Coverage and economics

| Model | Numeric / 222 | Unknown / NA / not assessed | Eligible numeric: original → diagnostic | Complete 74-number outputs / 3 | Reconciled three-output USD | POST median (range), seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Liquid d1 | 222 | 0 / 0 / 0 | 222 → 222 | 3 | 0.000512980 | 0.778 (0.613–0.885) |
| Microsoft Decision1 | 201 | 0 / 12 / 9 | 201 → 201 | 0 | 0.001223460 | 1.160 (1.025–1.673) |
| Span02 | 207 | 8 / 2 / 5 | 0 → 207 | 0 | 0.001466410 | 2.452 (2.438–2.683) |
| Perplexity Flash1.2 | 219 | 0 / 3 / 0 | 219 → 219 | 1 | 0.001356840 | 3.855 (3.529–4.792) |
| Jev1.14 | 211 | 5 / 0 / 6 | 0 → 0 | 0 | 0.001590666 | 0.412 (0.405–0.497) |

All fifteen response maps contained 74 keys: 1,110 records = 1,060 numeric + 13 unknown + 17 NA + 20 not assessed. Missing keys: zero. Microsoft's nonnumeric states are coverage gaps, not missing response keys. Complete means 74 eligible numbers, not 74 correct facts; absence of abstention does not establish quality.

Span's numbers are available only in an explicit retrospective diagnostic lane: mass tolerance 1e-6 and selected/argmax tolerance 1e-12, with no normalization or label changes. Original runtime flags and withheld values remain untouched. Jev's three whole attempts remain ineligible, with 14 mass failures, four selected/argmax discrepancies and native output counts 12,241–12,251 exceeding the observed 8,192 threshold. Individual Jev fields remain raw observations only.

**All-five common eligible fields: zero**, in both original and diagnostic lanes. Excluding Jev, the four-family diagnostic intersections are **67/74, 62/74 and 62/74**, in title order above. Raw arithmetic intersections must not be relabelled as five accepted vectors. Numerical eligibility and disagreement with catalog scores are not factual accuracy.

## Why further validation is warranted

The following selected predictions illustrate consequential differences. Span is retrospective diagnostic only; Jev is raw-only and its entire attempts remain ineligible. Catalog values are existing primary attribute scores with unknown producer, prompt and cutoff, never gold.

| Title / attribute | Liquid | Microsoft | Span | Perplexity | Jev raw | Catalog |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fight Club / eroticism | 0 | 0 | 2 | 0 | 1 | 6 |
| How I Met Your Mother / nonlinear narration | 10 | 10 | 10 | 8 | 10 | 9 |
| How I Met Your Mother / pathos | 0 | 0 | 4 | 0 | 0 | 7 |
| Death Note / violence | 3 | 4 | 0 | 4 | 1 | 7 |
| Death Note / mystery | 5 | NA | 6 | 4 | 7 | 10 |

Retained BBFC material describes sexual content for a named Fight Club cinema edition; the selected edition is unrecorded, so it challenges broad absence-like predictions without determining a correct integer for this cut. Retained VIZ anime material describes killings and investigation in Death Note; this raises concerns about violence 0 and mystery NA, but does not calibrate intensity, graphic exposure or safe viewing. Those reference passages informed review, not model inputs, and are not reproduced here.

The HIMYM synopsis explicitly describes retrospective narration, supporting the broad property without proving a score of 10. Pathos concerns rely on reviewer interpretation/recollection rather than episode-complete source coverage or ordinal gold. Source silence never proves absence. Craft scores also lack independent quality calibration: applicability, unknown quality and low quality must not be conflated.

Liquid supplies three complete numerical vectors and recognizable differences across movie, sitcom and anime, but still misses emotion/content and assigns unverified craft numbers. It alone meets the exploratory completeness condition for broader validation; that is not production acceptance. Microsoft shows useful content/craft distinctions but its twelve NA and nine not-assessed predictions require a targeted test, not promotion as a second complete finalist. Span remains a diagnostic contrast; Perplexity's exact recipe is deprioritized for detailed coverage; Jev requires technical resolution before eligible comparison.

## Accounting, limits and reproducibility

The fifteen returned-output charges reconcile to **$0.006150356**, including invalid/withheld results. Sixteen screen POSTs include one failed DREX request with no predictions; five remaining DREX chunks were retired unattempted. Adding three separate prior-stage POSTs gives nineteen initial attempts, zero retries. DREX has no quality result; failed/unattempted work is neither an uncertainty prediction nor a zero fingerprint.

Cumulative cash is **$0.009770586**. Separate unresolved liabilities remain **$0.712462720**: prior-stage $0.209146240 and failed DREX $0.503316480. Consequently the fifteen-output subtotal is not a proven total charge for all sixteen screen POSTs. Avoided unreserved ceilings are not spend or released cash. Historical metadata/cost stop flags remain preserved even where later billing reconciled them.

These are **scores-only** prices and n=3 caller-side POST latencies, including unusable outputs. Any per-1,000 figure in the aggregate is merely three-title arithmetic, not accepted-vector pricing or pipeline savings. Companions, enrichment, infrastructure, embeddings and search were not tested. Native and generic token meters are different; null cache/reasoning and internal groups/passes remain unknown. Timings exclude metadata and review waits and do not measure throughput.

No factual gold, repeat stability estimate, fresh holdout, paired current Qwen control or statistical winner exists. Historical Qwen/Gemini runs are not matched controls. The catalog's producer/model/version/prompt/episode cutoff remain unrecovered. Movie/show scope labels do not establish that every relevant scene or episode was covered.

The [public runtime documentation](../../README.md), [field contract](../../v1-contract.json), [quantitative aggregate](aggregate.json) and [experiment summary](experiment-manifest-summary.json) expose mechanics and audited counts. Exact requests, source passages, responses, private provenance and custody receipts remain outside the public repository. Public files cannot independently reproduce the exact run or verify every retained passage. The aggregate preserves its source packet's historical candidate-status label; it does not record human selection or dispatch approval.
