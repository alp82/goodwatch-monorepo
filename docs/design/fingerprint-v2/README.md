# Fingerprint V2 design

The current contract is [draft.9](draft-9/README.md), version `2.0.0-draft.9`, projection `similarity-v2.3`. **Fingerprint = Vector + Attributes**: 274 vector dimensions for overall resemblance, plus structured attributes for specific characteristics. Categorical facets support multiple selections. Production V1 remains unchanged.

The [completed twelve-title acceptance pass](acceptance/REPORT.md) tested draft.8. Draft.9 adds the [essence-audit gaps](draft-9/ESSENCE-ADDITIONS.md) and passes offline contract checks; its additions have not received a new generation/quality benchmark. The producer is **not approved for unattended trusted collection**: missing scores, incorrect facts and a major identical-input repeat change remain. See the [collection policy](acceptance/COLLECTION-POLICY.md), historical [reproducible producer recipes](acceptance/producer-recipes/README.md) and [consistency checks](acceptance/consistency-checks/README.md).

- **Full readable vector:** [274 key/value pairs](draft-9/vector.readable.md) · [JSON](draft-9/vector.readable.json)
- **Full readable attributes:** [698 key/value pairs](draft-9/attributes.readable.md) · [JSON](draft-9/attributes.readable.json)
- [Vector schema](draft-9/vector.schema.json), [vector response schema](draft-9/vector.response.schema.json) and [attributes schema](draft-9/attributes.schema.json)
- [Field catalog](draft-9/field-catalog.json), [definitions](draft-9/definition.json), [ordered mapping](draft-9/mapping.json) and [migration](draft-9/migration.json)
- [Essence additions](draft-9/ESSENCE-ADDITIONS.md) and earlier [field-purpose and near-neighbor audit](draft-8/audit/REPORT.md)

Attributes contain 353 targeted scores, 171 presence concepts, 64 facets/facts (53 multi-select categories, six booleans, three presence states and two calendar-year integers), and 22 advisory topics with five details each. This gives 698 attribute entries and 972 entries across both stored parts.

Generation uses three disjoint request parts: vector scores with their 15 presence flags; targeted scores with the remaining 156 presence flags and four dependent facets; then the remaining facts/facets and advisories. The controller assembles the two stored parts by exact field ownership. A complete numeric vector must still pass identity, full-pair and cross-part checks; unknown attributes remain unknown. Existing catalog facts and optional display prose stay outside these LLM contracts; query handling and personal taste weighting remain separate work.

Draft.9 preserves the draft.8 vector order, definitions and rubrics, retaining its projection version. Attributes add character emphasis, ethical dilemmas, resilience, voluntary sacrifice, claustrophobia, economic precarity, blues/reggae/gospel music, relationship dynamics and supernatural mechanisms. Presentation formats and cultural movements gain bounded multi-select choices. Dominant colors, predominant setting periods, viewing demands, dance, sensory atmosphere and animal-harm distinctions remain included.

Earlier [draft.8](draft-8/README.md), [draft.7](draft-7/README.md), [draft.6](draft-6/README.md), [draft.5](draft-5/README.md), [draft.4](draft-4/README.md), [draft.3](draft-3/README.md), [258-dimensional selection](similarity/README.md), root draft.2 definition/schema and benchmark artifacts remain historical inputs. They are not rewritten. Frozen draft.8 producer files and acceptance results remain bound to that version; [draft.9 requests](draft-9/request-contract.json) are a separate interface.
