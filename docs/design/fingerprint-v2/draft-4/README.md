# Fingerprint V2 — flat vector and companion metadata

**Current design: 2.0.0-draft.4.** The similarity vector stays at **274 dimensions** with exactly the same order, definitions and measurement rubrics as draft.3 (`similarity-v2.2`). The companion contract uses fixed attributes and categories that a later Jev/filter consumer can identify by name. It needs no event graph, entity resolution, manually linked motives or prose interpretation.

Two generation requests are defined:

| Part | Output | Contract |
|---|---|---|
| Similarity | 274 integer scores, content/experience/form | [Published vector schema](similarity.schema.json), [response schema](similarity.response.schema.json), [prompt](SIMILARITY-PROMPT.md), [selected definitions](similarity.definition.json) |
| Metadata | 326 companion scores, 171 presence concepts, 38 fixed facets, 22 advisory topics | [Metadata schema](metadata.schema.json), [prompt](METADATA-PROMPT.md), [metadata definitions](metadata.definition.json) |

The response schema permits an honest unknown vector score. The published-vector schema and exporter do not. Metadata unknowns do not prevent a complete similarity vector from being retained separately. Pair consistency is checked when both parts are available. No live provider/schema acceptance or generation cost has been measured for this draft.

## What changed

- Retained all 599 prior numeric attributes: 274 vector and 325 metadata. Added **`characters.demonstrated_competence`** to metadata only. Competence is broader than intellectual problem solving and is not automatically earned training.
- Added fixed distinctions for **chronology, complementary/conflicting retellings, tone progression, competence basis, narration sources, jump scares and their modalities, laugh tracks, sustained screaming, credit-scene function, episodic case resolution and character continuity**.
- Made **era, relative story period, reality layers, environmental obstacles, depicted seasons/holidays, cultural traditions and established protagonist traits** flat categorical data. Cultural categories have stable spellings; no Wikidata lookup or bespoke ontology is required during generation.
- Preserved **format, animation, anime, documentary devices, color, capture medium, one-take/real-time presentation, adaptation and factual basis**. Their definitions distinguish production facts from depicted subjects.
- Kept the 21 existing advisories and added **death**, including natural, offscreen and nonviolent death. Every advisory has presence, depiction modes, intensity, frequency and explicitness.
- Removed mandatory per-attribute evidence wrappers and the generated character/event/timeline graph. Scores are integers or null; categories have fixed values. Retain the actual input, model/route, prompt/schema hashes, raw response and timing in controller-owned run records. Do not ask the model to manufacture this provenance.

All score definitions and the exact order are in [definition.json](definition.json) and [mapping.json](mapping.json). The [readable inventory](schema-overview.md) lists every group and every facet. The [field catalog](field-catalog.json) gives stable IDs, JSON pointers, types, applicability, spoiler flags and a small set of aliases. It is a data dictionary, not a query planner. Definition and measurement labels remain available to future consumers without parsing prose about a particular film.

## Simple values with explicit uncertainty

| Value | Meaning |
|---|---|
| Numeric `0` | A genuine zero under that attribute's rubric; centrality zero is not a certificate of absence |
| Numeric `null` | Unknown/unassessed; for a show-only field on a movie, inapplicable |
| `present / absent / unknown` | Explicit occurrence assessment for a named concept; unknown never becomes absent |
| Categorical `null` | Category not determined |
| Categorical `[]` | Assessed, no listed category identified; not exhaustive absence of every possible niche concept |

All declared keys are required. Arrays contain only defined choices, without duplicates. No missing metadata gets silently replaced with zero. Presence may be present while centrality is zero; absent plus a positive same-concept score is contradictory, including across the vector/metadata boundary. Model-generated absence remains an unverified assessment. Existing independently sourced advisories must not lose their source/coverage information during a later integration.

The vector is complete only when every coordinate is numeric. That establishes serialization readiness, not accuracy, useful neighbors or justified weights. The exporter preserves raw 0–10 values: no flooring ones, rescaling, imputation, active-group gate or similarity metric is introduced here.

## Data ownership and intentional limits

Existing catalog facts remain outside these LLM outputs: cast/director IDs, actual work relations, languages, countries, release dates, runtime, show status, ratings, certifications and edition/offer accessibility information. [Catalog ownership](catalog-ownership.json) lists the boundary; it does not assert those joins or facts are already available. Descriptions/highlights can remain display content, but are not needed to interpret the structured fields. No new prose-based matching layer is required.

Whole-title fields deliberately cannot bind a motive to a particular character, prove a dog survives to a particular timestamp, or guarantee a villain's fate across future sequels. Nor does a broad era identify every historical year/place or a fixed tradition list cover all cultures. Those limits are documented in [research decisions](research-decisions.md). We keep the useful simple distinctions without claiming universal coverage.

Personal taste weighting, query interpretation, filtering implementation, storage and retrieval tuning remain separate work. This draft changes no production V1 behavior, Qwen routing, Jev code or Qdrant collection. It preserves earlier schema drafts and all benchmark predictions. [Migration notes](migration.json) distinguish unchanged vector axes from the breaking JSON envelope change.

## Offline use

Requires Python and the already used `jsonschema` package. From this directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 build.py
PYTHONDONTWRITEBYTECODE=1 python3 checks.py
PYTHONDONTWRITEBYTECODE=1 python3 validate.py examples/similarity.synthetic.json --metadata examples/metadata.synthetic.json
```

For actual intake, pass `--expected-identity controller-identity.json` containing the exact supplied `title` and `scope`. `--response` allows an incomplete similarity response to be inspected. `--export-vector NEW_FILE.json` always requires a complete vector and refuses to overwrite a file. The two [synthetic examples](examples/) demonstrate structure only; they are not new Qwen results or film-quality claims. Production orchestration must still supply the correct identity, preserve provenance and decide what to do with failed/incomplete assessments.

All **36 focused checks** pass, including historical preservation, exact axis/rubric identity, strict numeric types, unknown handling, scope binding, fixed vocabulary, advisory consistency and cross-part contradictions. The CLI reports zeros, ones and the fraction of assessed scores at most one without enforcing a target distribution. [Verification receipt](verification.json).
