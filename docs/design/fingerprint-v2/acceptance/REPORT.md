# Fingerprint V2 acceptance result — 24 October 2026

The subsequent [Sol 6.1 low](SOL-LOW-COMPARISON.md) and [Astra low](ASTRA-LOW-COMPARISON.md) local-agent comparisons extend this experiment to the same twelve titles and two vector repeats. They preserve the Qwen results below; the Astra report includes the three-arm comparison.

**Decision: freeze the field inventory and storage contract; keep the producer recipe open for correction. The current recipe is not ready for unattended trusted collection.** Raw draft collection remains useful, but this work does not deploy it or promote these predictions into production.

The practical acceptance pass is complete: all twelve titles returned all three parts, four problematic vectors and two facts requests received a bounded candidate follow-up, and two vectors were repeated with identical request bytes. Original responses, failures and candidate lineage remain separate. No result was chosen because its scores looked better, and no unknown was filled with zero.

## What is ready to keep

The canonical design is [draft.8](../draft-8/README.md), `2.0.0-draft.8`, projection `similarity-v2.3`: **274 ordered vector dimensions + 686 attribute entries = 960 entries per title**. Attributes contain 344 targeted scores, 171 presence flags, 61 facets and 110 advisory details. The readable references, schemas, definitions and mapping agree; every field has exactly one producer owner.

The purpose audit covers the complete inventory and 18 near-neighbor decisions. It found reasons to retain distinct meanings rather than merge fields simply because one title scores both highly. This does not establish statistical independence or settle group weights. Themes still occupy 71/274 coordinates; weighting remains separate work.

The retained 121 Reddit cases include 78 expressible distinctions, 20 catalog/user-context requirements, 18 intentional relational/temporal limits, 4 precision limits and 1 catalog-level aspect-ratio gap. The title reviews exercised distinctions from 78 retained cases; that is a separate count, not 78 successful query results. Same-character/event relationships and query execution remain outside this simple structured-data contract. No larger taxonomy was needed to explain the important failures below.

Draft.8 clarifies staged reality versus digital simulation, real versus fictional calendars, ideological radicalization, older-adult characters and voice-performance assessment. It preserves the 274 coordinate positions while versioning their clarified semantics. These changes and the calendar-system facet are frozen separately from later prompt recipes.

## Generation and validation changes

Three disjoint requests generate vector, targeted attributes and remaining facts/advisories. The tested successor joins each of 15 vector score/presence pairs in one producer object and uses presence-dependent advisory branches. Lossless decoders restore the unchanged canonical schemas. Historical membership annotations are removed from producer definitions, and the scoring prompt distinguishes ordinary ordinal uncertainty from genuinely unknown content. Controller assembly merges owned leaves, including shared facet groups, without overwriting another request's fields.

The four corrected vector calls all returned 274 numbers. Same-field positive/absent contradictions disappeared in those candidates. Some consistency came from changing presence flags, so a clean pair is not itself evidence of a factual correction. The later unseen titles still exposed failures.

Durable artifacts: [reproducible producer recipes](producer-recipes/README.md), [additional consistency checks](consistency-checks/README.md), and [collection policy](COLLECTION-POLICY.md). The eight producer tests and eleven additional consistency tests passed independently at root. The existing 58 schema checks, recipe state-space checks and runner checks are recorded with their respective packets. Frozen initial producer bytes remain intact.

## Twelve-title result

The following view uses the explicitly released candidate replacements and each remaining title's first returned result. It is a mixed-recipe cohort, not twelve observations of one unchanged prompt. The repeat results are kept separately.

| Title | Numeric vector /274 | Targeted numeric / applicable | Most useful finding or remaining problem |
|---|---:|---:|---|
| [Thank You for Smoking](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/thank-you-for-smoking/fingerprint.md) |274|336/336|Recognizable satire/persuasion profile; one world score/presence conflict and questionable legal-case interpretation remain.|
| [The Truman Show](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/the-truman-show/fingerprint.md) |274|336/336|Candidate fixes blanket vector abstention; audio-startle/jump-scare conflict remains. Repeat has a major simulation error.|
| [Breaking Bad](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/breaking-bad/fingerprint.md) |274|343/344|Strong crime/family profile; three presence conflicts and ideological-radicalization calibration concern.|
| [Code Geass, original TV + R2](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/code-geass/fingerprint.md) |274|343/344|Paired candidate fixes seven original presence conflicts; audio/jump-scare inconsistency remains.|
| [Koyaanisqatsi](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/koyaanisqatsi/fingerprint.md) |274|333/336|Candidate fills 187 former nulls; contemporary technology, audible-versus-visible environment and century/decade interpretation remain problematic.|
| [Daughters of the Dust](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/daughters-of-the-dust/fingerprint.md) |274|55/336|Candidate fills 15 vector nulls; 281 targeted unknowns and source-contradicted advisory absences remain.|
| [Singin' in the Rain](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/singin-in-the-rain/fingerprint.md) |274|332/336|Dance/musical essence is captured; breaking/hip-hop and masala labels show category spillover.|
| [Paterson](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/paterson/fingerprint.md) |274|335/336|Quiet poetic routine is captured well; capture medium and narration facts are wrong or omitted.|
| [The Witch](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/the-witch/fingerprint.md) |274|1/336|Atmospheric folk-horror vector is useful; 335 targeted unknowns make most specific predicates unavailable. Capture and chronology facts also fail.|
| [Persepolis](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/persepolis/fingerprint.md) |273|336/336|Radicalization remains unknown; color-process facets omit the color framing around the black-and-white story.|
| [Detectorists, regular series 1–3](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/detectorists/fingerprint.md) |272|343/344|Adult friendship/rural comedy essence is strong; legal-case and political-struggle coordinates remain unknown, and continuing arcs are underreported.|
| [Mushishi, original 26 episodes](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/mushishi/fingerprint.md) |274|343/344|Strong contemplative nature/anime profile; ecological investigation is scored strongly as monster hunting.|

Movies have eight inapplicable series attributes, excluded from the targeted denominator. Required-key coverage is 100% for all twelve; useful coverage is plainly different.

**10/12 vectors are numeric-complete.** Seven fingerprints pass the existing full publication-pair validator. An independent audit found five existing pair contradictions and nine additional definition contradictions across the cohort; after numeric completeness, pair checks and additional checks, **three** have no detected deterministic blocker. Those three are Daughters, Paterson and The Witch—and each still has material factual or coverage problems. Passing automatic checks is not a quality verdict.

The additional checks cover known-value contradictions in auditory startles/jump scares, real-time presentation, continuous takes and bounded century/decade assertions. They deliberately do not turn unknowns into errors, centrality zero into absence, or matching release/story years into proof of a mistake. Their coverage is bounded, not exhaustive.

## Identical-input repeats

| Vector | Shared numeric | Changed coordinates | Mean absolute change | Median | P90 | Maximum |
|---|---:|---:|---:|---:|---:|---:|
| Truman |274|150|0.810|1|2|10|
| Mushishi |274|158|0.661|1|1|3|

Both repeats used exactly the same request bytes as their respective candidate baselines and returned no nulls. These are repeat differences, not errors against a reference answer. Most changes are small, but **Truman's `world.simulation` changes 0→10**, despite the definition explicitly excluding a physically staged world. Its detective-lead score also changes 5→0. An average below one point hides a consequential interpretation reversal.

Mushishi's repeat changes several absent world flags to present alongside low positive scores. Coherence constraints can therefore allow mutually coherent but unstable predictions. One repeat per title measures these observed differences only; facts and advisories were not repeated.

## Quality findings that matter for collection

The same fields generally already express the needed distinction. Paterson's 35mm assertion conflicts with the director/cinematographer's account of digital Alexa capture; its narration facet misses the poetry voiceover described by IFFR. [Creator interview](https://www.filmcomment.com/article/jim-jarmusch-paterson-gimme-danger-interview/), [festival description](https://iffr.com/en/iffr/2017/films/paterson).

Daughters' absent sexual-violence, profanity and substance-use advisories conflict with release-qualified classification evidence. A structurally valid absence must not become a confident exclusion guarantee. [BFI release listing](https://player.bfi.org.uk/subscription/film/watch-daughters-of-the-dust-1991-online).

Mushishi exposes a useful boundary to tighten in generation: understanding or treating supernatural ecology should not automatically imply combat/eradication centrality. The current broad hunting definition can include some tracking/capture, so the review does not invent a corrected integer or assert that every such activity is absent. The broadcaster describes primitive life forms whose existence is not inherently threatening. [Fuji TV premise](https://www.fujitv.co.jp/b_hp/mushishi/index.html).

These reviews used retained primary sources and explicitly labeled interpretation or viewing-report concerns. They did not independently watch every work, verify every ordinal, certify every edition's advisory absences or measure recommendation quality. Practical factual mistakes and coverage failures are sufficient to withhold unattended-collection approval without inventing gold vectors.

## Cost, retries and preservation

The complete acceptance experiment used **50 POSTs: 44 returned projections and 6 throttled attempts**, with 6 retry POSTs. Known attributable spend is **$0.095605874**. Six unknown-charge reservations totaling **$0.908355840** remain held; these are conservative bounds, not demonstrated charges. All inherited liabilities remain untouched.

The selected latest three-part components sum to $0.082835336 across twelve titles, excluding superseded outputs and repeats. This mixed cached/cold batch is not a general production cost forecast. The task-local cumulative ceiling was explicitly raised from $1 to $1.50 after conservative reservations stopped the finite schedule; the overall $5 guard and all prior histories remained unchanged. No additional titles or repair calls were added. Final global known cash is $0.234978898; total inherited/current pending bounds are $4.118868352.

Complete response usage/cost attribution avoided separate billing lookups in the successor runs when all identity, usage, price and bound checks passed; the finite fallback remained available. OpenRouter documents response usage cost and generation lookup as accounting options. [Usage-accounting documentation](https://openrouter.ai/docs/cookbook/administration/usage-accounting).

Root independently recomputed repeat differences and cost sums. Final assembly checked all 11,520 canonical slots and 36 selected component joins, with 352 bound hashes and 117 output-file seals. No production data, retrieval configuration, taste logic, commit or deployment was changed.

## Closure and next implementation boundary

**Keep 274 + 686 fixed and stop expanding the inventory.** The next work should improve population of those fields: bounded regeneration of missing/conflicting parts, stronger definition adherence, explicit handling of sparse targeted output, and restraint on unsupported precise facts or advisory exclusions. Preserve every failed original and revalidate the assembled result. Do not repair values by arithmetic or choose the prettier repeat.

The current canonical contract can serve versioned draft collection. Trusted automatic admission remains blocked by the observed producer failures. Qwen remains primary under the existing decision; this pass tested the pinned Qwen 3.8 route and does not validate every production popularity-based model route. No new production pipeline or further experiment is launched by this report.

## Full evidence and examples

[Compact machine-readable result](results-summary.json). Each title in the table links to its full readable fingerprint.

- [All twelve readable fingerprints and lineage](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/latest-twelve-v1/summary.json)
- [Execution handoff](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/FINAL-HANDOFF.md)
- [Per-title selected costs](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/cumulative/selected-latest-costs.csv) · [all accounting and repeat changes](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-final-continuation-v1/cumulative/accounting-and-repeats.json)
- [Root consistency report](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-root-v1/final-consistency-v1/REPORT.md) · [independent repeat/arithmetic checks](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-root-v1/final-independent-checks.json)
- [Eight new-title assessments](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-cohort-v1/review/assessment-v1/REPORT.md) · [candidate changes](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-cohort-v1/review/candidate-assessment-v1/REPORT.md)
- [Four anchor review](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-root-v1/ANCHOR-REVIEW.md) · [root follow-up review](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-root-v1/FOLLOWUP-REVIEW.md)
- [Complete readable vector](../draft-8/vector.readable.md) · [complete readable attributes](../draft-8/attributes.readable.md)
