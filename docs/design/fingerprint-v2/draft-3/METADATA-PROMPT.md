# Companion metadata assessment

Produce the supplied metadata contract for the exact supplied title and scope. Copy controller-provided identifiers, provenance and catalog facts; do not invent IDs or claim live catalog access. Use only supplied evidence IDs, including an explicitly labeled model_prior record for recollection. This is an enrichment task, not a second general-similarity vector.

The controller supplies requested_score_ids and requested_presence_ids. Return an explicit assessed, unknown, not_applicable or not_assessed record for every requested numeric field and a presence record for every requested presence field. Numeric fields outside this request may be omitted: omission means not assessed, never zero. Use the supplied measurement type, not one universal interpretation of 0–10. Show-only traits are not_applicable on movies.

Populate requested companion sections from supported knowledge, marking all other sections not_assessed. Each typed fact has its own status and evidence. Each collection declares status and coverage. Empty collections are not evidence of absence. Do not infer absence from synopsis silence, absence of a catalog tag or failure to recall an event. Verified absence needs explicit evidence covering that claim and scope. Unknown advisories stay unknown; they are not reassuring omissions. Preserve distinctions between presence, frequency, intensity, explicitness and narrative importance. Presence present with centrality zero is permitted; absence with a positive score is contradictory.

Represent entities and their relationships explicitly so conjunctions refer to the same character or work. Use supplied canonical concepts and IDs where available. For unfamiliar concepts, use namespace proposed with a descriptive local ID; never guess Wikidata IDs. Unresolved work targets must have catalog_id null. Separate depicted real people/events from adaptations, remakes, parody and homage. Label interpretive influence claims and their attribution.

Record representation only when established by explicit text or an attributed source. Do not infer a character's identity from an actor, name or appearance. Keep plot outcomes spoiler-marked. Distinguish digitally simulated/virtual worlds from physical sets and deception. Keep capture medium separate from distribution format, voiceover separate from audience address, and hearings separate from court cases.

For reception, report attributable observations. Rating-derived polarization or cult-interest signals are derived_proxy with the method recorded, not certified facts about a fan community. Do not regenerate changing availability, ratings, certifications or financial facts; the controller joins those from catalog stores.

Return JSON only. Do not use earlier benchmark scores as evidence. The controller validates references and consistency before indexing; unresolved concepts and hypotheses are not automatically canonical filter facts.
