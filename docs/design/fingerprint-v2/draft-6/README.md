# Fingerprint V2: vector + attributes

**Current design: 2.0.0-draft.6.** Fingerprint is the umbrella term for both parts:

- **Fingerprint vector**: 274 descriptive scores for overall resemblance in content, experience and form.
- **Fingerprint attributes**: targeted scores, categorical facets, presence flags and advisories. This replaces the former “companion metadata” name.

All 274 vector dimensions, their order and numerical definitions remain unchanged from draft.5. The projection identifier remains `similarity-v2.2` to preserve that identity. The response part names remain `vector` and `attributes`; this revision adds seven required attributes to the attributes contract.

## Full readable versions

These are complete, flat key/value references. Each value states the allowed data and the attribute's definition. They are not predicted scores for a film and are not example model responses.

| Part | Full readable reference | Plain JSON | Entries |
|---|---|---|---:|
| Vector | [Every vector attribute](vector.readable.md) | [vector.readable.json](vector.readable.json) | 274 |
| Attributes | [Every fingerprint attribute](attributes.readable.md) | [attributes.readable.json](attributes.readable.json) | 652 |

The 652 entries comprise **331 targeted scores + 171 presence flags + 40 facets + 110 advisory fields**. The latter are 22 topics × five fields: presence, depiction modes, intensity, frequency and explicitness. Every leaf appears once, with stable dotted IDs; envelope fields such as title/scope/version are intentionally outside this inventory.

## Viewing demands and dancing additions

The vector stays unchanged. These seven additions belong to fingerprint attributes:

| Attribute | Meaning |
|---|---|
| `viewing_demands.memory_load` | Retaining and recalling names, relationships, clues and earlier details. |
| `viewing_demands.inference_load` | Working out unstated motives, connections and events needed to follow the work. |
| `viewing_demands.information_rate` | Rate of consequential new information, rather than action or cutting speed. |
| `viewing_affordances.interruption_recovery` | Ease of regaining the thread after a brief distraction or break; higher means easier. |
| `performance.dance_prominence` | How perceptually featured dancing is, independently of its narrative importance. |
| `performance.dance_styles` | Multi-select depicted styles, such as ballet, contemporary, tap or breaking. |
| `performance.dance_contexts` | Multi-select social, rehearsal, competition, stage, ritual and narrative-musical contexts. |

The first five use their declared 0–10 measurement rubrics, with `null` for unknown. These demands are distinct from attention, complexity and dialogue density; they should not inherit those scores mechanically. Interruption recovery describes a work-level tendency for an attentive first-time viewer who understands the presentation language, not a universal guarantee.

Existing `activities.dancing` measures narrative centrality; its presence flag records occurrence. Dance prominence describes featured performance. `sound.musical_numbers` can describe singing without dancing. Styles and contexts can overlap and can refer to different scenes; soundtrack genre alone establishes neither. Explicit dancing absence conflicts with positive dance prominence or a selected depicted dance style/context. Unknowns are never filled automatically.

## Multi-select facets

**All 31 categorical facets accept multiple choices.** This includes chronology, retelling, tone progression, competence basis, narration, credit-scene function, case resolution, character continuity, eras, cultural traditions and categorical format facts.

```json
{
  "format_facts.production_method": ["live_action", "animation"],
  "format_facts.color_process": ["color", "black_and_white"],
  "storytelling.chronology": ["chronological", "reverse_chronological"],
  "storytelling.retelling_structure": ["same_events_complementary", "same_events_conflicting"],
  "ending.post_credits_function": ["comic_tag", "introduces_next_story"]
}
```

These illustrate overlaps, not predictions for a particular title. Select supported substantial patterns; do not tag every conceivable incidental association. Different selections may refer to different scenes, characters or arcs. Independent facets do not create an event graph.

- Arrays contain distinct choices; duplicates are invalid.
- `null` means undetermined. It must not become an empty list or every possible choice.
- `[]` means assessed with no listed choice. It is not proof of absence of an unlisted concept.
- Generic combined labels such as `mixed`, `hybrid`, `multiple_functions` and `same_events_complementary_and_conflicting` are removed; list the actual components instead.
- “None” categories are represented by `[]`, rather than mixing a negative tag with positive selections.
- The **six boolean facts** remain `true / false / null`.
- The **three explicit presence facets** remain one of `present / absent / unknown`. They cannot be both present and absent for the same claim and scope. The same rule applies to content-presence and advisory-presence fields.

The chronology, tone and series definitions now describe substantial patterns within the assessed scope rather than forcing one predominant category. A show can resolve cases within episodes while developing season-long cases, or be both limited and episodic. Unknown show-only facets on movies remain `null` because they are inapplicable.

## Schemas, generation and dictionary

| Part | Publication/response contract | Prompt and definitions |
|---|---|---|
| Vector | [Complete vector schema](vector.schema.json); [response schema permitting honest unknowns](vector.response.schema.json) | [Vector prompt](VECTOR-PROMPT.md); [vector definitions](vector.definition.json) |
| Attributes | [Attributes schema](attributes.schema.json) | [Attributes prompt](ATTRIBUTES-PROMPT.md); [attribute definitions](attributes.definition.json) |

The design still uses two generation requests. [Mapping](mapping.json) preserves vector order, and the [field catalog](field-catalog.json) connects every stable attribute ID to its response JSON pointer, type and definition. [Schema overview](schema-overview.md) provides a grouped inventory. Both flat readable references are generated from this same catalog, so no hand-maintained second attribute list is needed.

Unknown numeric scores are not zero; presence is independent of centrality. Present with zero centrality is allowed, while absent plus a positive same-concept score is contradictory. Validation checks this within attributes and across the pair. A vector with null scores cannot be exported; attributes can retain explicit unknowns. Model-reported absence is not an independently verified safety guarantee.

Existing catalog facts and optional display prose remain separate inputs/outputs under the [ownership boundary](catalog-ownership.json). The earlier [research decisions](../draft-4/research-decisions.md) still apply: no linked plot/event machinery, no automatic taste weights, and no implementation of query interpretation or matching. The new glossary and package naming do not rename legacy production APIs.

## Validation and migration

Run from this directory with Python and the already used `jsonschema` package:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 build.py
PYTHONDONTWRITEBYTECODE=1 python3 checks.py
PYTHONDONTWRITEBYTECODE=1 python3 validate.py examples/vector.synthetic.json --attributes examples/attributes.synthetic.json
```

Use `--expected-identity controller-identity.json` for actual intake. `--response` allows inspection of incomplete vector responses. `--export-vector NEW_FILE.json` requires a complete vector and refuses to overwrite an existing file. [Examples](examples/) are synthetic serialization fixtures only.

[Migration](migration.json) records the five numeric and two facet additions. All prior definitions, facet options and vector ordering are preserved. An explicit migration can retain existing same-scope values and mark new attributes `null` until assessed; do not derive them from correlated scores or fill them with zero or empty lists. Historical drafts and raw data remain unchanged. [Verification](verification.json) records the checks; no paid inference, deployment or live provider compatibility test is performed by this revision.
