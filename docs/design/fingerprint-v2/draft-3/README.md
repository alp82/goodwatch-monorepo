# Fingerprint V2: revised two-part contract

**2.0.0-draft.3**, similarity projection **similarity-v2.2**. This incorporates the accepted completeness reviews into a design revision. It is not deployed, and no new predictions have been generated for this revision.

## The two schemas

| Contract | File | Contents |
|---|---|---|
| Similarity fingerprint | [similarity.schema.json](similarity.schema.json) | All **274** integer scores, exact title/scope, evidence and assessment basis. No nulls in a publishable vector. |
| Companion metadata | [metadata.schema.json](metadata.schema.json) | **325** available numeric attributes, **171** presence concepts, **21** advisory topics, typed facts, contexts and relationships. Explicit unknown/not-assessed states. |

Both are self-contained JSON Schema Draft 2020-12 documents. Definitions and measurement anchors are in [definition.json](definition.json). [mapping.json](mapping.json) fixes the vector order; JSON property order does not. Values remain 0–10, with no automatic rounding, flooring, normalization or zero imputation.

[similarity.response.schema.json](similarity.response.schema.json) is the nullable intake variant of part one, **not a third product part**. It preserves honest inability to assess; it cannot be indexed until all scores pass the complete contract. The explicit group basis remains required. A structurally complete prediction is not proof of accuracy.

## Changes to similarity

The prior 258 dimensions remain, with **12 additions**:

- Emotional response: tranquility, indignation, disgust.
- Form and aesthetics: lyricism, transgression, cutting pace, magical realism, didacticism, confined setting.
- Themes: persuasion/propaganda, illness/dying, corruption.

Four existing story-arc scores move from metadata into general similarity: revenge, redemption, fall from grace and underdog rise. This gives **274 dimensions**. All fields and group sizes are visible in [schema-overview.md](schema-overview.md).

Definitions now distinguish court cases from legislative hearings, cooperation between adversaries from friendly peers, ongoing couples from former partners, direct audience address from voiceover, personal illness from population-level disease, and digital simulations from physically staged reality. A score of 1 requires supported trace presence or minor importance; it is not an uncertainty placeholder. See the exact changes and reassessment list in [migration.json](migration.json).

## Companion data and niche queries

The **325** numeric metadata fields comprise 290 content descriptors, 17 viewing-context scores, eight series traits and ten evaluations. There are 33 new metadata scores, covering missing settings, occupations, activities, relationship patterns, soul/R&B and funk, real-time/vignette/non-narrative form, and additional camera treatment. These scores do not enter general vector distance automatically; they can support filtering and personal preference models.

All companion sections have an explicit place in the output contract and [metadata prompt](METADATA-PROMPT.md):

- Format, animation technique, anime tradition, fiction/nonfiction/hybrid form, documentary devices, color, capture medium and release format, single-take and real-time presentation.
- Catalog-linked language (including signed languages), countries, people, companies, adaptations and source works.
- All 21 advisories, with separate occurrence and optional intensity/frequency/explicitness/centrality.
- World/era/place, seasonal and cultural contexts; representation linked to identified characters.
- Entities, character relationships and outcomes, enabling same-character conjunctions and spoiler handling.
- Typed work links (adaptation, remake, sequel, parody, homage, etc.) and depicted real people/events.
- Extensible concept assertions for cultural traditions, film movements, music and niche subjects, using canonical IDs where supplied and proposed IDs otherwise.
- Audience contexts, attributed reception or labeled derived proxies, temporal segments, essence and non-spoiler highlights.

For example, “a black-and-white courtroom film with an unrequited relationship involving its protagonist” can combine format facts, courtroom presence and a relationship whose subject ID carries a protagonist role. A bag of unrelated tags would not establish that conjunction. These capabilities are schema support, not measured retrieval success.

**Do not force every metadata field into every request.** The metadata envelope has explicit section states, while numeric and presence maps can be targeted. Every requested field must return a record; unrequested omissions mean not assessed. This prevents partial enrichment from masquerading as complete coverage. A complete-scope enrichment request can request all 325 fields and 171 concepts, but completeness of the vocabulary does not mean all claims are knowable.

## Generation and indexing

Keep similarity and metadata generation separate. Use [SIMILARITY-PROMPT.md](SIMILARITY-PROMPT.md) with only selected definitions; use [METADATA-PROMPT.md](METADATA-PROMPT.md) with the requested metadata definitions and typed sections. Supply immutable title/scope/provenance and an evidence registry. Existing catalog data should be joined rather than regenerated. Metadata can be enriched in bounded sections and merged by the controller; these are two logical contracts, not a requirement for two enormous calls. A merge must preserve scope and provenance and resolve conflicting claims explicitly, not use last-write-wins.

The canonical schemas use conditionals and reference definitions. Provider-specific strict-output adaptation and acceptance have **not** been tested. Do not send the whole 599-field registry with the similarity request. Cost and latency for this revision remain unmeasured.

[indexing-contract.json](indexing-contract.json) defines numeric operators, rubric-relative thresholds (2/5/8), unknown handling, typed relationship joins and spoiler labels. Presence does not imply importance; zero centrality does not prove absence. Canonical concept resolution and source verification are controller responsibilities; arbitrary proposed IDs, self-declared evidence and model hypotheses do not become verified filter facts just by passing JSON validation.

Personal taste can use metadata separately from general similarity. Retrieval should have explicit experience/content/form contribution budgets and account for correlated concepts. Exact weights, distance metric and active-group behavior remain to be tested on judged pairs. No automatic 0/1 collapse, hard fiction/nonfiction exclusion, or deletion of potentially overlapping themes is introduced. Simulation and VR remain distinct. These were conditional or conflicting review proposals, not demonstrated remedies.

## Validation and migration

```sh
python -B docs/design/fingerprint-v2/draft-3/build.py
python -B docs/design/fingerprint-v2/draft-3/checks.py
python -B docs/design/fingerprint-v2/draft-3/validate.py similarity.json --companion metadata.json --vector-output vector.json
```

`validate.py` checks the schemas plus reference integrity, requested coverage, applicable scope, numeric/presence contradictions, relationship IDs and interval ordering. Vector export refuses incomplete input and refuses to overwrite an existing file. The validator cannot establish that evidence is genuine or that a prediction is correct.

[Examples](examples/) are explicitly synthetic, not new Qwen results. The all-zero similarity fixture tests serialization and does not recommend that profile for any real title. The metadata fixture demonstrates explicit unassessed sections.

Previous definitions, schemas, benchmark inputs and raw predictions stay unchanged. The new vector order is incompatible with previous arrays: use its version and mapping; never pad old vectors with zeros. New and redefined fields require reassessment. Production V1 and its existing filters remain unchanged until an actual migration preserves their behavior.
