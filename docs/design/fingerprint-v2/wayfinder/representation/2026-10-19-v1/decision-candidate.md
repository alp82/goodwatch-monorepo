# Small ordinal-plus-facts representation candidate

For [Choose attribute representations and scoring scales to compare](https://github.com/alp82/goodwatch-monorepo/issues/721), within [Benchmark a richer fingerprint and discovery system](https://github.com/alp82/goodwatch-monorepo/issues/716).

The actual Q11 answer is **`develop_ordinal_plus_facts`**: develop anchored0–4 levels plus explicit facts. It is an **assisted direction preference**, following frontier review, not approval of this complete schema, evidence policy, provider, experiment or spending. Do not ask the format question again. The following small defaults are reversible candidates for independent review and root adoption; they are not recorded as human answers.

## Bounded decision and terminology

Use a **representation-screen subdocument** with **eight native integer0–4 ordinal fields and five finite fact templates**, 13 required assessment slots per work. Every slot must be present, but unknown and not-assessed are valid explicit states. This is complete for this bounded representation screen only; it is **not a complete title analysis or production fingerprint**. The existing glossary still defines Fingerprint as the74 V1 scores. This candidate does not redefine it or edit the domain glossary.

Use [candidate-matrix.json](candidate-matrix.json) for exact IDs, meanings, anchors and deferred families, [screen.schema.json](screen.schema.json) for structure, and [validate_contract.py](validate_contract.py) for focused consistency rules. [example.synthetic.json](example.synthetic.json) is a schema fixture, not evidence about a real title or a model result.

## Initial field subset

| Field | Measurement and purpose |
|---|---|
| experience.tension | Experienced intensity of unease/suspense when present; not duration |
| humor.absurdist | Experienced absurdist humor; not literal supernatural agency |
| humor.satire | Strength of humorous critique; not institutional subject presence |
| screen.retrospective_frame_centrality | Incidental versus defining use of retrospective narration; not flashback frequency |
| genres.comedy | Comedy-convention membership, separate from a catalog genre label or humor strength |
| evaluations.editing | Evaluative execution; separate from content presence, personal enjoyment and descriptive similarity |
| screen.observed_violence_peak | Highest severity in explicitly covered material; only a lower bound on work-wide peak if coverage is partial |
| screen.violence_exposure | Frequency over an adequately covered, declared denominator; unknown when coverage cannot establish it |
| facts.father_recounts_past_to_children | Boolean fixed role binding: father→recounts past→his children |
| facts.person_observed_by_audience | Boolean fixed observation binding; no knowledge-state or time inference |
| facts.graphic_violence_present | Explicit graphic-violence presence or supported absence |
| facts.strong_language_present | Separate explicit language presence/absence; violence evidence cannot answer this |
| facts.object_agency_binding | One finite mode/object/agency tuple: literal/metaphorical/hypothetical × tire/other inanimate object × telekinetic killing/other supernatural agency; plus none_in_scope |

The chosen development cohort contains comedy/satire, tense action/drama, retrospective series framing and a difficult literal-object/evidence-gap case. These provide useful contrasts without a547-field requirement. Cohort membership and preference records are private and do not belong in this artifact. The field choices are motivated probes, **not factual assertions that a particular work exhibits them**. The exact-source gaps remain real; a selected title is never replaced just to fill a score.

Retain one quality field so insufficient craft evidence cannot quietly become a zero or an invented quality verdict. Keep both peak and exposure to expose brief-severe versus frequent-mild content. Add no general-purpose graph: the fixed role/category templates bind only what their definitions state. They cannot establish audience knowledge, same-scene co-occurrence, a character outcome or arbitrary related entities.

## Native anchors and assessment states

All ordinal values are integers0–4 with **measurement-specific** anchors:

| Family | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Intensity | Supported none | Mild | Moderate | Strong | Extreme |
| Structural centrality | Supported none | Incidental | Secondary | Major organizing | Defining frame |
| Genre membership | No supported conventions | Trace | Substantial hybrid | Clear identity | Defining conventions |
| Execution quality | Severely ineffective | Weak | Competent/mixed | Strong | Exceptional |
| Observed violence severity | None in covered material | Threat/implied | Non-graphic | Graphic detail | Extreme graphic detail |
| Exposure frequency | None in covered denominator | Isolated | Recurring minority | Frequent | Near-continuous |

These are uncalibrated editorial anchors. Intensity is strength **when present**, not persistence. Frequency needs a denominator; no durations, percentages or episode counts are inferred from these words. Quality0 means poor execution, not absence. Observed peak is not a measured whole-work maximum without adequate coverage. Ordinal0 never establishes a strict exclusion; factual negative predicates remain separate.

Every slot has state, value, profile_ref and reason. Assessed has a typed value and a resolvable source/interpretation profile. Unknown has null with insufficient-evidence, conflict, or identity/scope reason. Not_applicable has null and structural justification; it is not a convenient alternative to evidence absence. Not_assessed has null and an explicit outside-screen reason. Omission of any of the13 slots is invalid. Omitted **families**, listed explicitly below, are deferred rather than assessed absent.

## Attribution, scope, modality and negative claims

The input preparer freezes work/edition/as-of scopes, field targets, source records and at most six attribution profiles per field. Model-visible bundle descriptions are neutral input locators, not these hidden validator/reference metadata. With one meaningful bundle, attach it deterministically; with several, providers may select a neutral bundle ID. They cannot upgrade custody metadata or see hidden expected values, negative_fields, adjudicated binding/conflict or safety eligibility in labels. Each profile names source IDs, basis, exact claim scope, modality, polarity, coverage, independent-verification status and conflict/binding state. Assembly compares those fields against the frozen input context. Semantic source entailment still needs reference preparation; schema validity is not factual correctness.

Source assertion, interpretive judgment, unverified model knowledge and synthetic fixture remain distinct. Generated catalog assertions are never independent references. Source “may” cannot silently become an asserted fact; direct-source profiles retain source modality/polarity. An interpretive strength value is not a factual presence claim. Store raw joint distributions, selected tuples and any explicitly defined per-value aggregation separately. Probability of one joint value/bundle option is not calibrated confidence in that value. Keep these readouts separate from magnitude and independently checked evidence.

Positive fixed facts are usable as **packet-asserted predicates** only with a matching field/work/scope, asserted modality/polarity, non-conflicting source support and validated binding. Catalog-supported positives remain catalog assertions, not gold. Possible/hypothetical claims remain visible but do not pass unconditional affirmative filters. Averted/subverted labels do not prove actual presence or blanket absence.

For a conservative initial screen, Boolean false or object category none_in_scope requires a checked negative profile: explicit negation, exact property/scope, independently verified full-scope coverage and explicit negative support in cited references. A coverage manifest must resolve in the frozen coverage_manifests registry, match the scope/denominator and cited full source/manifest references; arbitrary strings and profile flags are insufficient. Partial-source aggregation is not implemented in this bounded version and remains deferred. A coverage manifest identifies the work/edition/units actually covered; an overall-series label is not proof every episode was reviewed. Current thin premise evidence cannot certify negatives. Partial material may support a positive event but usually cannot establish work-wide absence or frequency. Missingness, low intensity, low class probability, empty advisories and absent tags never mean absent.

This negative gate is a proposed sufficient condition for the screen, **not adoption of the prototype's entire evidence policy or a universal certification standard**. Corpus/reference ownership must substantiate manifests and decide any aggregation of partial sources before execution. Persist raw unsupported positive and negative predictions, native readouts and rejection reasons before canonical withholding. Hidden-referee scoring uses those raw predictions, so safe canonical filtering cannot censor knowledge errors toward positives or abstention. Do not silently repair predictions into successes. Strong language and graphic violence have independent references.

## Native mappings and bounded work

Prefer direct categorical decisions for this candidate. A generative model emits the same canonical field/state/value/profile outcomes. A decision model uses one Choice question per required field, with the trait definition and its native anchors explicitly visible in the criterion. Freeze one target scope per field across compared arms; no model can choose a narrower scope to obtain a negative answer.

The default is the smallest neutral frozen source-bundle bank: one disclosed bundle per field/scope when sufficient, attached deterministically as input availability, not a model-selected entailment citation. Preserve distinct conflicts or an explicit unverified-knowledge path when they are meaningful. When multiple bundles are genuinely needed, an assessed choice may encode **(native value, neutral bundle ID)** jointly; canonical profile metadata stays in validator custody. Up to six predeclared profiles include evidence bundle, scope, basis, modality/polarity and coverage; no separate evidence question assumes knowledge of another parallel answer. Prune type/scope incompatibilities only; do not prune answers or source bundles because hidden referees know them false. Source text may retain its own negation/modality. If verified claim annotations are deliberately supplied, label and cost that assistance; the task is curated-assertion use rather than raw-source extraction. The five nonassessed labels are U_INSUFFICIENT, U_CONFLICT, U_ID_SCOPE, NA and NOT_ASSESSED; their exact state/null/reason mapping is in the matrix. Unknown/N/A do not occupy positions on the ordinal ladder.

Bounds are13 decisions: eight ordinal, four Boolean, one13-category binding. With six profiles per field, the conservative upper bounds are **35/17/83 choices per ordinal/Boolean/binding question**, **431 choices total**, before deterministic pruning. Maximum83 is below the researched direct Jev Choice255-option limit; that does not establish compatibility of other routes. These are option/question inventory bounds, **not tokens, requests, dollars or permission**. Sources≤12, scopes≤3, references/profile≤3, profiles/field≤6, profiles total≤78. If a meaningful source bank cannot fit, narrow the declared contrast or return the scope issue; do not drop support or hide chained calls.

Native Score with five anchors can return a probability-weighted fractional magnitude. That is a different output from selecting one discrete level: **do not round its mean into this schema or put unknown on that ladder**. A later explicitly approved native-Score diagnostic could preserve the fractional value and distribution under a different schema. Noul/class probabilities likewise cannot become intensity or proof of absence. No implicit threshold, calibration or fallback is adopted. A native-Score route that cannot fit this discrete adapter is not admitted to this contract, not a quality loser. A later routine adapter/manifest investigation is not an added call or a user approval invented by this document.

Provider research is documentary context at [published commit6b50d8eb](https://github.com/alp82/goodwatch-monorepo/commit/6b50d8eb01d04f02f1567b29cd97500f7348ee10). Native candidate rendering, exact route/version/settings, billed-token/work/response limits and scheduled compatibility still belong to the runner. No current route, rate or full pipeline fit is established by this matrix. Do not inherit historical batch/fanout/call caps, make an extra compatibility call, download models or spend because this document exists.

## Comparisons and consumer destinations

For an evidence contrast, hold these13 IDs, meanings, rubrics, target scopes, allowed states, producer and settings fixed. Vary the explicitly declared evidence packet and resulting neutral profile availability under a fixed profile policy. A/B therefore estimates the combined enrichment/profile-availability intervention, not a text-only change with identical choice tasks; retain those differences and report coverage changes. Freeze independent reference preparation before candidate outputs. For a provider contrast, hold the same evidence, schema, profile bank and targets fixed, preserving native receipts and adapter differences. Include all assigned companion/evidence/adapter stages in later quality and cost accounting. **Q8's evidence-first A/B/C protocol is not approved by Q11.**

Existing V1 has74 integer0–10 fields (11 values); the historical Jev l10 had10 native levels remapped to0–10. Neither is the same as this native5-level contract. The matrix lists related legacy keys and changed meanings. Retrospective centrality is not legacy nonlinearity intensity; satire is not the satire/parody composite; legacy violence cannot supply peak plus exposure. Do not force74 legacy fields or derive new values by rounding old outputs. A later precision comparison must independently elicit matched meanings at both scales, with common source/reference conditions; scale optimization is deferred unless it changes a needed answer.

| Destination | Candidate data path / limit |
|---|---|
| Experimental vectors/similarity | A versioned, missingness-aware **derived** descriptive profile only; keep families separate and quality/advisories out by default. No equal-distance assumption, zero imputation, alias double-counting, actual embedding or production vector produced here |
| Exact filters | Fixed fact template plus identity, scope, modality, polarity and coverage checks; unknowns withheld for strict constraints. Soft ordinal preferences are not hard negatives |
| Existing display areas | Future adapter may show anchor words and uncertainty/coverage under familiar labels. This is a data contract only; no UI/design or threshold migration |
| Explanations/highlights | Stable field IDs + native anchor + evidence/profile locator + coverage/modality. Do not select highlights by maxima across unlike families; companion owner supplies complete prose/highlight contract |
| Title snapshots / Taste / moods | V1 remains unchanged. Its74-byte vector, 255-missing marker, snapshot format, Taste calibration and mood fallbacks require explicit future migration review; this13-slot document is incompatible |

Static source pointers: [architecture impact](../../architecture-impact.md) in the existing evidence packet; repository files goodwatch-webapp/app/server/title-snapshot/format.server.ts, app/server/taste/formula.server.ts, app/domain/moods.ts, app/server/utils/fingerprint.ts and app/ui/details/fingerprint/scales.ts (the latter paths relative to goodwatch-webapp). The current moods accessor can substitute0 for missing scores, so feeding this candidate through it would violate unknown semantics. This is a boundary finding, not an implementation request.

Reuse historical harness ideas—frozen prompts/hashes, paired title rows, repeat records, native raw responses, source QA, attempted/valid/reviewed denominators and stage ledgers—without running that harness or inheriting its approvals. Later comparisons report source-supported/contradicted/unknown judgments, ordinal disagreement within each family, coverage/abstention, exact-filter false assurances, repeat drift and complete-output cost/latency. Qwen agreement is not gold; native means, mapped values and class confidence are separate columns. No numeric non-inferiority threshold, new holdout or production winner is declared.

## Deferred families and completion boundary

Explicitly not assessed here: remaining legacy fields; remaining547 vocabulary; contextual suitability/audience fit; precise counts/durations; open graphs and outcomes/knowledge-state timing; color/presentation facts; other advisory topics; and complete companion outputs. Counts/durations should later be sourced typed quantities with units and coverage, not ordinal strength. Suitability needs specified audience/context and is not factual safety. Outcome/scene/knowledge relations need independently supported participants/timing, not title-wide co-occurrence.

Astra's separate companion work owns full essence/tags/highlights, advisories, production/context families and assembly. Reuse the two fact/advisory predicates above instead of independently generating contradictory duplicates; ownership/completeness must be frozen before calls. This matrix does not waive any eventual complete-output family.

The bounded representation decision can resolve after independent review/root adoption of this candidate, citing Q11 as direction and the remaining details as reversible defaults—not as full human schema approval. No additional abstract format question is needed. Corpus/evidence/companion policy and provider/executable protocol remain their existing owners' prerequisites. Root should consolidate genuinely consequential remaining choices across that whole protocol (at most three), rather than reopen individual field/anchor questions. No issue is closed by this draft and no dependency is removed.

## Corrected assembly and ownership boundaries

The standalone validator CLI checks JSON shape only; validate() adds internal declared-metadata consistency. Executable assemble() requires a frozen context and a run manifest, freezes primary_scope_ref as well as banks, binds every scope to the manifest work and takes producer/model/prompt/source/bank/cell provenance from that manifest. It retains raw predictions/readouts even when canonical output is withheld. None of these checks proves source truth. See [renderer and raw/canonical boundary](renderer-boundary.md) and [companion reconciliation](companion-reconciliation.md).

The separate 48-request A/B/C recommendation remains explicitly unapproved. It contains no hidden masked/probe calls; mathematically unused requests are not autonomous spare capacity. No new arm choice has been made or published by these corrections.
